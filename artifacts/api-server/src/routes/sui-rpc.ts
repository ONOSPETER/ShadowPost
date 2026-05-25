import { Router } from "express";
import { logger } from "../lib/logger";

const TATUM_API_KEY = process.env.TATUM_API_KEY || "";
const TATUM_SUI_RPC = "https://sui-mainnet.gateway.tatum.io";
const FALLBACK_SUI_RPC = "https://fullnode.mainnet.sui.io:443";

const router = Router();

router.post("/", async (req, res) => {
  const rpcUrl = TATUM_API_KEY ? TATUM_SUI_RPC : FALLBACK_SUI_RPC;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (TATUM_API_KEY) headers["x-api-key"] = TATUM_API_KEY;

  logger.info(
    { method: (req.body as Record<string, unknown>)?.method, rpcUrl },
    "sui rpc proxy"
  );

  try {
    const rpcRes = await fetch(rpcUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(20_000),
    });

    const text = await rpcRes.text();

    if (!rpcRes.ok) {
      logger.warn({ status: rpcRes.status, body: text.slice(0, 300) }, "sui rpc upstream error");
      res.status(rpcRes.status).json({ error: `RPC upstream ${rpcRes.status}`, detail: text.slice(0, 200) });
      return;
    }

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      res.status(502).json({ error: "Invalid JSON from Sui RPC" });
      return;
    }

    res.status(200).json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "fetch error";
    logger.error({ err: e }, "sui rpc proxy fetch error");
    res.status(502).json({ error: msg });
  }
});

export default router;
