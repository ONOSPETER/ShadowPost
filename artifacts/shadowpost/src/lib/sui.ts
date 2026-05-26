async function rpcCall(method: string, params: unknown[]) {
  const res = await fetch("/api/sui-rpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Sui RPC error ${res.status}: ${text}`);
  }

  return res.json();
}

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

export function getObject(objectId: string) {
  return rpcCall("sui_getObject", [objectId, { showContent: true }]);
}
