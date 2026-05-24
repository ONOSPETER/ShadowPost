const AGGREGATOR =
  import.meta.env.VITE_WALRUS_AGGREGATOR || "https://aggregator.walrus.space";

/**
 * Upload encrypted payload to Walrus via server-side proxy.
 * Proxying avoids CORS issues with the Walrus publisher endpoint.
 */
export async function uploadToWalrus(data: unknown): Promise<WalrusUploadResult> {
  const res = await fetch("/api/walrus/upload", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Walrus upload failed (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Fetch an encrypted blob by its Walrus blob ID.
 */
export async function fetchBlob(blobId: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${AGGREGATOR}/v1/blobs/${blobId}`);

  if (!res.ok) {
    throw new Error(`Walrus fetch failed (${res.status}): ${res.statusText}`);
  }

  return res.json();
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WalrusUploadResult {
  newlyCreated?: { blobObject: { blobId: string } };
  alreadyCertified?: { blobId: string };
  blobId?: string;
}

export function extractBlobId(result: WalrusUploadResult): string {
  return (
    result?.newlyCreated?.blobObject?.blobId ||
    result?.alreadyCertified?.blobId ||
    result?.blobId ||
    ""
  );
}
