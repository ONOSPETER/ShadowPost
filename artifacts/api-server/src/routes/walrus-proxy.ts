import { Router } from "express";
import { logger } from "../lib/logger";

const WALRUS_PUBLISHER =
  process.env.WALRUS_PUBLISHER || "https://publisher.walrus.space";

const router = Router();

router.put("/upload", async (req, res) => {
  try {
    const payload = JSON.stringify(req.body);
    const byteLength = Buffer.byteLength(payload, "utf-8");

    logger.info(
      { url: `${WALRUS_PUBLISHER}/v1/blobs`, payloadBytes: byteLength },
      "walrus upload starting"
    );

    const walrusRes = await fetch(`${WALRUS_PUBLISHER}/v1/blobs?epochs=5`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(byteLength),
      },
      body: payload,
    });

    const responseText = await walrusRes.text();

    logger.info(
      { status: walrusRes.status, body: responseText.slice(0, 500) },
      "walrus upload response"
    );

    if (!walrusRes.ok) {
      res
        .status(walrusRes.status)
        .json({ error: `Walrus error ${walrusRes.status}`, detail: responseText });
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

    res.status(200).json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Walrus proxy error";
    logger.error({ err: e }, "walrus proxy error");
    res.status(502).json({ error: msg });
  }
});

function extractBlobId(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const d = data as Record<string, unknown>;

  const newlyCreated = d["newlyCreated"] as
    | { blobObject?: { blobId?: string } }
    | undefined;
  if (newlyCreated?.blobObject?.blobId) return newlyCreated.blobObject.blobId;

  const alreadyCertified = d["alreadyCertified"] as
    | { blobId?: string }
    | undefined;
  if (alreadyCertified?.blobId) return alreadyCertified.blobId;

  if (typeof d["blobId"] === "string") return d["blobId"];

  return "";
}

export default router;
