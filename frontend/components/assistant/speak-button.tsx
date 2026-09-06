"use client";

import { useEffect, useState } from "react";

export function SpeakButton({ text }: { text: string }) {
  const [supported, setSupported] = useState(true);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  useEffect(() => {
    // Stop speaking if this message unmounts (e.g. conversation switched)
    // mid-utterance, so it doesn't keep talking over the next conversation.
    return () => {
      if (typeof window !== "undefined") window.speechSynthesis.cancel();
    };
  }, []);

  function toggle() {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    // Strip markdown bold/heading marks so TTS doesn't read out asterisks.
    const cleaned = text.replace(/\*\*/g, "").replace(/^#+\s*/gm, "");
    const utterance = new SpeechSynthesisUtterance(cleaned);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      title={speaking ? "Stop reading aloud" : "Read this answer aloud"}
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold ${
        speaking ? "text-dashboard-navy" : "text-dashboard-muted hover:text-dashboard-navy"
      }`}
    >
      {speaking ? "⏸ Stop" : "🔊 Listen"}
    </button>
  );
}
