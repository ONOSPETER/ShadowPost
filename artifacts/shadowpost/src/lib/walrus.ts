const AGGREGATOR =
  import.meta.env.VITE_WALRUS_AGGREGATOR || "https://aggregator.walrus.space";

const MAX_RETRIES = 2;

export async function uploadToWalrus(data: unknown): Promise<WalrusUploadResult> {
  let lastError: Error = new Error("Upload failed");

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const res = await fetch("/api/walrus/upload", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        let detail = text;
        try {
          const json = JSON.parse(text) as { error?: string; detail?: string };
          detail = json.error || json.detail || text;
        } catch {
          // keep raw text
        }

        if (res.status === 503) {
          throw new Error(`Server not configured: ${detail}`);
        }

        if (res.status >= 500 && attempt <= MAX_RETRIES) {
          await sleep(attempt * 1000);
          continue;
        }

        throw new Error(`Walrus upload failed (${res.status}): ${detail}`);
      }

      return res.json() as Promise<WalrusUploadResult>;
    } catch (e: unknown) {
      lastError = e instanceof Error ? e : new Error("Upload error");

      if (lastError.message.startsWith("Server not configured")) throw lastError;

      if (attempt <= MAX_RETRIES) {
        await sleep(attempt * 1000);
        continue;
      }
    }
  }

  throw lastError;
}

export async function fetchBlob(blobId: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${AGGREGATOR}/v1/blobs/${blobId}`);

  if (!res.ok) {
    throw new Error(`Walrus fetch failed (${res.status}): ${res.statusText}`);
  }

  return res.json();
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

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
