const RPC =
  import.meta.env.VITE_SUI_RPC ||
  import.meta.env.VITE_TATUM_RPC ||
  "https://fullnode.mainnet.sui.io:443";

const API_KEY = import.meta.env.VITE_TATUM_API_KEY || "";

async function rpcCall(method: string, params: unknown[]) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (API_KEY) headers["x-api-key"] = API_KEY;

  const res = await fetch(RPC, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });

  if (!res.ok) throw new Error(`RPC error ${res.status}`);
  return res.json();
}

/**
 * Returns all objects of the given Sui Move struct type owned by addr.
 * Filtered to only return Secret objects from our package.
 */
export function getOwnedObjects(addr: string, structType?: string) {
  const filter = structType ? { filter: { StructType: structType } } : {};
  return rpcCall("suix_getOwnedObjects", [
    addr,
    {
      ...filter,
      options: { showContent: true, showType: true },
    },
  ]);
}

/**
 * Fetch a single object by ID with full content.
 */
export function getObject(objectId: string) {
  return rpcCall("sui_getObject", [objectId, { showContent: true }]);
}
