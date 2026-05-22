"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Volume2, VolumeX } from "lucide-react";

export type HB9VoiceScript = "buy" | "myProductAvailable" | "myProductEmpty" | "activationSuccess";

export type HB9VoiceEvent = {
  script: HB9VoiceScript;
  id: number;
} | null;

declare global {
  interface Window {
    __hb9PlayVoiceInstruction?: (script: HB9VoiceScript) => void;
  }
}

type HB9VoiceAssistantProps = {
  activeTab: "home" | "products" | "team" | "income" | "wallet" | "packages";
  hasActiveProduct: boolean;
  loading?: boolean;
  event?: HB9VoiceEvent;
};

const VOICE_MUTED_KEY = "hb9.voiceMuted";
const voiceScripts: Record<HB9VoiceScript | "welcome", string> = {
  welcome: "Welcome to HB9. How can I help you?",
  buy: "To buy this product, select your package, connect your wallet, confirm USDT BEP20 payment, and wait for activation. After successful purchase, your product will appear in My Product.",
  myProductAvailable: "Your product is available. Download your unlocked books here. To receive followers, paste your Instagram, Facebook, or Telegram link and send your request.",
  myProductEmpty: "No active product found. Buy a package to unlock your HB9 digital products.",
  activationSuccess: "Congratulations. Your HB9 product is activated successfully. You can now access your product from My Product."
};

export function HB9VoiceAssistant({ activeTab, hasActiveProduct, loading = false, event }: HB9VoiceAssistantProps) {
  const [supported, setSupported] = useState(false);
  const [muted, setMuted] = useState(true);
  const [lastMessage, setLastMessage] = useState(voiceScripts.welcome);
  const [fallbackMessage, setFallbackMessage] = useState("");
  const previousEventId = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSupported("speechSynthesis" in window && typeof window.SpeechSynthesisUtterance !== "undefined");
    setMuted(window.localStorage.getItem(VOICE_MUTED_KEY) === "true");
  }, []);

  const stop = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
  }, []);

  const speak = useCallback((text: string) => {
    setLastMessage(text);
    setFallbackMessage("");
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (window.localStorage.getItem(VOICE_MUTED_KEY) === "true") return;
    stop();
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.rate = 0.94;
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  }, [stop]);

  const playScript = useCallback((script: HB9VoiceScript) => {
    const text = voiceScripts[script];
    setLastMessage(text);
    setFallbackMessage("");
    if (typeof window === "undefined" || !("speechSynthesis" in window) || typeof window.SpeechSynthesisUtterance === "undefined") {
      console.warn("HB9 voice instruction could not play: speech synthesis audio is unavailable. Showing fallback text instruction.", { script });
      setFallbackMessage(text);
      return;
    }
    if (window.localStorage.getItem(VOICE_MUTED_KEY) === "true") {
      setFallbackMessage(text);
      return;
    }
    try {
      stop();
      const utterance = new window.SpeechSynthesisUtterance(text);
      utterance.rate = 0.94;
      utterance.pitch = 1;
      utterance.volume = 1;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("HB9 voice instruction could not play. Showing fallback text instruction.", { script, err });
      setFallbackMessage(text);
    }
  }, [stop]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.__hb9PlayVoiceInstruction = playScript;
    return () => {
      if (window.__hb9PlayVoiceInstruction === playScript) delete window.__hb9PlayVoiceInstruction;
    };
  }, [playScript]);

  useEffect(() => {
    if (!supported) return;
    stop();
  }, [activeTab, stop, supported]);

  useEffect(() => {
    if (!supported || !event || previousEventId.current === event.id) return;
    previousEventId.current = event.id;
    playScript(event.script);
  }, [event, playScript, supported]);

  useEffect(() => stop, [stop]);

  const mutedLabel = muted ? "Unmute HB9 voice assistant" : "Mute HB9 voice assistant";
  const canReplay = useMemo(() => supported && Boolean(lastMessage), [lastMessage, supported]);

  if (!supported && !fallbackMessage) return null;

  return (
    <div className="fixed bottom-[88px] right-4 z-50 flex items-center gap-2 pb-[env(safe-area-inset-bottom)]">
      {fallbackMessage ? <div className="max-w-[16rem] rounded-2xl border border-cyan-200/20 bg-[#061a31]/88 p-3 text-xs font-semibold leading-5 text-cyan-50 shadow-[0_0_18px_rgba(34,211,238,0.18)] backdrop-blur-xl">{fallbackMessage}</div> : null}
      {supported ? (
        <>
          <button
            aria-label="Replay HB9 voice assistant message"
            className="hb-interactive hb-glow-cyan grid h-10 w-10 place-items-center rounded-full border border-cyan-200/20 bg-[#061a31]/72 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.22),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl transition disabled:opacity-45"
            disabled={!canReplay}
            onClick={() => speak(lastMessage)}
            title="Replay assistant"
            type="button"
          >
            <RotateCcw size={16} />
          </button>
          <button
            aria-label={mutedLabel}
            className={`hb-interactive hb-glow-cyan grid h-11 w-11 place-items-center rounded-full border border-cyan-200/25 bg-[#061a31]/78 text-cyan-100 shadow-[0_0_22px_rgba(34,211,238,0.3),inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-xl transition ${muted ? "text-sky-100/48 shadow-[0_0_14px_rgba(148,163,184,0.12)]" : ""}`}
            onClick={() => {
              const nextMuted = !muted;
              setMuted(nextMuted);
              window.localStorage.setItem(VOICE_MUTED_KEY, String(nextMuted));
              if (nextMuted) stop();
            }}
            title={muted ? "Voice muted" : "Voice on"}
            type="button"
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </>
      ) : null}
    </div>
  );
}
