"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RotateCcw, Volume2, VolumeX } from "lucide-react";

export type HB9VoiceScript = "buy" | "myProductAvailable" | "myProductEmpty" | "activationSuccess" | "deposit" | "withdraw";

export type HB9VoiceEvent = {
  script: HB9VoiceScript;
  id: number;
} | null;

declare global {
  interface Window {
    __hb9PlayVoiceInstruction?: (script: HB9VoiceScript) => void;
    webkitAudioContext?: typeof AudioContext;
  }
}

type HB9VoiceAssistantProps = {
  activeTab: "home" | "products" | "team" | "income" | "wallet" | "packages";
  hasActiveProduct: boolean;
  loading?: boolean;
  event?: HB9VoiceEvent;
};

const VOICE_MUTED_KEY = "hb9.voiceMuted";
const AUDIO_BLOCKED_TOAST = "Tap speaker again to play audio";
const SILENT_AUDIO_SRC = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQQAAAAAAA==";
const voiceScripts: Record<HB9VoiceScript | "welcome", string> = {
  welcome: "Welcome to HB9. How can I help you?",
  buy: "To buy this product, choose your package, confirm the USDT BEP20 payment in your wallet, and wait for activation. After purchase, your product will appear in My Product.",
  myProductAvailable: "Your product is available. You can download unlocked books here, or submit your social link for eligible follower services.",
  myProductEmpty: "No active product found yet. Buy a package to unlock your HB9 digital products.",
  deposit: "Deposit USDT BEP20 on BSC Mainnet. Enter the amount, confirm the wallet transaction, and HB9 will verify the transaction automatically.",
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
  const [audioLoading, setAudioLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [lastMessage, setLastMessage] = useState(voiceScripts.welcome);
  const [fallbackMessage, setFallbackMessage] = useState("");
  const previousEventId = useRef<number | null>(null);
  const lastPlayedAt = useRef<Record<string, number>>({});
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSupported("Audio" in window && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance !== "undefined");
    setMuted(window.localStorage.getItem(VOICE_MUTED_KEY) === "true");
    if ("speechSynthesis" in window) {
      voicesRef.current = window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        voicesRef.current = window.speechSynthesis.getVoices();
      };
    }
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    activeUtteranceRef.current = null;
    setAudioLoading(false);
    setPlaying(false);
  }, []);

  const ensureGestureAudio = useCallback(async () => {
    if (typeof window === "undefined") return;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (AudioContextCtor) {
      audioContextRef.current ||= new AudioContextCtor();
      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }
    }
    if (!audioRef.current) {
      audioRef.current = new Audio(SILENT_AUDIO_SRC);
      audioRef.current.preload = "auto";
      audioRef.current.setAttribute("playsinline", "true");
    }
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    await audioRef.current.play().catch((err) => {
      console.warn("HB9 audio unlock was blocked by the browser.", { err });
      setFallbackMessage(AUDIO_BLOCKED_TOAST);
      throw err;
    });
  }, []);

  const primeAudioOnTouch = useCallback(() => {
    if (typeof window === "undefined") return;
    if (playing || audioLoading) return;
    void ensureGestureAudio().catch(() => undefined);
  }, [audioLoading, ensureGestureAudio, playing]);

  const speakFromUserGesture = useCallback(async (text: string, fallbackOnError = false) => {
    setLastMessage(text);
    setFallbackMessage("");
    setAudioLoading(true);
    if (typeof window === "undefined" || !("Audio" in window) || !("speechSynthesis" in window) || typeof window.SpeechSynthesisUtterance === "undefined") {
      if (fallbackOnError) setFallbackMessage(text);
      setAudioLoading(false);
      return;
    }
    try {
      stop();
      setAudioLoading(true);
      await ensureGestureAudio();
      window.localStorage.removeItem(VOICE_MUTED_KEY);
      setMuted(false);
      window.speechSynthesis.resume();
      const voices = voicesRef.current.length ? voicesRef.current : window.speechSynthesis.getVoices();
      const utterance = new window.SpeechSynthesisUtterance(text);
      activeUtteranceRef.current = utterance;
      utterance.voice = selectFemaleVoice(voices);
      utterance.lang = utterance.voice?.lang || "en-US";
      utterance.rate = 0.9;
      utterance.pitch = 1.12;
      utterance.volume = 1;
      utterance.onstart = () => {
        setAudioLoading(false);
        setPlaying(true);
      };
      utterance.onend = () => {
        if (activeUtteranceRef.current === utterance) activeUtteranceRef.current = null;
        setAudioLoading(false);
        setPlaying(false);
      };
      utterance.onerror = () => {
        if (activeUtteranceRef.current === utterance) activeUtteranceRef.current = null;
        setAudioLoading(false);
        setPlaying(false);
        if (fallbackOnError) setFallbackMessage(text);
      };
      window.speechSynthesis.speak(utterance);
      window.setTimeout(() => {
        if (fallbackOnError && activeUtteranceRef.current === utterance && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
          setPlaying(false);
          setAudioLoading(false);
          setFallbackMessage(text);
        }
      }, 700);
    } catch (err) {
      console.warn("HB9 voice instruction could not play. Showing fallback text instruction.", { err });
      setAudioLoading(false);
      setPlaying(false);
      if (fallbackOnError) setFallbackMessage(AUDIO_BLOCKED_TOAST);
    }
  }, [ensureGestureAudio, stop]);

  const playScript = useCallback((script: HB9VoiceScript) => {
    const text = voiceScripts[script];
    const now = Date.now();
    if (now - (lastPlayedAt.current[script] || 0) < 2500) return;
    lastPlayedAt.current[script] = now;
    setLastMessage(text);
    setFallbackMessage("");
  }, []);

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

  const togglePlayback = useCallback(() => {
    if (playing || audioLoading) {
      window.localStorage.setItem(VOICE_MUTED_KEY, "true");
      setMuted(true);
      stop();
      return;
    }
    void speakFromUserGesture(lastMessage, true);
  }, [audioLoading, lastMessage, playing, speakFromUserGesture, stop]);

  const replay = useCallback(() => {
    if (!lastMessage || audioLoading) return;
    stop();
    void speakFromUserGesture(lastMessage, true);
  }, [audioLoading, lastMessage, speakFromUserGesture, stop]);

  const speakerLabel = playing ? "Pause HB9 voice assistant" : "Play HB9 voice assistant message";
  const canReplay = useMemo(() => supported && Boolean(lastMessage) && !audioLoading, [audioLoading, lastMessage, supported]);

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
            onClick={replay}
            onTouchStart={primeAudioOnTouch}
            title="Replay assistant"
            type="button"
          >
            <RotateCcw size={16} />
          </button>
          <button
            aria-label={speakerLabel}
            className={`pointer-events-auto hb-interactive hb-glow-cyan grid h-11 w-11 place-items-center rounded-full border border-cyan-200/25 bg-[#061a31]/78 text-cyan-100 shadow-[0_0_22px_rgba(34,211,238,0.3),inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-xl transition ${muted && !playing ? "text-sky-100/48 shadow-[0_0_14px_rgba(148,163,184,0.12)]" : ""}`}
            onClick={togglePlayback}
            onTouchStart={primeAudioOnTouch}
            title={playing ? "Voice playing" : "Play voice"}
            type="button"
          >
            {audioLoading ? <Loader2 className="animate-spin" size={18} /> : playing ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        </>
      ) : null}
    </div>
  );
}
