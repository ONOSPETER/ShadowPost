import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { useWallet } from "@/context/WalletContext";
import { encryptSecret } from "@/lib/crypto";
import { uploadToWalrus, extractBlobId } from "@/lib/walrus";
import { buildSendSecretTx } from "@/lib/contract";
import { lookupKeyRemote } from "@/lib/keyRegistry";

const MAX_FILES = 5;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

type Stage = "idle" | "encrypting" | "uploading" | "committing" | "success" | "error";
type KeyStatus = "idle" | "looking" | "found" | "not-found";

interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;
}

const STAGE_INFO: Record<string, { label: string; desc: string }> = {
  encrypting: { label: "Encrypting",  desc: "Sealing with NaCl box encryption" },
  uploading:  { label: "Uploading",   desc: "Storing on Walrus decentralized storage" },
  committing: { label: "Committing",  desc: "Recording delivery on Sui blockchain" },
};

function FileChip({ file, onRemove }: { file: AttachedFile; onRemove: () => void }) {
  const kb = (file.size / 1024).toFixed(0);
  const ext = file.name.split(".").pop()?.toUpperCase() || "FILE";
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs" style={{ background: "var(--sui-elevated)", border: "1px solid var(--sui-border)" }}>
      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(59,130,246,0.15)", color: "#93C5FD" }}>
        {ext}
      </span>
      <span className="text-white max-w-[120px] truncate">{file.name}</span>
      <span style={{ color: "var(--sui-text-muted)" }}>{kb}KB</span>
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-red-500/20"
        style={{ color: "var(--sui-text-muted)" }}
      >
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
          <path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z" />
        </svg>
      </button>
    </div>
  );
}

