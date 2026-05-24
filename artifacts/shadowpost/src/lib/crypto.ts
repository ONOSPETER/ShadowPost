import nacl from "tweetnacl";
import * as util from "tweetnacl-util";

export function encryptSecret(message: string, recipientKey: string) {
  const pk = util.decodeBase64(recipientKey);
  const eph = nacl.box.keyPair();
  const nonce = nacl.randomBytes(nacl.box.nonceLength);

  const enc = nacl.box(
    util.decodeUTF8(message),
    nonce,
    pk,
    eph.secretKey
  );

  return {
    encryptedMessage: util.encodeBase64(enc),
    nonce: util.encodeBase64(nonce),
    ephemeralPublicKey: util.encodeBase64(eph.publicKey),
  };
}

export function decryptSecret(enc: string, nonce: string, eph: string, sk: string) {
  const dec = nacl.box.open(
    util.decodeBase64(enc),
    util.decodeBase64(nonce),
    util.decodeBase64(eph),
    util.decodeBase64(sk)
  );

  if (!dec) throw new Error("Decryption failed");

  return util.encodeUTF8(dec);
}
