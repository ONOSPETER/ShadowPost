import { Router } from "express";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { logger } from "../lib/logger";

const TATUM_API_KEY = process.env.TATUM_API_KEY || "";
const TATUM_WALRUS_URL = "https://api.tatum.io/v4/data/storage/upload";
const MAX_RETRIES = 2;

const BLOB_CACHE_DIR = join(process.cwd(), "data", "blobs");

function ensureCacheDir() {
  if (!existsSync(BLOB_CACHE_DIR)) mkdirSync(BLOB_CACHE_DIR, { recursive: true });
}

function cacheSave(blobId: string, payload: unknown): void {
  try {
    ensureCacheDir();
    writeFileSync(
      join(BLOB_CACHE_DIR, `${blobId}.json`),
      JSON.stringify(payload),
      "utf-8"
    );
    logger.info({ blobId }, "blob saved to local cache");
  } catch (e) {
    logger.warn({ blobId, err: e }, "failed to write blob cache");
  }
}

function cacheLoad(blobId: string): unknown | null {
  try {
    const path = join(BLOB_CACHE_DIR, `${blobId}.json`);
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf-8")) as unknown;
  } catch {
    return null;
  }
}

// ─── Reachable Walrus aggregators (verified from Replit network) ───────────────
const WALRUS_AGGREGATORS = [
  "https://walrus-mainnet-aggregator.nodeinfra.com",
  "https://walrus.globalstake.io",
  "https://aggregator.walrus-mainnet.walrus.space",
];

const router = Router();

// ─── PUT /upload ─────────────────────────────────────────────────────────────
router.put("/upload", async (req, res) => {
  if (!TATUM_API_KEY) {
    res.status(503).json({
      error: "TATUM_API_KEY is not configured. Add it to Replit secrets.",
    });
    return;
  }

  const payload = req.body as unknown;
  const payloadJson = JSON.stringify(payload);
  const fileBytes = Buffer.from(payloadJson, "utf-8");

  logger.info({ payloadBytes: fileBytes.length }, "walrus upload starting");

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
        { attempt, status: tatumRes.status, body: responseText.slice(0, 300) },
        "tatum upload response"
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
      logger.info({ blobId }, "tatum blob ID extracted");

      if (!blobId) {
        res.status(502).json({
          error: "Tatum returned no blobId",
          detail: responseText.slice(0, 300),
        });
        return;
      }

      // ── Cache payload locally so it's available immediately for decryption.
      // Tatum's Walrus upload is async (PENDING) and can take time to certify;
      // our cache serves reads while waiting for propagation.
      cacheSave(blobId, payload);

      res.status(200).json({ blobId });
      return;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "fetch error";
      lastError = msg;
      logger.error({ attempt, err: e }, "tatum upload error");
      if (attempt <= MAX_RETRIES) {
        await sleep(attempt * 1000);
        continue;
      }
    }
  }

  res.status(502).json({ error: lastError });
});

// ─── GET /blob/:blobId ───────────────────────────────────────────────────────
router.get("/blob/:blobId", async (req, res) => {
  const { blobId } = req.params;
  if (!blobId) {
    res.status(400).json({ error: "blobId required" });
    return;
  }

  logger.info({ blobId }, "blob fetch starting");

  // 1. Check local cache first — always up-to-date and avoids Walrus latency
  const cached = cacheLoad(blobId);
  if (cached !== null) {
    logger.info({ blobId, source: "cache" }, "blob served from local cache");
    res.status(200).json(cached);
    return;
  }

  // 2. Try Walrus aggregators in order
  const errors: string[] = [];

  for (const aggregator of WALRUS_AGGREGATORS) {
    const url = `${aggregator}/v1/blobs/${encodeURIComponent(blobId)}`;
    try {
      const aggRes = await fetch(url, { signal: AbortSignal.timeout(15_000) });

      if (!aggRes.ok) {
        const txt = await aggRes.text().catch(() => "");
        errors.push(`${aggregator} → ${aggRes.status}`);
        logger.warn({ blobId, aggregator, status: aggRes.status }, "aggregator non-ok");
        continue;
      }

      const buf = await aggRes.arrayBuffer();
      const bytes = Buffer.from(buf);
      logger.info({ blobId, aggregator, bytes: bytes.length }, "blob fetched from walrus");

      // Try parsing the raw bytes as JSON
      const parsed = tryExtractJson(bytes);
      if (parsed !== null) {
        cacheSave(blobId, parsed);
        res.status(200).json(parsed);
        return;
      }

      errors.push(`${aggregator} → blob exists but content is not valid JSON`);
      logger.warn({ blobId, aggregator }, "walrus blob not parseable as JSON");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "fetch error";
      errors.push(`${aggregator} → ${msg}`);
      logger.warn({ blobId, aggregator, err: e }, "aggregator fetch error");
    }
  }

  logger.error({ blobId, errors }, "blob not found in cache or any aggregator");
  res.status(404).json({
    error: "Blob not yet available — it may still be certifying on Walrus. Try again in a few minutes.",
    detail: errors,
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractBlobId(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const d = data as Record<string, unknown>;
  if (typeof d["blobId"] === "string") return d["blobId"];
  if (typeof d["blob_id"] === "string") return d["blob_id"];

  const nc = d["newlyCreated"] as { blobObject?: { blobId?: string } } | undefined;
  if (nc?.blobObject?.blobId) return nc.blobObject.blobId;

  const ac = d["alreadyCertified"] as { blobId?: string } | undefined;
  if (ac?.blobId) return ac.blobId;

  return "";
}

/**
 * Attempt to extract a valid JSON object from raw blob bytes.
 * Walrus may pad content with leading binary header and/or trailing nulls;
 * we scan for the first '{' byte and try to parse from there.
 */
function tryExtractJson(buf: Buffer): unknown | null {
  // Try direct parse first (clean blob)
  try {
    return JSON.parse(buf.toString("utf-8")) as unknown;
  } catch {
    // fall through to scanning
  }

  // Scan for first '{' byte
  const start = buf.indexOf(0x7b);
  if (start < 0) return null;

  // Scan from '{' and try progressively shorter slices to find a valid JSON boundary
  const candidate = buf.slice(start);
  // strip trailing nulls
  let end = candidate.length;
  while (end > 0 && candidate[end - 1] === 0x00) end--;
  if (end === 0) return null;

  try {
    return JSON.parse(candidate.slice(0, end).toString("utf-8")) as unknown;
  } catch {
    return null;
  }
}

export default router;
