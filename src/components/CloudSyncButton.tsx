import { useEffect, useState } from 'react';
import { type User } from 'firebase/auth';
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  CloudOff,
  Database,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { FIREBASE_REGION_LABEL } from '../lib/firebase';

export type CloudSyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export interface CloudSyncStateView {
  user: User | null;
  authLoading: boolean;
  syncStatus: CloudSyncStatus;
  lastSyncedAt: string | null;
  syncError: string | null;
  counts: { friends: number; templates: number; sessions: number };
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onSyncNow: () => Promise<void>;
}

function formatSyncTime(iso: string | null): string {
  if (!iso) return 'ยังไม่มี';
  try {
    return new Date(iso).toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function CloudSyncButton({
  user,
  authLoading,
  syncStatus,
  lastSyncedAt,
  syncError,
  counts,
  onSignIn,
  onSignOut,
  onSyncNow,
}: CloudSyncStateView) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const handleAction = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const statusMeta = (() => {
    if (!user) {
      return {
        label: 'ซิงค์คลาวด์',
        dotClass: 'bg-slate-400',
        pillClass:
          'border-teal-400/40 bg-teal-500/10 text-teal-200 hover:bg-teal-500/20',
      };
    }
    switch (syncStatus) {
      case 'syncing':
        return {
          label: 'กำลังซิงค์...',
          dotClass: 'bg-amber-400 animate-pulse',
          pillClass:
            'border-amber-400/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25',
        };
      case 'offline':
        return {
          label: 'ออฟไลน์',
          dotClass: 'bg-amber-400',
          pillClass:
            'border-amber-400/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25',
        };
      case 'error':
        return {
          label: 'ซิงค์ขัดข้อง',
          dotClass: 'bg-rose-400',
          pillClass:
            'border-rose-400/40 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25',
        };
      case 'synced':
      default:
        return {
          label: 'ซิงค์แล้ว',
          dotClass: 'bg-emerald-400',
          pillClass:
            'border-emerald-400/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25',
        };
    }
  })();

  const userInitial = (user?.displayName || user?.email || 'G')
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={authLoading}
        aria-label="ตั้งค่าซิงค์ข้อมูล Firebase ข้ามเครื่อง"
        className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all disabled:opacity-60 ${statusMeta.pillClass}`}
      >
        {user ? (
          <>
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'บัญชี Google'}
                referrerPolicy="no-referrer"
                className="h-5 w-5 rounded-full object-cover ring-1 ring-white/30"
              />
            ) : (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-500 text-[10px] font-bold text-slate-950">
                {userInitial}
              </span>
            )}
            <span className={`h-2 w-2 rounded-full ${statusMeta.dotClass}`} />
            <span className="whitespace-nowrap">{statusMeta.label}</span>
          </>
        ) : (
          <>
            {syncStatus === 'offline' ? (
              <CloudOff className="h-4 w-4 shrink-0" />
            ) : (
              <Cloud className="h-4 w-4 shrink-0" />
            )}
            <span className="whitespace-nowrap">
              {authLoading ? 'กำลังตรวจสอบ...' : statusMeta.label}
            </span>
          </>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cloud-sync-modal-title"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-700 bg-[#131C31] shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300 ring-1 ring-teal-400/30">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h2
                    id="cloud-sync-modal-title"
                    className="text-base font-bold text-white"
                  >
                    ซิงค์ข้อมูลคลาวด์ (Firebase)
                  </h2>
                  <p className="text-xs text-slate-400">
                    เปิดใช้งานข้ามมือถือ ไอแพด และคอมพิวเตอร์
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="ปิดหน้าต่าง"
                className="inline-flex min-h-[42px] min-w-[42px] items-center justify-center rounded-xl border border-slate-700 bg-[#0D1526] text-slate-300 hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="space-y-4 p-5">
              {user ? (
                <>
                  {/* Connected Google Account Card */}
                  <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-[#0D1526] p-3.5">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || 'บัญชี Google'}
                        referrerPolicy="no-referrer"
                        className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-teal-400/50"
                      />
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-500 text-base font-bold text-slate-950">
                        {userInitial}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-white">
                        {user.displayName || 'ผู้ใช้งาน Google'}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {user.email}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusMeta.pillClass}`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${statusMeta.dotClass}`}
                      />
                      <span>{statusMeta.label}</span>
                    </span>
                  </div>

                  {/* Synced Metrics */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-2.5">
                      <p className="text-lg font-bold text-white tabular-nums">
                        {counts.friends}
                      </p>
                      <p className="text-[11px] text-slate-400">กลุ่มเพื่อน</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-2.5">
                      <p className="text-lg font-bold text-white tabular-nums">
                        {counts.templates}
                      </p>
                      <p className="text-[11px] text-slate-400">ร้านประจำ</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-2.5">
                      <p className="text-lg font-bold text-white tabular-nums">
                        {counts.sessions}
                      </p>
                      <p className="text-[11px] text-slate-400">บิลรายวัน</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 rounded-xl border border-slate-800 bg-[#0D1526] p-3 text-xs text-slate-300">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400">อัปเดตล่าสุด:</span>
                      <span className="font-semibold text-teal-300 tabular-nums">
                        {formatSyncTime(lastSyncedAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400">โซนฐานข้อมูล:</span>
                      <span className="font-medium text-slate-200">
                        {FIREBASE_REGION_LABEL}
                      </span>
                    </div>
                  </div>

                  {syncError && (
                    <div className="flex items-start gap-2 rounded-xl border border-rose-500/35 bg-rose-500/15 p-3 text-xs text-rose-200">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span className="min-w-0 break-words">{syncError}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      disabled={busy || syncStatus === 'syncing'}
                      onClick={() => handleAction(onSyncNow)}
                      className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-teal-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-teal-400 disabled:opacity-60"
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${busy || syncStatus === 'syncing' ? 'animate-spin' : ''}`}
                      />
                      <span>ซิงค์ข้อมูลตอนนี้</span>
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleAction(onSignOut)}
                      className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-rose-500/35 bg-rose-500/15 px-4 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/25 disabled:opacity-60"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>ออกจากระบบ</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4 text-sm text-slate-200">
                    <p className="font-semibold text-white">
                      เข้าสู่ระบบด้วยบัญชี Google เพื่อซิงค์ข้อมูลอัตโนมัติ
                    </p>
                    <ul className="mt-2.5 space-y-1.5 text-xs text-slate-300">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-teal-400" />
                        <span>รายชื่อเพื่อนและรูปโปรไฟล์</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-teal-400" />
                        <span>เทมเพลตร้านประจำ (เช่น Sushiro และร้านอาหารต่างๆ)</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-teal-400" />
                        <span>เบอร์พร้อมเพย์, รูป QR บัญชีธนาคาร และประวัติบิลทุกมื้อ</span>
                      </li>
                    </ul>
                  </div>

                  {syncError && (
                    <div className="flex items-start gap-2 rounded-xl border border-rose-500/35 bg-rose-500/15 p-3 text-xs text-rose-200">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span className="min-w-0 break-words">{syncError}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleAction(onSignIn)}
                    className="flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-xl bg-teal-500 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-teal-500/20 hover:bg-teal-400 disabled:opacity-60"
                  >
                    <LogIn className="h-4 w-4" />
                    <span>
                      {busy
                        ? 'กำลังเชื่อมต่อ Google...'
                        : 'เข้าสู่ระบบด้วย Google'}
                    </span>
                  </button>

                  <div className="flex items-start gap-2 rounded-xl border border-slate-800/80 bg-[#0B1120] p-3 text-[11px] text-slate-400">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <span>
                      ข้อมูลในเครื่องปัจจุบันจะถูกรวมเข้าบัญชีของคุณให้อัตโนมัติโดยไม่หาย และแยกสิทธิ์อ่าน/เขียนเฉพาะบัญชีของคุณเท่านั้น (Cloud Firestore • {FIREBASE_REGION_LABEL})
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
