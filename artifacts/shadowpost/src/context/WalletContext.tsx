import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import {
  useCurrentAccount,
  useCurrentWallet,
  useDisconnectWallet,
  useSignPersonalMessage,
} from "@mysten/dapp-kit";
import nacl from "tweetnacl";
import * as naclUtil from "tweetnacl-util";
import { registerKey } from "@/lib/keyRegistry";

interface WalletContextValue {
  address: string | null;
  publicKey: string | null;
  secretKey: string | null;
  walletName: string | null;
  connected: boolean;
  isConnecting: boolean;
  isDerivingKey: boolean;
  isModalOpen: boolean;
  connect: () => void;
  disconnect: () => void;
  openModal: () => void;
  closeModal: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const account = useCurrentAccount();
  const { currentWallet, connectionStatus } = useCurrentWallet();
  const { mutate: disconnectWallet } = useDisconnectWallet();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();

  const signRef = useRef(signPersonalMessage);
  useEffect(() => { signRef.current = signPersonalMessage; });

  const [naclPublicKey, setNaclPublicKey] = useState<string | null>(null);
  const [naclSecretKey, setNaclSecretKey] = useState<string | null>(null);
  const [isDerivingKey, setIsDerivingKey] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const address = account?.address ?? null;
  const connected = connectionStatus === "connected";
  const isConnecting = connectionStatus === "connecting";

  useEffect(() => {
    if (!account) {
      setNaclPublicKey(null);
      setNaclSecretKey(null);
      return;
    }

    const addr = account.address;

    try {
      const cached = localStorage.getItem(`nacl_kp:${addr}`);
      if (cached) {
        const { publicKey, secretKey } = JSON.parse(cached) as {
          publicKey: string;
          secretKey: string;
        };
        setNaclPublicKey(publicKey);
        setNaclSecretKey(secretKey);
        registerKey(addr, publicKey);
        return;
      }
    } catch {
      // ignore parse errors
    }

    setIsDerivingKey(true);
    const DERIVE_MSG = new TextEncoder().encode("ShadowPost:encryption-key:v1");

    signRef
      .current({ message: DERIVE_MSG })
      .then(({ signature }) => {
        const sigBytes = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
        return crypto.subtle.digest("SHA-256", sigBytes);
      })
      .then((hashBuffer) => {
        const seed = new Uint8Array(hashBuffer);
        const kp = nacl.box.keyPair.fromSecretKey(seed);
        const publicKey = naclUtil.encodeBase64(kp.publicKey);
        const secretKey = naclUtil.encodeBase64(kp.secretKey);
        localStorage.setItem(`nacl_kp:${addr}`, JSON.stringify({ publicKey, secretKey }));
        registerKey(addr, publicKey);
        setNaclPublicKey(publicKey);
        setNaclSecretKey(secretKey);
      })
      .catch(() => {
        const kp = nacl.box.keyPair();
        const publicKey = naclUtil.encodeBase64(kp.publicKey);
        const secretKey = naclUtil.encodeBase64(kp.secretKey);
        registerKey(addr, publicKey);
        setNaclPublicKey(publicKey);
        setNaclSecretKey(secretKey);
      })
      .finally(() => setIsDerivingKey(false));
  }, [account?.address]);

  const disconnect = useCallback(() => {
    disconnectWallet();
    setNaclPublicKey(null);
    setNaclSecretKey(null);
  }, [disconnectWallet]);

  const openModal = useCallback(() => setIsModalOpen(true), []);
  const closeModal = useCallback(() => setIsModalOpen(false), []);

  return (
    <WalletContext.Provider
      value={{
        address,
        publicKey: naclPublicKey,
        secretKey: naclSecretKey,
        walletName: currentWallet?.name ?? null,
        connected,
        isConnecting,
        isDerivingKey,
        isModalOpen,
        connect: openModal,
        disconnect,
        openModal,
        closeModal,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
