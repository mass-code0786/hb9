"use client";

import { BrowserQRCodeReader, IScannerControls } from "@zxing/browser";
import { CameraOff, Loader2, ScanLine } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/ui/Primitives";

export function QrScanner({ onScan }: { onScan: (value: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [status, setStatus] = useState<"idle" | "starting" | "scanning" | "unsupported" | "denied" | "error">("idle");
  const [message, setMessage] = useState("Camera scanner is ready.");

  const stop = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setStatus("idle");
  };

  async function start() {
    if (!("mediaDevices" in navigator) || !navigator.mediaDevices.getUserMedia) {
      setStatus("unsupported");
      setMessage("Camera scanning is not supported in this browser. Use manual input.");
      return;
    }

    setStatus("starting");
    setMessage("Requesting camera permission...");
    try {
      const reader = new BrowserQRCodeReader();
      controlsRef.current = await reader.decodeFromVideoDevice(undefined, videoRef.current || undefined, (result) => {
        if (!result) return;
        onScan(result.getText());
        setMessage("QR code scanned.");
        stop();
      });
      setStatus("scanning");
      setMessage("Point your camera at a wallet or payment QR.");
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      setStatus(name === "NotAllowedError" ? "denied" : "error");
      setMessage(name === "NotAllowedError" ? "Camera permission denied. Use manual input." : "Could not start camera scanner. Use manual input.");
    }
  }

  useEffect(() => stop, []);

  return (
    <div className="rounded-[1.6rem] border border-white/10 bg-black/25 p-3">
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[1.2rem] bg-black">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        {status !== "scanning" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-center">
            {status === "starting" ? <Loader2 className="animate-spin text-accent" size={38} /> : status === "unsupported" || status === "denied" || status === "error" ? <CameraOff className="text-danger" size={40} /> : <ScanLine className="text-slate-400" size={44} />}
            <p className="mt-3 max-w-56 text-xs leading-5 text-slate-300">{message}</p>
          </div>
        ) : null}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <PrimaryButton type="button" onClick={start} disabled={status === "starting" || status === "scanning"}>{status === "starting" ? "Starting" : "Start Scan"}</PrimaryButton>
        <SecondaryButton type="button" onClick={stop} disabled={status !== "scanning"}>Stop</SecondaryButton>
      </div>
    </div>
  );
}
