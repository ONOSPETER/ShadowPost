import { useWallets, useConnectWallet } from "@mysten/dapp-kit";
import { useWallet } from "@/context/WalletContext";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

const INSTALL_LINKS: Record<string, string> = {
  "Sui Wallet": "https://suiwallet.com",
  Suiet: "https://suiet.app",
};

const FALLBACK_WALLETS = [
  { name: "Sui Wallet", desc: "Official Mysten Labs wallet" },
  { name: "Suiet", desc: "Smart wallet for Sui" },
];

function WalletIcon({ src, name }: { src?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        className="w-9 h-9 rounded-xl object-contain"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div
      className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-blue-400"
      style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.2)" }}
    >
      {name[0]}
    </div>
  );
}

export default function WalletConnectModal() {
  const { isModalOpen, closeModal } = useWallet();
  const wallets = useWallets();
  const { mutate: connectWallet, isPending } = useConnectWallet();
  const [connectingName, setConnectingName] = useState<string | null>(null);

  const handleConnect = (wallet: ReturnType<typeof useWallets>[number]) => {
    setConnectingName(wallet.name);
    connectWallet(
      { wallet },
      {
        onSuccess: () => {
          closeModal();
          setConnectingName(null);
        },
        onError: () => {
          setConnectingName(null);
        },
      }
    );
  };

  return (
    <AnimatePresence>
      {isModalOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeModal}
          />

          <motion.div
            className="relative z-10 w-full max-w-sm mx-4"
            initial={{ scale: 0.93, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.93, y: 16, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{
              background: "var(--sui-surface)",
              border: "1px solid var(--sui-border)",
              borderRadius: "20px",
            }}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold text-white leading-tight">
                    Connect Wallet
                  </h2>
                  <p className="text-xs mt-1" style={{ color: "var(--sui-text-dim)" }}>
                    Choose your Sui wallet to enter the vault
                  </p>
                </div>
                <button
                  onClick={closeModal}
                  className="p-1.5 rounded-lg transition-colors -mt-0.5"
                  style={{ color: "var(--sui-text-dim)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "white")}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = "var(--sui-text-dim)")
                  }
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>

              <div className="space-y-2">
                {wallets.length > 0 ? (
                  wallets.map((wallet) => {
                    const isConnecting = connectingName === wallet.name;
                    return (
                      <motion.button
                        key={wallet.name}
                        onClick={() => !isPending && handleConnect(wallet)}
                        disabled={isPending}
                        whileHover={{ scale: isPending ? 1 : 1.01 }}
                        whileTap={{ scale: isPending ? 1 : 0.99 }}
                        className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl text-left transition-all"
                        style={{
                          background: isConnecting
                            ? "rgba(59,130,246,0.1)"
                            : "var(--sui-elevated)",
                          border: isConnecting
                            ? "1px solid rgba(59,130,246,0.3)"
                            : "1px solid var(--sui-border)",
                        }}
                      >
                        <WalletIcon src={wallet.icon} name={wallet.name} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white">
                            {wallet.name}
                          </div>
                          <div
                            className="text-[11px] mt-0.5"
                            style={{ color: "var(--sui-text-dim)" }}
                          >
                            {isConnecting ? "Connecting…" : "Detected · Click to connect"}
                          </div>
                        </div>
                        {isConnecting ? (
                          <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin shrink-0" />
                        ) : (
                          <svg
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="w-4 h-4 shrink-0"
                            style={{ color: "var(--sui-text-dim)" }}
                          >
                            <path
                              fillRule="evenodd"
                              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </motion.button>
                    );
                  })
                ) : (
                  <div className="py-2">
                    <p
                      className="text-xs text-center mb-4"
                      style={{ color: "var(--sui-text-dim)" }}
                    >
                      No Sui wallet detected. Install one to continue:
                    </p>
                    {FALLBACK_WALLETS.map((w) => (
                      <a
                        key={w.name}
                        href={INSTALL_LINKS[w.name]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3.5 p-3.5 rounded-2xl mb-2 transition-all"
                        style={{
                          background: "var(--sui-elevated)",
                          border: "1px solid var(--sui-border)",
                        }}
                      >
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-blue-400 shrink-0"
                          style={{
                            background: "rgba(59,130,246,0.12)",
                            border: "1px solid rgba(59,130,246,0.2)",
                          }}
                        >
                          {w.name[0]}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-white">
                            {w.name}
                          </div>
                          <div
                            className="text-[11px]"
                            style={{ color: "var(--sui-text-dim)" }}
                          >
                            {w.desc}
                          </div>
                        </div>
                        <span
                          className="text-[11px] shrink-0"
                          style={{ color: "var(--sui-blue-bright)" }}
                        >
                          Install →
                        </span>
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <p
                className="text-center text-[10px] mt-5 leading-relaxed"
                style={{ color: "var(--sui-text-muted)" }}
              >
                After connecting, you'll sign once to generate
                <br />
                your encryption key — no data leaves your device.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
