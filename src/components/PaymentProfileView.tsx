import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  Download,
  ImagePlus,
  LogIn,
  QrCode,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import { type CloudSyncStateView } from './CloudSyncButton';
import {
  formatPromptPayDisplay,
  generatePromptPayPayload,
  generateQrDataUrl,
  validatePromptPayId,
} from '../lib/promptpay';
import {
  compressQrImageFile,
  exportBackupJson,
  parseBackupJson,
} from '../lib/storage';
import { AppState, PaymentProfile, PreferredQrMode } from '../types';

interface PaymentProfileViewProps {
  profile: PaymentProfile;
  onChangeProfile: (profile: PaymentProfile) => void;
  appState: AppState;
  onRestoreBackup: (restored: AppState) => void;
  onNotify: (message: string) => void;
  cloudSync?: CloudSyncStateView;
}

export function PaymentProfileView({
  profile,
  onChangeProfile,
  appState,
  onRestoreBackup,
  onNotify,
  cloudSync,
}: PaymentProfileViewProps) {
  const [previewQrUrl, setPreviewQrUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  const ppValidation = validatePromptPayId(profile.promptPayId);

  useEffect(() => {
    let cancelled = false;
    if (!ppValidation.valid) {
      setPreviewQrUrl(null);
      return;
    }
    try {
      const payload = generatePromptPayPayload(profile.promptPayId);
      generateQrDataUrl(payload, 260)
        .then((url) => {
          if (!cancelled) setPreviewQrUrl(url);
        })
        .catch(() => {
          if (!cancelled) setPreviewQrUrl(null);
        });
    } catch {
      setPreviewQrUrl(null);
    }
    return () => {
      cancelled = true;
    };
  }, [profile.promptPayId, ppValidation.valid]);

  const handleQrFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError(null);

    try {
      const dataUrl = await compressQrImageFile(file);
      onChangeProfile({
        ...profile,
        customQrImageDataUrl: dataUrl,
        preferredQrMode: ppValidation.valid ? profile.preferredQrMode : 'custom_image',
      });
      onNotify('บันทึกรูป QR รับเงินเรียบร้อยแล้ว');
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'ไม่สามารถอัปโหลดรูปภาพได้',
      );
    }
  };

  const handleDownloadBackup = () => {
    const json = exportBackupJson(appState);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `splitbill-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    onNotify('ดาวน์โหลดไฟล์สำรองข้อมูลแล้ว');
  };

  const handleImportBackup = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const restored = parseBackupJson(text);
      onRestoreBackup(restored);
      onNotify('กู้คืนข้อมูลจากไฟล์สำรองเรียบร้อย');
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'ไฟล์สำรองข้อมูลไม่ถูกต้อง',
      );
    }
  };

  const setQrMode = (mode: PreferredQrMode) => {
    onChangeProfile({ ...profile, preferredQrMode: mode });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Card 1: PromptPay ID */}
        <div className="rounded-2xl border border-slate-800 bg-[#131C31] p-5 shadow-lg shadow-black/20 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300 ring-1 ring-teal-400/30">
              <QrCode className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-white">
                1. พร้อมเพย์ (สร้าง QR ล็อกยอดอัตโนมัติ)
              </h2>
              <p className="mt-0.5 text-sm text-slate-400">
                แนะนำมากที่สุด: ระบบจะสร้าง QR Code ที่มีจำนวนเงินแต่ละคนล็อกไว้ให้ทันที เพื่อนสแกนแล้วกดโอนได้เลยไม่ต้องกรอกยอด
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <label
                htmlFor="promptpay-input"
                className="block text-sm font-semibold text-slate-300"
              >
                เบอร์มือถือ / เลขบัตรประชาชน / e-Wallet พร้อมเพย์
              </label>
              <input
                id="promptpay-input"
                type="tel"
                inputMode="numeric"
                value={profile.promptPayId}
                onChange={(e) =>
                  onChangeProfile({ ...profile, promptPayId: e.target.value })
                }
                placeholder="เช่น 0812345678"
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-slate-700 bg-[#0D1526] px-3.5 py-2 text-base text-slate-100 outline-none focus:border-teal-400"
              />
            </div>

            {profile.promptPayId.trim().length > 0 && (
              <div
                className={`flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-sm ${
                  ppValidation.valid
                    ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200'
                    : 'border-amber-400/30 bg-amber-500/15 text-amber-200'
                }`}
              >
                {ppValidation.valid ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <div className="min-w-0">
                  {ppValidation.valid ? (
                    <span>
                      {ppValidation.label}:{' '}
                      <strong className="tabular-nums">
                        {formatPromptPayDisplay(profile.promptPayId)}
                      </strong>
                    </span>
                  ) : (
                    <span>{ppValidation.error}</span>
                  )}
                </div>
              </div>
            )}

            {previewQrUrl && (
              <div className="flex flex-col items-center rounded-xl border border-slate-700 bg-[#0D1526] p-4">
                <div className="rounded-xl bg-white p-3 shadow-sm">
                  <img
                    src={previewQrUrl}
                    alt="ตัวอย่าง PromptPay QR"
                    className="h-44 w-44"
                  />
                </div>
                <p className="mt-2.5 text-xs font-medium text-slate-400">
                  ตัวอย่าง PromptPay QR (ตอนแจ้งยอดรายคนจะใส่ยอดเงินให้อัตโนมัติ)
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Custom Uploaded Bank QR Image */}
        <div className="rounded-2xl border border-slate-800 bg-[#131C31] p-5 shadow-lg shadow-black/20 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/30">
              <ImagePlus className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-white">
                2. เก็บรูป QR บัญชีธนาคารของคุณไว้ในระบบ
              </h2>
              <p className="mt-0.5 text-sm text-slate-400">
                อัปโหลดภาพแคปหน้าจอ QR Code รับเงินจากแอปธนาคารเก็บไว้ในเครื่อง เผื่อใช้แนบท้ายใบสรุปรวมหรือใช้แทนพร้อมเพย์
              </p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleQrFileChange}
            className="hidden"
          />

          <div className="mt-4 space-y-4">
            {profile.customQrImageDataUrl ? (
              <div className="flex flex-col items-center rounded-xl border border-slate-700 bg-[#0D1526] p-4">
                <div className="rounded-xl bg-white p-2 shadow-sm">
                  <img
                    src={profile.customQrImageDataUrl}
                    alt="รูป QR รับเงินที่บันทึกไว้"
                    className="max-h-52 w-auto object-contain"
                  />
                </div>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-700 bg-[#131C31] px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
                  >
                    <Upload className="h-4 w-4" />
                    <span>เปลี่ยนรูป QR</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onChangeProfile({ ...profile, customQrImageDataUrl: null });
                      onNotify('ลบรูป QR ที่บันทึกไว้แล้ว');
                    }}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/15 px-4 py-2 text-sm font-semibold text-rose-300 hover:bg-rose-500/25"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>ลบรูป</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex min-h-[150px] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700 bg-[#0D1526] p-6 text-center transition-colors hover:border-teal-400 hover:bg-teal-500/5"
              >
                <ImagePlus className="h-8 w-8 text-slate-400" />
                <span className="mt-2 text-sm font-semibold text-slate-200">
                  กดเพื่อเลือกรูป QR Code รับเงิน
                </span>
                <span className="mt-1 text-xs text-slate-400">
                  รองรับไฟล์ PNG, JPG — ระบบจะย่อขนาดให้พอดีและเก็บไว้ในเครื่องทันที
                </span>
              </button>
            )}

            {uploadError && (
              <p className="rounded-xl border border-rose-500/30 bg-rose-500/15 px-3.5 py-2.5 text-sm text-rose-200">
                {uploadError}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Card 3: Bank Account Details & Preferred Mode */}
      <div className="rounded-2xl border border-slate-800 bg-[#131C31] p-5 shadow-lg shadow-black/20 sm:p-6">
        <h2 className="text-lg font-bold text-white">
          รายละเอียดบัญชีสำหรับแสดงบนใบสรุป &amp; เลือกรูปแบบ QR เริ่มต้น
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label
              htmlFor="bank-name"
              className="block text-sm font-semibold text-slate-300"
            >
              ชื่อธนาคาร
            </label>
            <input
              id="bank-name"
              type="text"
              value={profile.bankName}
              onChange={(e) =>
                onChangeProfile({ ...profile, bankName: e.target.value })
              }
              placeholder="เช่น กสิกรไทย / ไทยพาณิชย์"
              className="mt-1.5 min-h-[44px] w-full rounded-xl border border-slate-700 bg-[#0D1526] px-3.5 py-2 text-base text-slate-100 outline-none focus:border-teal-400"
            />
          </div>
          <div>
            <label
              htmlFor="account-number"
              className="block text-sm font-semibold text-slate-300"
            >
              เลขที่บัญชี
            </label>
            <input
              id="account-number"
              type="text"
              value={profile.accountNumber}
              onChange={(e) =>
                onChangeProfile({ ...profile, accountNumber: e.target.value })
              }
              placeholder="เช่น 123-4-56789-0"
              className="mt-1.5 min-h-[44px] w-full rounded-xl border border-slate-700 bg-[#0D1526] px-3.5 py-2 text-base text-slate-100 outline-none focus:border-teal-400"
            />
          </div>
          <div>
            <label
              htmlFor="account-name"
              className="block text-sm font-semibold text-slate-300"
            >
              ชื่อบัญชี (ภาษาไทย/อังกฤษ)
            </label>
            <input
              id="account-name"
              type="text"
              value={profile.accountName}
              onChange={(e) =>
                onChangeProfile({ ...profile, accountName: e.target.value })
              }
              placeholder="เช่น นายสมชาย ใจดี"
              className="mt-1.5 min-h-[44px] w-full rounded-xl border border-slate-700 bg-[#0D1526] px-3.5 py-2 text-base text-slate-100 outline-none focus:border-teal-400"
            />
          </div>
        </div>

        <div className="mt-5 border-t border-slate-800 pt-4">
          <p className="text-sm font-semibold text-slate-300">
            รูปแบบ QR ที่ต้องการแสดงเป็นค่าเริ่มต้นบนใบสรุป
          </p>
          <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setQrMode('promptpay_dynamic')}
              className={`min-h-[52px] rounded-xl border p-3.5 text-left transition-colors ${
                profile.preferredQrMode === 'promptpay_dynamic'
                  ? 'border-teal-400 bg-teal-500/15 ring-1 ring-teal-400/50'
                  : 'border-slate-700 bg-[#0D1526] hover:border-slate-600'
              }`}
            >
              <p className="text-sm font-bold text-white">
                PromptPay ล็อกยอดอัตโนมัติ (แนะนำ)
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                ใบแจ้งยอดรายบุคคลจะฝังจำนวนเงินที่ต้องโอนลงใน QR โดยตรง
              </p>
            </button>

            <button
              type="button"
              onClick={() => setQrMode('custom_image')}
              className={`min-h-[52px] rounded-xl border p-3.5 text-left transition-colors ${
                profile.preferredQrMode === 'custom_image'
                  ? 'border-teal-400 bg-teal-500/15 ring-1 ring-teal-400/50'
                  : 'border-slate-700 bg-[#0D1526] hover:border-slate-600'
              }`}
            >
              <p className="text-sm font-bold text-white">
                ใช้รูป QR ธนาคารที่อัปโหลดไว้
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                แสดงรูป QR code ของคุณเองบนใบสรุปรวมและใบแจ้งยอด
              </p>
            </button>
          </div>
        </div>
      </div>

      {/* Card 4: Firebase Cloud Sync + Manual Backup & Restore */}
      <div className="space-y-4 rounded-2xl border border-slate-800 bg-[#131C31] p-5 shadow-lg shadow-black/20 sm:p-6">
        {cloudSync && (
          <div className="flex flex-col gap-3 rounded-xl border border-teal-500/30 bg-[#0D1526] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300 ring-1 ring-teal-400/30">
                <Cloud className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white">
                  {cloudSync.user
                    ? `ซิงค์คลาวด์อัตโนมัติ: ${cloudSync.user.email || cloudSync.user.displayName}`
                    : 'ซิงค์ข้อมูลข้ามอุปกรณ์อัตโนมัติ (Firebase Cloud)'}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {cloudSync.user
                    ? cloudSync.syncStatus === 'syncing'
                      ? 'กำลังซิงค์ข้อมูลขึ้น Cloud Firestore...'
                      : cloudSync.syncStatus === 'offline'
                        ? 'กำลังออฟไลน์ — ระบบจะซิงค์ให้อัตโนมัติเมื่อกลับมาเชื่อมต่อ'
                        : 'รายชื่อเพื่อน รูปโปรไฟล์ ร้านประจำ และ QR จะซิงค์อัปเดตตรงกันทุกเครื่อง'
                    : 'เข้าสู่ระบบด้วย Google ครั้งเดียว เพื่อให้ข้อมูลเพื่อน ร้านประจำ และ QR พร้อมใช้งานทันทีบนมือถือ ไอแพด และคอมพิวเตอร์'}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              {cloudSync.user ? (
                <button
                  type="button"
                  disabled={cloudSync.syncStatus === 'syncing'}
                  onClick={() => void cloudSync.onSyncNow()}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-teal-400/40 bg-teal-500/15 px-4 py-2 text-xs font-bold text-teal-200 hover:bg-teal-500/25 disabled:opacity-60"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${cloudSync.syncStatus === 'syncing' ? 'animate-spin' : ''}`}
                  />
                  <span>ซิงค์ข้อมูลตอนนี้</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={cloudSync.authLoading}
                  onClick={() => void cloudSync.onSignIn()}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-teal-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-teal-400 disabled:opacity-60"
                >
                  <LogIn className="h-4 w-4" />
                  <span>เข้าสู่ระบบด้วย Google</span>
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-white">
              สำรองข้อมูล / ย้ายข้อมูลข้ามอุปกรณ์ (แล็ปท็อป • ไอแพด • มือถือ)
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              ข้อมูลทั้งหมด (รวมรูปโปรไฟล์เพื่อนและ QR) บันทึกในเบราว์เซอร์ของเครื่องนี้ ส่งออกเป็นไฟล์ .json เพื่อนำไปเปิดต่อในอุปกรณ์อื่นได้ทันที
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={backupInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImportBackup}
              className="hidden"
            />
            <button
              type="button"
              onClick={handleDownloadBackup}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-700 bg-[#0D1526] px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
            >
              <Download className="h-4 w-4" />
              <span>ส่งออกไฟล์สำรอง</span>
            </button>
            <button
              type="button"
              onClick={() => backupInputRef.current?.click()}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-teal-400/40 bg-teal-500/15 px-4 py-2 text-sm font-semibold text-teal-200 hover:bg-teal-500/25"
            >
              <Upload className="h-4 w-4" />
              <span>นำเข้าไฟล์สำรอง</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
