import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useWallet } from "@/context/WalletContext";
import { truncateAddress } from "@/lib/utils";

const nav = [
  {
    href: "/dashboard",
    label: "Inbox",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-[18px] h-[18px]">
        <path fillRule="evenodd" d="M2.94 6.412A2 2 0 002 8.108V16a2 2 0 002 2h12a2 2 0 002-2V8.108a2 2 0 00-.94-1.696l-6-3.75a2 2 0 00-2.12 0l-6 3.75zm2.615 2.423a1 1 0 10-1.11 1.664l5 3.333a1 1 0 001.11 0l5-3.333a1 1 0 00-1.11-1.664L10 12.027 5.555 8.835z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    href: "/upload",
    label: "Compose",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-[18px] h-[18px]">
        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
      </svg>
    ),
  },
  {
    href: "/sent",
    label: "Sent",
    disabled: true,
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-[18px] h-[18px]">
        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
      </svg>
    ),
  },
];

function SidebarContent({
  expanded,
  onClose,
}: {
  expanded: boolean;
  onClose: () => void;
}) {
  const [location, setLocation] = useLocation();
  const { address, publicKey, walletName, isDerivingKey, disconnect } = useWallet();
  const [copied, setCopied] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);

  const navigate = (href: string) => {
    setLocation(href);
    onClose();
  };

  const copyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const copyKey = () => {
    if (!publicKey) return;
    navigator.clipboard.writeText(publicKey).then(() => {
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 1500);
    });
  };

  const showLabels = expanded;

  return (
    <>
      {/* Nav */}
      <nav className="flex-1 py-3 px-1.5 sm:px-2 space-y-0.5 overflow-y-auto">
        {nav.map((item) => {
          const active = location === item.href;
          return (
            <button
              key={item.href}
              onClick={() => !item.disabled && navigate(item.href)}
              disabled={item.disabled}
              title={item.label}
              className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                active
                  ? "text-white font-medium"
                  : item.disabled
                  ? "opacity-30 cursor-not-allowed"
                  : "hover:text-white"
              }`}
              style={{
                background: active ? "rgba(59,130,246,0.15)" : "transparent",
                border: active ? "1px solid rgba(59,130,246,0.2)" : "1px solid transparent",
                color: active ? "white" : "var(--sui-text-dim)",
              }}
            >
              <span className={`shrink-0 ${active ? "text-blue-400" : ""}`}>{item.icon}</span>
              {showLabels && (
                <span className="truncate">{item.label}</span>
              )}
              {item.disabled && showLabels && (
                <span className="ml-auto text-[10px] font-mono opacity-60">soon</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Wallet panel — only when expanded */}
      {showLabels && (
        <div className="px-2 pb-4" style={{ borderTop: "1px solid var(--sui-border)" }}>
          <div
            className="mt-3 rounded-xl px-2.5 py-3"
            style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.12)" }}
          >
            <div className="flex items-center gap-1.5 mb-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
              <span
                className="text-[10px] font-medium uppercase tracking-wider truncate"
                style={{ color: "var(--sui-text-dim)" }}
              >
                {walletName || "Connected"}
              </span>
            </div>

            <button onClick={copyAddress} title="Copy address" className="w-full text-left mb-1">
              <div className="text-[11px] font-mono text-blue-400 leading-relaxed hover:text-blue-300 transition-colors">
                {address ? truncateAddress(address, 8) : "—"}
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: "var(--sui-text-muted)" }}>
                {copied ? "✓ Copied" : "Tap to copy"}
              </div>
            </button>

            <div className="mt-2.5 pt-2.5" style={{ borderTop: "1px solid rgba(59,130,246,0.1)" }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--sui-text-muted)" }}>
                  Enc. Key
                </span>
                {isDerivingKey ? (
                  <span className="text-[10px]" style={{ color: "var(--sui-text-muted)" }}>
                    Deriving…
                  </span>
                ) : publicKey ? (
                  <button
                    onClick={copyKey}
                    className="text-[10px] transition-colors"
                    style={{ color: keyCopied ? "#4ade80" : "var(--sui-blue-bright)" }}
                  >
                    {keyCopied ? "✓ Copied" : "Copy"}
                  </button>
                ) : null}
              </div>
              <div
                className="text-[10px] font-mono leading-relaxed truncate"
                style={{ color: isDerivingKey ? "var(--sui-text-muted)" : "var(--sui-text-dim)" }}
              >
                {isDerivingKey ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full border border-blue-500 border-t-transparent animate-spin shrink-0" />
                    Signing…
                  </span>
                ) : publicKey ? (
                  publicKey.slice(0, 22) + "…"
                ) : (
                  "—"
                )}
              </div>
              <p className="text-[9px] mt-1 leading-relaxed" style={{ color: "var(--sui-text-muted)" }}>
                Share so others can encrypt for you
              </p>
            </div>

            <button
              onClick={disconnect}
              className="w-full text-[11px] py-1.5 rounded-lg mt-3 transition-colors text-center"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--sui-border)",
                color: "var(--sui-text-dim)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = "#f87171";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(248,113,113,0.3)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = "var(--sui-text-dim)";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--sui-border)";
              }}
            >
              Disconnect
            </button>
          </div>
        </div>
      )}

      {/* Mobile: disconnect icon when collapsed */}
      {!showLabels && (
        <div className="pb-3 px-1.5">
          <button
            onClick={disconnect}
            title="Disconnect"
            className="w-full flex justify-center py-2 rounded-lg"
            style={{ color: "var(--sui-text-dim)" }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-red-400 opacity-60">
              <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const headerStyle = {
    borderBottom: "1px solid var(--sui-border)",
  } as const;

  const asideStyle = {
    background: "var(--sui-surface)",
    borderRight: "1px solid var(--sui-border)",
  } as const;

  return (
    <>
      {/* ── MOBILE: backdrop ────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="backdrop"
            className="sm:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── MOBILE: slide-in drawer ─────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            key="drawer"
            className="sm:hidden fixed inset-y-0 left-0 z-50 flex flex-col w-64"
            style={asideStyle}
            initial={{ x: -260 }}
            animate={{ x: 0 }}
            exit={{ x: -260 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between px-4 h-14 shrink-0" style={headerStyle}>
              <div className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.25)" }}
                >
                  <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
                    <path d="M10 2L3 6.5v7L10 18l7-4.5v-7L10 2z" stroke="#60A5FA" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M10 2v16M3 6.5l7 4.5 7-4.5" stroke="#60A5FA" strokeWidth="1" strokeOpacity="0.4" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-white tracking-wide">ShadowPost</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg"
                style={{ color: "var(--sui-text-dim)" }}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <SidebarContent expanded={true} onClose={() => setMobileOpen(false)} />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── MOBILE: collapsed strip (always visible) ────── */}
      <div
        className="sm:hidden flex flex-col w-14 shrink-0 h-screen sticky top-0 z-10"
        style={asideStyle}
      >
        {/* Hamburger toggle */}
        <button
          onClick={() => setMobileOpen(true)}
          className="flex items-center justify-center h-14 shrink-0 w-full"
          style={headerStyle}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" style={{ color: "var(--sui-text-dim)" }}>
            <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        </button>
        <SidebarContent expanded={false} onClose={() => setMobileOpen(false)} />
      </div>

      {/* ── DESKTOP: full sidebar (always visible) ──────── */}
      <motion.aside
        initial={{ x: -8, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="hidden sm:flex flex-col w-56 shrink-0 h-screen sticky top-0"
        style={asideStyle}
      >
        <div className="flex items-center gap-3 px-4 h-14 shrink-0" style={headerStyle}>
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.25)" }}
          >
            <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
              <path d="M10 2L3 6.5v7L10 18l7-4.5v-7L10 2z" stroke="#60A5FA" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M10 2v16M3 6.5l7 4.5 7-4.5" stroke="#60A5FA" strokeWidth="1" strokeOpacity="0.4" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-white tracking-wide truncate">ShadowPost</span>
        </div>
        <SidebarContent expanded={true} onClose={() => {}} />
      </motion.aside>
    </>
  );
}
