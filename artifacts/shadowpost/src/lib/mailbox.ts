import { getOwnedObjects } from "./sui";
import { SECRET_TYPE } from "./contract";

export interface MailboxMessage {
  id: string;
  sender: string;
  recipient: string;
  walrusBlobId: string;
  createdAt: number;
}

/**
 * Fetch all Secret objects owned by wallet address.
 * Filters by the deployed package's Secret struct type so only
 * ShadowPost messages appear, not unrelated owned objects.
 */
export async function getInbox(wallet: string): Promise<MailboxMessage[]> {
  const res = await getOwnedObjects(wallet, SECRET_TYPE);
  const items: unknown[] = res?.result?.data ?? [];

  return items
    .map((o) => {
      const obj = o as {
        data?: {
          objectId?: string;
          content?: {
            dataType?: string;
            fields?: Record<string, unknown>;
          };
        };
      };

      const fields = obj?.data?.content?.fields;
      if (!fields) return null;

      // walrus_blob_id is stored as vector<u8> — decode from byte array or string
      let blobId = "";
      const raw = fields.walrus_blob_id;
      if (Array.isArray(raw)) {
        blobId = new TextDecoder().decode(new Uint8Array(raw as number[]));
      } else if (typeof raw === "string") {
        blobId = raw;
      }

      return {
        id: obj.data?.objectId ?? "",
        sender: (fields.sender as string) ?? "",
        recipient: (fields.recipient as string) ?? "",
        walrusBlobId: blobId,
        createdAt: Number(fields.created_at ?? 0),
      } satisfies MailboxMessage;
    })
    .filter((m): m is MailboxMessage => m !== null && m.id !== "");
}
