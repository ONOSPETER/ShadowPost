import { Router } from "express";
import { logger } from "../lib/logger";

const TATUM_API_KEY = process.env.TATUM_API_KEY || "";
const TATUM_WALRUS_URL = "https://api.tatum.io/v4/data/storage/upload";

const MAX_RETRIES = 2;

const router = Router();

router.put("/upload", async (req, res) => {
  if (!TATUM_API_KEY) {
    res.status(503).json({
      error:
        "TATUM_API_KEY is not configured on the server. Add it to your Replit secrets.",
    });
    return;
  }

  const payload = JSON.stringify(req.body);
  const fileBytes = Buffer.from(payload, "utf-8");

  logger.info(
    { url: TATUM_WALRUS_URL, payloadBytes: fileBytes.length },
    "walrus upload via tatum starting"
  );

  const boundary = `----ShadowPostBoundary${Date.now()}`;

  const preamble = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="secret.json"\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n`,
    "utf-8"
  );
  const epilogue = Buffer.from(`\r\n--${boundary}--\r\n`, "utf-8");
  const body = Buffer.concat([preamble, fileBytes, epilogue]);

  let lastError = "Unknown error";

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const tatumRes = await fetch(TATUM_WALRUS_URL, {
        method: "POST",
        headers: {
          "x-api-key": TATUM_API_KEY,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": String(body.length),
        },
        body,
        signal: AbortSignal.timeout(30_000),
      });

      const responseText = await tatumRes.text();

      logger.info(
        { attempt, status: tatumRes.status, body: responseText.slice(0, 500) },
        "tatum walrus response"
      );

      if (!tatumRes.ok) {
        lastError = `Tatum ${tatumRes.status}: ${responseText.slice(0, 200)}`;
        if (tatumRes.status >= 500 && attempt <= MAX_RETRIES) {
          await sleep(attempt * 1000);
          continue;
        }
        res.status(tatumRes.status).json({ error: lastError });
        return;
      }

      let data: unknown;
      try {
        data = JSON.parse(responseText);
      } catch {
        data = { raw: responseText };
      }

      const blobId = extractBlobId(data);
      logger.info({ blobId }, "walrus blob ID extracted");

      if (!blobId) {
        logger.warn({ data }, "no blob ID in tatum response");
        res.status(502).json({
          error:
            "Tatum returned no blobId — check your API key and plan",
          detail: responseText.slice(0, 300),
        });
        return;
      }

      res.status(200).json({ blobId });
      return;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "fetch error";
      lastError = msg;
      logger.error({ attempt, err: e }, "walrus proxy fetch error");

      if (attempt <= MAX_RETRIES) {
        await sleep(attempt * 1000);
        continue;
      }
    }
  }

  res.status(502).json({ error: lastError });
});

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractBlobId(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const d = data as Record<string, unknown>;

  if (typeof d["blobId"] === "string") return d["blobId"];
  if (typeof d["blob_id"] === "string") return d["blob_id"];
  if (typeof d["id"] === "string" && !d["jobId"]) return d["id"];

  const newlyCreated = d["newlyCreated"] as
    | { blobObject?: { blobId?: string } }
    | undefined;
  if (newlyCreated?.blobObject?.blobId) return newlyCreated.blobObject.blobId;

  const alreadyCertified = d["alreadyCertified"] as
    | { blobId?: string }
    | undefined;
  if (alreadyCertified?.blobId) return alreadyCertified.blobId;

  return "";
}

export default router;
