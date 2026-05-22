"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Volume2, VolumeX } from "lucide-react";

export type HB9VoiceScript = "buy" | "myProductAvailable" | "myProductEmpty" | "activationSuccess" | "deposit" | "withdraw";

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
  buy: "To buy this product, choose your package, confirm the USDT BEP20 payment in your wallet, and wait for activation. After purchase, your product will appear in My Product.",
  myProductAvailable: "Your product is available. You can download unlocked books here, or submit your social link for eligible follower services.",
  myProductEmpty: "No active product found yet. Buy a package to unlock your HB9 digital products.",
  deposit: "Deposit USDT BEP20 on BSC Mainnet. Enter the amount, then confirm the transaction in your wallet browser.",
  withdraw: "Withdraw USDT BEP20 to your wallet. Enter the amount and BEP20 address, review the fee, then submit your withdrawal.",
  activationSuccess: "Congratulations. Your HB9 product is activated successfully. You can now access your product from My Product."
};

function selectFemaleVoice(voices: SpeechSynthesisVoice[]) {
  const preferred = [
    "Google UK English Female",
    "Google US English",
    "Microsoft Zira",
    "Samantha",
    "Karen",
    "Moira",
    "Tessa",
    "Female"
  ];
  return preferred
    .map((name) => voices.find((voice) => voice.name.toLowerCase().includes(name.toLowerCase())))
    .find(Boolean) || voices.find((voice) => voice.lang.toLowerCase().startsWith("en") && /female|woman|zira|samantha|karen|moira|tessa|google/i.test(voice.name)) || voices.find((voice) => voice.lang.toLowerCase().startsWith("en")) || null;
}

export function HB9VoiceAssistant({ activeTab, hasActiveProduct, loading = false, event }: HB9VoiceAssistantProps) {
  const [supported, setSupported] = useState(false);
  const [muted, setMuted] = useState(true);
  const [lastMessage, setLastMessage] = useState(voiceScripts.welcome);
  const [fallbackMessage, setFallbackMessage] = useState("");
  const previousEventId = useRef<number | null>(null);
  const lastPlayedAt = useRef<Record<string, number>>({});
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSupported("speechSynthesis" in window && typeof window.SpeechSynthesisUtterance !== "undefined");
    setMuted(window.localStorage.getItem(VOICE_MUTED_KEY) === "true");
    if ("speechSynthesis" in window) {
      voicesRef.current = window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        voicesRef.current = window.speechSynthesis.getVoices();
      };
    }
  }, []);

  const stop = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
  }, []);

  const speak = useCallback((text: string, fallbackOnError = false) => {
    setLastMessage(text);
    setFallbackMessage("");
    if (typeof window === "undefined" || !("speechSynthesis" in window) || typeof window.SpeechSynthesisUtterance === "undefined") {
      if (fallbackOnError) setFallbackMessage(text);
      return;
    }
    if (window.localStorage.getItem(VOICE_MUTED_KEY) === "true") return;
    try {
      stop();
      window.speechSynthesis.resume();
      const voices = voicesRef.current.length ? voicesRef.current : window.speechSynthesis.getVoices();
      const utterance = new window.SpeechSynthesisUtterance(text);
      utterance.voice = selectFemaleVoice(voices);
      utterance.lang = utterance.voice?.lang || "en-US";
      utterance.rate = 0.9;
      utterance.pitch = 1.12;
      utterance.volume = 1;
      utterance.onerror = () => {
        if (fallbackOnError) setFallbackMessage(text);
      };
      window.speechSynthesis.speak(utterance);
      window.setTimeout(() => {
        if (fallbackOnError && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) setFallbackMessage(text);
      }, 700);
    } catch (err) {
      console.warn("HB9 voice instruction could not play. Showing fallback text instruction.", { err });
      if (fallbackOnError) setFallbackMessage(text);
    }
  }, [stop]);

  const playScript = useCallback((script: HB9VoiceScript) => {
    const text = voiceScripts[script];
    const now = Date.now();
    if (now - (lastPlayedAt.current[script] || 0) < 2500) return;
    lastPlayedAt.current[script] = now;
    setLastMessage(text);
    setFallbackMessage("");
    if (typeof window === "undefined" || !("speechSynthesis" in window) || typeof window.SpeechSynthesisUtterance === "undefined") {
      console.warn("HB9 voice instruction could not play: speech synthesis audio is unavailable. Showing fallback text instruction.", { script });
      setFallbackMessage(text);
      return;
    }
    window.localStorage.removeItem(VOICE_MUTED_KEY);
    setMuted(false);
    try {
      window.speechSynthesis.resume();
      speak(text, true);
    } catch (err) {
      console.warn("HB9 voice instruction could not play. Showing fallback text instruction.", { script, err });
      setFallbackMessage(text);
    }
  }, [speak]);

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

  useEffect(() => {
    if (!fallbackMessage) return;
    const timeout = window.setTimeout(() => setFallbackMessage(""), 4500);
    return () => window.clearTimeout(timeout);
  }, [fallbackMessage]);

  useEffect(() => stop, [stop]);

  const mutedLabel = muted ? "Unmute HB9 voice assistant" : "Mute HB9 voice assistant";
  const canReplay = useMemo(() => supported && Boolean(lastMessage), [lastMessage, supported]);

  if (!supported && !fallbackMessage) return null;

  return (
    <div className="pointer-events-none fixed bottom-[88px] right-4 z-50 flex items-center gap-2 pb-[env(safe-area-inset-bottom)]">
      {fallbackMessage ? <div className="max-w-[16rem] rounded-2xl border border-cyan-200/20 bg-[#061a31]/88 p-3 text-xs font-semibold leading-5 text-cyan-50 shadow-[0_0_18px_rgba(34,211,238,0.18)] backdrop-blur-xl">{fallbackMessage}</div> : null}
      {supported ? (
        <>
          <button
            aria-label="Replay HB9 voice assistant message"
            className="pointer-events-auto hb-interactive hb-glow-cyan grid h-10 w-10 place-items-center rounded-full border border-cyan-200/20 bg-[#061a31]/72 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.22),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl transition disabled:opacity-45"
            disabled={!canReplay}
            onClick={() => speak(lastMessage)}
            title="Replay assistant"
            type="button"
          >
            <RotateCcw size={16} />
          </button>
          <button
            aria-label={mutedLabel}
            className={`pointer-events-auto hb-interactive hb-glow-cyan grid h-11 w-11 place-items-center rounded-full border border-cyan-200/25 bg-[#061a31]/78 text-cyan-100 shadow-[0_0_22px_rgba(34,211,238,0.3),inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-xl transition ${muted ? "text-sky-100/48 shadow-[0_0_14px_rgba(148,163,184,0.12)]" : ""}`}
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