function ProgressView({ stage }: { stage: Stage }) {
  const steps = ["encrypting", "uploading", "committing"] as const;
  const idx = steps.indexOf(stage as typeof steps[number]);

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="relative w-14 h-14 mb-8">
        <div className="absolute inset-0 rounded-full" style={{ border: "1.5px solid var(--sui-border)" }} />
        <div className="absolute inset-0 rounded-full border-t-blue-500 border-2 border-transparent animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-blue-400">
            <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
          </svg>
        </div>
      </div>

      <h2 className="text-base font-bold text-white mb-1">{STAGE_INFO[stage]?.label}</h2>
      <p className="text-sm mb-8" style={{ color: "var(--sui-text-dim)" }}>{STAGE_INFO[stage]?.desc}</p>

      {stage === "committing" && (
        <p className="text-xs mb-6 text-center" style={{ color: "var(--sui-text-muted)" }}>
          Approve the transaction in your wallet…
        </p>
      )}

      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all"
              style={{
                background: i < idx ? "rgba(59,130,246,0.3)" : i === idx ? "rgba(59,130,246,0.8)" : "var(--sui-elevated)",
                border: i <= idx ? "1px solid rgba(59,130,246,0.5)" : "1px solid var(--sui-border)",
                color: i <= idx ? "#93C5FD" : "var(--sui-text-muted)",
              }}
            >
              {i < idx ? "✓" : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div className="w-8 h-px" style={{ background: i < idx ? "rgba(59,130,246,0.4)" : "var(--sui-border)" }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SuccessView({ blobId, txDigest, onReset }: { blobId?: string; txDigest?: string; onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
        style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)" }}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-7 h-7 text-green-400">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h2 className="text-xl font-bold text-white mb-2">Secret Delivered</h2>
        <p className="text-sm mb-8" style={{ color: "var(--sui-text-dim)" }}>
          Encrypted, stored on Walrus, and recorded on Sui
        </p>

        <div className="space-y-3 mb-8 text-left max-w-sm mx-auto">
          {blobId && (
            <div className="rounded-xl p-4" style={{ background: "var(--sui-elevated)", border: "1px solid var(--sui-border)" }}>
              <div className="text-[10px] uppercase tracking-wider mb-1.5 font-medium" style={{ color: "var(--sui-text-muted)" }}>Walrus Blob ID</div>
              <div className="text-xs font-mono break-all text-blue-400">{blobId}</div>
            </div>
          )}
          {txDigest && (
            <div className="rounded-xl p-4" style={{ background: "var(--sui-elevated)", border: "1px solid var(--sui-border)" }}>
              <div className="text-[10px] uppercase tracking-wider mb-1.5 font-medium" style={{ color: "var(--sui-text-muted)" }}>Sui Transaction</div>
              <a
                href={`https://suiscan.xyz/mainnet/tx/${txDigest}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono break-all text-blue-400 hover:text-blue-300 transition-colors"
              >
                {txDigest.slice(0, 20)}…{txDigest.slice(-8)}
              </a>
            </div>
          )}
        </div>

        <button
          onClick={onReset}
          className="px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
          style={{ background: "var(--sui-elevated)", border: "1px solid var(--sui-border)", color: "var(--sui-text)" }}
        >
          Compose Another
        </button>
      </motion.div>
    </div>
  );
}

export default function UploadPage() {
  const { address, secretKey, isDerivingKey } = useWallet();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const [recipient, setRecipient] = useState("");
  const [keyStatus, setKeyStatus] = useState<KeyStatus>("idle");
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const [showManualKey, setShowManualKey] = useState(false);
  const [manualKey, setManualKey] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blobId?: string; txDigest?: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Async lookup of recipient encryption key from server registry
  useEffect(() => {
    const addr = recipient.trim();
    if (!addr || addr.length < 10 || !addr.startsWith("0x")) {
      setKeyStatus("idle");
      setResolvedKey(null);
      return;
    }

    let cancelled = false;
    setKeyStatus("looking");

    lookupKeyRemote(addr).then((key) => {
      if (cancelled) return;
      if (key) {
        setResolvedKey(key);
        setKeyStatus("found");
      } else {
        setResolvedKey(null);
        setKeyStatus("not-found");
      }
    });

    return () => { cancelled = true; };
  }, [recipient]);

  const effectiveKey = resolvedKey || (showManualKey ? manualKey : null);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    const errs: string[] = [];

    for (const f of arr) {
      if (files.length >= MAX_FILES) { errs.push(`Max ${MAX_FILES} files`); break; }
      if (f.size > MAX_FILE_SIZE) { errs.push(`${f.name} exceeds 2MB`); continue; }

      const reader = new FileReader();
      reader.onload = (e) => {
        setFiles((prev) => {
          if (prev.length >= MAX_FILES) return prev;
          return [...prev, { id: crypto.randomUUID(), name: f.name, size: f.size, type: f.type, dataUrl: e.target?.result as string }];
        });
      };
      reader.readAsDataURL(f);
    }

    if (errs.length) setError(errs.join(" · "));
  }, [files.length]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() && files.length === 0) return;
    if (!effectiveKey) { setError("Recipient key required"); return; }
    if (!secretKey) { setError("Your encryption key is not ready yet"); return; }

    setError(null);
    setResult(null);

    try {
      // Step 1: Encrypt
      setStage("encrypting");
      await new Promise((r) => setTimeout(r, 600));

      const filePayloads = files.map((f) => ({ name: f.name, size: f.size, type: f.type, data: f.dataUrl }));
      const fullMessage = JSON.stringify({ text: message, files: filePayloads });
      const encrypted = encryptSecret(fullMessage, effectiveKey);

      const payload = {
        ...encrypted,
        sender: address,
        recipient,
        created_at: Math.floor(Date.now() / 1000),
      };

      // Step 2: Upload to Walrus (via server-side proxy)
      setStage("uploading");
      const walrusResult = await uploadToWalrus(payload);
      const blobId = extractBlobId(walrusResult);
      if (!blobId) throw new Error("Walrus returned no blob ID");

      // Step 3: Commit on Sui
      setStage("committing");
      const tx = buildSendSecretTx({
        recipient: recipient || address || "0x0",
        walrusBlobId: blobId,
      });

      const { digest } = await signAndExecuteTransaction({ transaction: tx });

      setStage("success");
      setResult({ blobId, txDigest: digest });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to send";
      setError(msg.includes("Rejected") || msg.includes("reject") ? "Transaction rejected in wallet" : msg);
      setStage("error");
    }
  };

  const reset = () => {
    setStage("idle");
    setError(null);
    setResult(null);
    setMessage("");
    setRecipient("");
    setResolvedKey(null);
    setKeyStatus("idle");
    setManualKey("");
    setShowManualKey(false);
    setFiles([]);
  };

  if (stage === "success") return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      <div className="flex items-center px-5 h-14 shrink-0" style={{ borderBottom: "1px solid var(--sui-border)" }}>
        <h1 className="text-sm font-semibold text-white">Compose</h1>
      </div>
      <SuccessView blobId={result?.blobId} txDigest={result?.txDigest} onReset={reset} />
    </div>
  );

  if (["encrypting", "uploading", "committing"].includes(stage)) return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      <div className="flex items-center px-5 h-14 shrink-0" style={{ borderBottom: "1px solid var(--sui-border)" }}>
        <h1 className="text-sm font-semibold text-white">Compose</h1>
      </div>
      <ProgressView stage={stage} />
    </div>
  );

  const canSend = (message.trim().length > 0 || files.length > 0) && !!effectiveKey && !!secretKey;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-5 h-14 shrink-0" style={{ borderBottom: "1px solid var(--sui-border)" }}>
        <h1 className="text-sm font-semibold text-white">Compose Secret</h1>
        {isDerivingKey && (
          <div className="ml-3 flex items-center gap-1.5 text-[11px]" style={{ color: "var(--sui-text-muted)" }}>
            <div className="w-3 h-3 rounded-full border border-blue-400 border-t-transparent animate-spin" />
            Deriving your key…
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
        <div className="overflow-y-auto flex-1">
          <div className="max-w-2xl mx-auto px-5 py-5 space-y-0" style={{ borderBottom: "1px solid var(--sui-border)" }}>
            {/* From */}
            <div className="flex items-start gap-3 py-3" style={{ borderBottom: "1px solid var(--sui-border)" }}>
              <span className="text-xs font-medium pt-0.5 w-24 shrink-0" style={{ color: "var(--sui-text-dim)" }}>From</span>
              <span className="text-xs font-mono text-blue-400 break-all">{address || "—"}</span>
            </div>

            {/* To — with async key lookup indicator */}
            <div style={{ borderBottom: "1px solid var(--sui-border)" }}>
              <div className="flex items-center gap-3 py-3">
                <label className="text-xs font-medium w-24 shrink-0" style={{ color: "var(--sui-text-dim)" }}>To</label>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="0x… recipient Sui address"
                  className="flex-1 bg-transparent text-sm text-white placeholder-transparent outline-none min-w-0"
                  style={{ caretColor: "#3B82F6" }}
                />
                {/* Key status badge */}
                <AnimatePresence mode="wait">
                  {keyStatus === "looking" && (
                    <motion.span
                      key="looking"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="shrink-0 flex items-center gap-1.5 text-[11px] font-medium"
                      style={{ color: "var(--sui-text-muted)" }}
                    >
                      <span className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin" />
                      Looking up…
                    </motion.span>
                  )}
                  {keyStatus === "found" && (
                    <motion.span
                      key="found"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="shrink-0 flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", color: "#4ade80" }}
                    >
                      <svg viewBox="0 0 12 12" fill="currentColor" className="w-2.5 h-2.5">
                        <path fillRule="evenodd" d="M10.293 2.293a1 1 0 011.414 1.414l-6 6a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L5 7.586l5.293-5.293z" clipRule="evenodd" />
                      </svg>
                      Key found
                    </motion.span>
                  )}
                  {keyStatus === "not-found" && (
                    <motion.span
                      key="notfound"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="shrink-0 flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", color: "#fbbf24" }}
                    >
                      <svg viewBox="0 0 12 12" fill="currentColor" className="w-2.5 h-2.5">
                        <path fillRule="evenodd" d="M6 1a5 5 0 100 10A5 5 0 006 1zm0 4a.75.75 0 01.75.75v2a.75.75 0 01-1.5 0v-2A.75.75 0 016 5zm0-1.5a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                      </svg>
                      Not registered
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              {/* Key not found helper */}
              <AnimatePresence>
                {keyStatus === "not-found" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pb-3 pl-[6.25rem]">
                      <p className="text-[11px] mb-2" style={{ color: "var(--sui-text-muted)" }}>
                        Recipient hasn't connected to ShadowPost yet. Ask them to open the app once — their key registers automatically. Or paste it manually:
                      </p>
                      {!showManualKey ? (
                        <button
                          type="button"
                          onClick={() => setShowManualKey(true)}
                          className="text-[11px] underline underline-offset-2 transition-colors"
                          style={{ color: "var(--sui-blue-bright)" }}
                        >
                          Paste key manually
                        </button>
                      ) : (
                        <input
                          type="text"
                          value={manualKey}
                          onChange={(e) => setManualKey(e.target.value)}
                          placeholder="Base64 NaCl public key…"
                          className="w-full bg-transparent text-[11px] font-mono outline-none"
                          style={{ color: "var(--sui-text-dim)", caretColor: "#3B82F6" }}
                          autoFocus
                        />
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Message body */}
          <div className="max-w-2xl mx-auto px-5 py-5">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your secret message…"
              rows={8}
              className="w-full bg-transparent text-sm outline-none resize-none leading-relaxed"
              style={{ color: "var(--sui-text)", caretColor: "#3B82F6" }}
            />
          </div>
        </div>

        {/* Bottom bar */}
        <div className="shrink-0 px-5 pb-5 max-w-2xl mx-auto w-full">
          {/* File chips */}
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {files.map((f) => (
                <FileChip key={f.id} file={f} onRemove={() => setFiles((p) => p.filter((x) => x.id !== f.id))} />
              ))}
            </div>
          )}

          {/* Error */}
          {(error || stage === "error") && (
            <div className="mb-3 px-3 py-2.5 rounded-xl text-xs" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#FCA5A5" }}>
              {error || "Something went wrong. Please try again."}
            </div>
          )}

          {/* Drop zone */}
          <AnimatePresence>
            {dragOver && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-3 rounded-xl flex items-center justify-center py-6 text-sm text-blue-400"
                style={{ background: "rgba(59,130,246,0.08)", border: "1.5px dashed rgba(59,130,246,0.35)" }}
              >
                Drop files here
              </motion.div>
            )}
          </AnimatePresence>

          {/* Toolbar */}
          <div
            className="rounded-2xl p-1.5"
            style={{ background: "var(--sui-card)", border: "1px solid var(--sui-border)" }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <div className="flex items-center gap-1 px-2 pb-1.5">
              {/* Attach */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="*/*"
                className="hidden"
                onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={files.length >= MAX_FILES}
                title={`Attach files (max ${MAX_FILES}, 2MB each)`}
                className="p-2 rounded-xl transition-colors disabled:opacity-30"
                style={{ color: "var(--sui-text-dim)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#60A5FA")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--sui-text-dim)")}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-[18px] h-[18px]">
                  <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd" />
                </svg>
              </button>

              {files.length > 0 && (
                <span className="text-[11px] px-1.5" style={{ color: "var(--sui-text-dim)" }}>
                  {files.length}/{MAX_FILES} files
                </span>
              )}

              <div className="ml-auto flex items-center gap-2">
                <span className="text-[11px] font-mono" style={{ color: "var(--sui-text-muted)" }}>
                  {message.length} chars
                </span>

                <button
                  type="submit"
                  disabled={!canSend}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed disabled:transform-none"
                  style={{ background: "linear-gradient(135deg, #2563EB, #1D4ED8)" }}
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                  Send
                </button>
              </div>
            </div>
          </div>

          <p className="text-center text-[10px] mt-2.5" style={{ color: "var(--sui-text-muted)" }}>
            Encrypted locally · Stored on Walrus · Delivered via Sui
          </p>
        </div>
      </form>
    </div>
  );
}
