import { Transaction } from "@mysten/sui/transactions";

// ─── Deployed contract (Sui Mainnet) ─────────────────────────────────────────
export const PACKAGE_ID =
  import.meta.env.VITE_PACKAGE_ID ||
  "0x99b5e921f24162117880eaeb9682e7e1675c09286e59fdbb34a0edb71280a00b";

export const MODULE_NAME = "shadowpost";
export const SEND_SECRET_FN = "send_secret";

/**
 * Sui shared Clock object — same address on all networks.
 * Required by send_secret() to timestamp the Secret object.
 */
export const SUI_CLOCK_OBJECT_ID = "0x6";

/**
 * Fully-qualified Move type for inbox filtering.
 * Use with suix_getOwnedObjects: { filter: { StructType: SECRET_TYPE } }
 */
export const SECRET_TYPE = `${PACKAGE_ID}::${MODULE_NAME}::Secret`;

// ─── Transaction builder ─────────────────────────────────────────────────────

export interface SendSecretParams {
  recipient: string;
  walrusBlobId: string;
}

/**
 * Builds a Sui PTB calling shadowpost::send_secret().
 *
 * The transaction:
 *   1. Encodes walrusBlobId as UTF-8 vector<u8>
 *   2. Calls send_secret(recipient, blob_bytes, &Clock)
 *   3. Sui runtime transfers the Secret object to recipient
 */
export function buildSendSecretTx({ recipient, walrusBlobId }: SendSecretParams): Transaction {
  const tx = new Transaction();
  const blobBytes = Array.from(new TextEncoder().encode(walrusBlobId));

  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::${SEND_SECRET_FN}`,
    arguments: [
      tx.pure.address(recipient),
      tx.pure.vector("u8", blobBytes),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });

  return tx;
}
