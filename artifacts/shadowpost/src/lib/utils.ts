import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function truncateAddress(addr: string, chars = 6): string {
  if (!addr) return "";
  return `${addr.slice(0, chars + 2)}...${addr.slice(-chars)}`;
}

export function formatTimestamp(ts: number): string {
  if (!ts) return "Unknown";
  const d = new Date(ts * 1000);
  return d.toLocaleString();
}
