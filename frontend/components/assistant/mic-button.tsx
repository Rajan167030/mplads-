"use client";

import { useEffect, useRef, useState } from "react";

// The Web Speech API's SpeechRecognition isn't in TypeScript's lib.dom.d.ts
// under a stable name yet — declare just the surface this component uses.
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: { transcript: string };
}
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Microphone access was blocked — allow it in your browser's address-bar permissions and try again.",
  "service-not-allowed": "Microphone access was blocked — allow it in your browser's address-bar permissions and try again.",
  "no-speech": "Didn't catch any speech — try again and speak right after clicking the mic.",
  "audio-capture": "No microphone found — check that one is connected and not in use by another app.",
  network: "Speech recognition needs an internet connection (it processes audio via the browser's cloud service) — check your connection and try again.",
  aborted: "Listening was stopped before anything was heard.",
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function MicButton({
  onTranscript,
  onError,
}: {
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
}) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(getSpeechRecognitionCtor() !== null);
  }, []);

  function toggle() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-IN";

    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1]?.[0]?.transcript;
      if (transcript) onTranscript(transcript);
    };
    recognition.onerror = (event) => {
      setListening(false);
      onError?.(ERROR_MESSAGES[event.error] ?? `Speech recognition error: ${event.error}`);
    };
    recognition.onend = () => setListening(false);

    try {
      recognitionRef.current = recognition;
      recognition.start();
      setListening(true);
    } catch {
      // start() throws synchronously if recognition is already running/in a
      // bad state — surface it instead of leaving the button stuck.
      onError?.("Could not start the microphone — try clicking the mic button again.");
    }
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      title={listening ? "Stop listening" : "Speak your question"}
      aria-pressed={listening}
      className={`grid size-9 shrink-0 place-items-center rounded-full border text-sm transition ${
        listening
          ? "animate-pulse border-red-300 bg-red-50 text-red-600"
          : "border-dashboard-line text-dashboard-muted hover:bg-dashboard-surface"
      }`}
    >
      {listening ? "◉" : "🎤"}
    </button>
  );
}
