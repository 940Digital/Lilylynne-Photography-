"use client";

import { useState } from "react";

export function CopyButton({ path, label = "Copy link" }: { path: string; label?: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    const url = new URL(path, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copy this link:", url);
    }
    setDone(true);
    setTimeout(() => setDone(false), 1800);
  }
  return (
    <button type="button" onClick={copy} className="btn">
      {done ? "Copied" : label}
    </button>
  );
}
