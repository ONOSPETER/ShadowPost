import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/WalletContext";
import { getInbox, type MailboxMessage } from "@/lib/mailbox";
import { fetchBlob } from "@/lib/walrus";
import { decryptSecret } from "@/lib/crypto";
import { truncateAddress, formatTimestamp } from "@/lib/utils";

interface DecryptedMessage extends MailboxMessage {
  decrypted?: string;
  decrypting?: boolean;
  error?: string;
}

function EmptyInbox() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-20 px-8 text-center">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5" style={{ background: "var(--sui-elevated)", border: "1px solid var(--sui-border)" }}>
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6" style={{ color: "var(--sui-text-muted)" }}>
          <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
          <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
        </svg>
      </div>
      <p className="text-sm font-medium text-white mb-1.5">No messages yet</p>
      <p className="text-xs max-w-xs" style={{ color: "var(--sui-text-muted)" }}>
        Secrets sent to your wallet address will appear here
      </p>
    </div>
  );
}

function MessageDetail({ msg, onDecrypt }: { msg: DecryptedMessage; onDecrypt: () => void }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl p-6 sm:p-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: "linear-gradient(135deg, #1D4ED8, #2563EB)" }}>
              {(msg.sender || "?").slice(2, 4).toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-medium text-white">
                {msg.sender ? truncateAddress(msg.sender, 6) : "Unknown"}
              </div>
              <div className="text-xs" style={{ color: "var(--sui-text-dim)" }}>
                {formatTimestamp(msg.createdAt)}
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            {[
              { label: "Blob ID", value: msg.walrusBlobId || "—" },
              { label: "Object ID", value: msg.id || "—" },
            ].map(({ label, value }) => (
              <div key={label} className="flex gap-3 text-xs">
                <span className="w-16 shrink-0 font-medium" style={{ color: "var(--sui-text-muted)" }}>{label}</span>
                <span className="font-mono break-all" style={{ color: "var(--sui-text-dim)" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="mb-6" style={{ height: 1, background: "var(--sui-border)" }} />

        {/* Content */}
        <AnimatePresence mode="wait">
          {msg.decrypting && (
            <motion.div key="decrypting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3 py-4" style={{ color: "var(--sui-text-dim)" }}>
              <svg className="w-4 h-4 animate-spin text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <span className="text-sm">Decrypting locally in your browser...</span>
            </motion.div>
          )}

          {msg.error && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl p-4 text-sm" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#FCA5A5" }}>
              {msg.error}
            </motion.div>
          )}

          {msg.decrypted && (
            <motion.div
              key="decrypted"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              <div className="flex items-center gap-1.5 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <span className="text-[11px] font-medium uppercase tracking-wider text-green-400">Decrypted</span>
              </div>
              <div className="rounded-xl p-5 text-sm leading-relaxed font-mono whitespace-pre-wrap" style={{ background: "var(--sui-elevated)", border: "1px solid var(--sui-border)", color: "var(--sui-text)" }}>
                {msg.decrypted}
              </div>
            </motion.div>
          )}

          {!msg.decrypting && !msg.error && !msg.decrypted && (
            <motion.div key="locked" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-start">
              <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg text-sm" style={{ background: "var(--sui-elevated)", border: "1px solid var(--sui-border)", color: "var(--sui-text-dim)" }}>
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-blue-400 shrink-0">
                  <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                </svg>
                Message encrypted — decryption happens locally
              </div>
              <button
                onClick={onDecrypt}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.01]"
                style={{ background: "linear-gradient(135deg, #2563EB, #1D4ED8)", boxShadow: "0 4px 16px rgba(37,99,235,0.25)" }}
              >
                Decrypt Message
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function InboxPage() {
  const { address, secretKey } = useWallet();
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    getInbox(address)
      .then(setMessages)
      .catch((e) => setError(e?.message || "Failed to load inbox"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [address]);

  const handleDecrypt = async (msg: DecryptedMessage) => {
    if (msg.decrypted || msg.decrypting) return;
    setMessages((p) => p.map((m) => m.id === msg.id ? { ...m, decrypting: true } : m));
    try {
      const raw = await fetchBlob(msg.walrusBlobId);
      const { encryptedMessage, nonce, ephemeralPublicKey } = raw as { encryptedMessage: string; nonce: string; ephemeralPublicKey: string };
      if (!secretKey) throw new Error("No secret key");
      const plaintext = decryptSecret(encryptedMessage, nonce, ephemeralPublicKey, secretKey);
      setMessages((p) => p.map((m) => m.id === msg.id ? { ...m, decrypted: plaintext, decrypting: false } : m));
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : "Decryption failed";
      setMessages((p) => p.map((m) => m.id === msg.id ? { ...m, error: err, decrypting: false } : m));
    }
  };

  const handleSelect = (msg: DecryptedMessage) => {
    setSelected(msg.id);
    if (!msg.decrypted && !msg.decrypting && !msg.error) handleDecrypt(msg);
  };

  const selectedMsg = messages.find((m) => m.id === selected);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 h-14 shrink-0" style={{ borderBottom: "1px solid var(--sui-border)" }}>
        <h1 className="text-sm font-semibold text-white">Inbox</h1>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
          style={{ color: "var(--sui-text-dim)", background: "var(--sui-elevated)", border: "1px solid var(--sui-border)" }}
        >
          <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Split pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* Message list */}
        <div className={`flex flex-col overflow-y-auto shrink-0 ${selectedMsg ? "hidden sm:flex w-72" : "flex flex-1 sm:flex-none sm:w-72"}`} style={{ borderRight: "1px solid var(--sui-border)" }}>
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <svg className="w-6 h-6 animate-spin text-blue-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <p className="text-xs" style={{ color: "var(--sui-text-muted)" }}>Scanning chain...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="m-3 p-3 rounded-xl text-xs" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#FCA5A5" }}>
              {error}
            </div>
          )}

          {!loading && !error && messages.length === 0 && <EmptyInbox />}

          <div className="p-2 space-y-1">
            {messages.map((msg, i) => {
              const active = selected === msg.id;
              return (
                <motion.button
                  key={msg.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => handleSelect(msg)}
                  className="w-full text-left p-3 rounded-xl transition-all duration-150"
                  style={{
                    background: active ? "rgba(59,130,246,0.12)" : "transparent",
                    border: `1px solid ${active ? "rgba(59,130,246,0.25)" : "transparent"}`,
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "var(--sui-elevated)"; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5" style={{ background: "linear-gradient(135deg, #1E3A6E, #2563EB)" }}>
                      {(msg.sender || "?").slice(2, 4).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium text-white truncate">{msg.sender ? truncateAddress(msg.sender, 4) : "Unknown"}</span>
                        {msg.decrypted && <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0 ml-1" />}
                      </div>
                      <div className="text-[11px] truncate mb-1" style={{ color: "var(--sui-text-dim)" }}>
                        {msg.decrypted ? msg.decrypted.slice(0, 40) + (msg.decrypted.length > 40 ? "…" : "") : "Encrypted message"}
                      </div>
                      <div className="text-[10px]" style={{ color: "var(--sui-text-muted)" }}>
                        {formatTimestamp(msg.createdAt)}
                      </div>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Detail */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {selectedMsg ? (
            <>
              {/* Mobile back */}
              <div className="sm:hidden flex items-center gap-2 px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--sui-border)" }}>
                <button onClick={() => setSelected(null)} className="flex items-center gap-1.5 text-xs text-blue-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
                  </svg>
                  Back
                </button>
              </div>
              <MessageDetail msg={selectedMsg} onDecrypt={() => handleDecrypt(selectedMsg)} />
            </>
          ) : (
            <div className="flex-1 hidden sm:flex items-center justify-center">
              <div className="text-center">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "var(--sui-elevated)", border: "1px solid var(--sui-border)" }}>
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" style={{ color: "var(--sui-text-muted)" }}>
                    <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-white mb-1">Select a message</p>
                <p className="text-xs" style={{ color: "var(--sui-text-muted)" }}>Decryption happens locally in your browser</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
