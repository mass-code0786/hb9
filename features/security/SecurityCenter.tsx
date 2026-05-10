"use client";

import { Eye, EyeOff, KeyRound, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { clearPin, createPinRecord, isValidPin, savePin } from "@/lib/security";
import type { BackupStatus } from "@/lib/security";
import { shortAddress } from "@/lib/wallet";
import { Panel, PrimaryButton, SecondaryButton, Select } from "@/components/ui/Primitives";
import { useSettingsStore } from "@/store/settingsStore";

export function SecurityCenter({
  address,
  backupStatus,
  pinEnabled,
  deleteConfirming,
  onPinChanged,
  onVerifyBackup,
  onRevealSeed,
  onDeleteLocalWallet
}: {
  address: string;
  backupStatus: BackupStatus;
  pinEnabled: boolean;
  deleteConfirming: boolean;
  onPinChanged: () => void;
  onVerifyBackup: () => void;
  onRevealSeed: (password: string) => Promise<string>;
  onDeleteLocalWallet: () => void;
}) {
  const settings = useSettingsStore();
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinMessage, setPinMessage] = useState("");
  const [seedPassword, setSeedPassword] = useState("");
  const [seedVisible, setSeedVisible] = useState(false);
  const [seedPhrase, setSeedPhrase] = useState("");
  const [seedError, setSeedError] = useState("");

  async function saveNewPin() {
    setPinMessage("");
    if (!isValidPin(pin)) {
      setPinMessage("Use a 4 to 6 digit PIN.");
      return;
    }
    if (pin !== pinConfirm) {
      setPinMessage("PIN entries do not match.");
      return;
    }
    savePin(await createPinRecord(pin));
    setPin("");
    setPinConfirm("");
    setPinMessage("PIN lock enabled.");
    onPinChanged();
  }

  function removePin() {
    clearPin();
    setPinMessage("PIN lock removed.");
    onPinChanged();
  }

  async function revealSeed() {
    setSeedError("");
    setSeedPhrase("");
    try {
      setSeedPhrase(await onRevealSeed(seedPassword));
      setSeedVisible(true);
    } catch {
      setSeedError("Password confirmation failed.");
    }
  }

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-accent/10 p-3 text-accent"><ShieldCheck size={22} /></div>
          <div>
            <h1 className="text-2xl font-semibold">Security Center</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">Wallet recovery material stays encrypted locally and is rejected by the backend API boundary.</p>
            <p className="mt-2 font-mono text-xs text-slate-500">{address ? shortAddress(address) : "Locked wallet"}</p>
          </div>
        </div>
      </Panel>

      <Panel className="space-y-4">
        <SecurityHeader title="PIN lock" value={pinEnabled ? "Enabled" : "Disabled"} />
        <div className="grid gap-3">
          <input className="field" inputMode="numeric" maxLength={6} type="password" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder={pinEnabled ? "New PIN" : "Create PIN"} />
          <input className="field" inputMode="numeric" maxLength={6} type="password" value={pinConfirm} onChange={(event) => setPinConfirm(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Confirm PIN" />
        </div>
        {pinMessage ? <p className="text-sm text-slate-300">{pinMessage}</p> : null}
        <div className="grid grid-cols-2 gap-3">
          <PrimaryButton onClick={saveNewPin} type="button">{pinEnabled ? "Change PIN" : "Enable PIN"}</PrimaryButton>
          <SecondaryButton onClick={removePin} disabled={!pinEnabled} type="button">Remove PIN</SecondaryButton>
        </div>
      </Panel>

      <Panel>
        <SecurityHeader title="Auto-lock timer" value={settings.autoLockMinutes === 0 ? "Never" : `${settings.autoLockMinutes} min`} />
        <Select className="mt-3" value={settings.autoLockMinutes} onChange={(event) => settings.setAutoLockMinutes(Number(event.target.value))}>
          <option value={1}>1 minute</option>
          <option value={5}>5 minutes</option>
          <option value={15}>15 minutes</option>
          <option value={30}>30 minutes</option>
          <option value={0}>Never</option>
        </Select>
      </Panel>

      <Panel className="space-y-3">
        <SecurityHeader title="Backup phrase" value={backupStatus === "backed-up" ? "Backed up" : "Not backed up"} />
        {backupStatus !== "backed-up" ? <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-3 text-sm text-yellow-100">Verify your recovery phrase before storing funds.</div> : null}
        <PrimaryButton onClick={onVerifyBackup} type="button">Verify backup phrase</PrimaryButton>
      </Panel>

      <Panel className="space-y-3">
        <SecurityHeader title="Reveal seed phrase" value="Password required" />
        <input className="field" type="password" value={seedPassword} onChange={(event) => setSeedPassword(event.target.value)} placeholder="Wallet password" />
        <SecondaryButton className="flex w-full items-center justify-center gap-2" onClick={revealSeed} type="button"><KeyRound size={17} /> Confirm password</SecondaryButton>
        {seedError ? <p className="rounded-2xl border border-danger/30 bg-danger/10 p-3 text-sm text-red-100">{seedError}</p> : null}
        {seedPhrase ? (
          <div className="rounded-2xl border border-danger/30 bg-danger/10 p-3">
            <button className="mb-2 flex items-center gap-2 text-sm text-danger" onClick={() => setSeedVisible(!seedVisible)} type="button">
              {seedVisible ? <EyeOff size={16} /> : <Eye size={16} />} {seedVisible ? "Hide seed phrase" : "Show seed phrase"}
            </button>
            <div className="break-words rounded-xl bg-black/30 p-3 text-sm leading-6 text-red-100">{seedVisible ? seedPhrase : "•••• •••• •••• •••• •••• •••• •••• •••• •••• •••• •••• ••••"}</div>
          </div>
        ) : null}
      </Panel>

      <Panel className="space-y-3">
        <SecurityHeader title="Delete local wallet" value="Danger" />
        <button className={`flex w-full items-center justify-center gap-2 rounded-2xl border border-danger/30 px-4 py-3 text-sm font-medium text-danger ${deleteConfirming ? "bg-danger/10" : "bg-danger/[0.03]"}`} onClick={onDeleteLocalWallet} type="button">
          <Trash2 size={16} /> {deleteConfirming ? "Tap again to delete local wallet" : "Remove local wallet"}
        </button>
      </Panel>

      <Panel>
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 text-accent" size={20} />
          <div className="text-sm leading-6 text-slate-300">
            Use a unique wallet password, verify every recipient address, ignore unexpected token airdrops, and never enter your seed phrase into websites or support chats.
          </div>
        </div>
      </Panel>
    </div>
  );
}

function SecurityHeader({ title, value }: { title: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-semibold">{title}</h2>
      <span className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1 text-xs text-slate-300">{value}</span>
    </div>
  );
}
