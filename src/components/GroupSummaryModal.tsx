import { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Image as ImageIcon,
  Share2,
  X,
} from 'lucide-react';
import { normalizePromptPayTarget } from '../lib/promptpay';
import {
  generateGroupSummaryText,
  renderGroupSummaryPng,
  shareOrDownloadPng,
} from '../lib/summaryExport';
import {
  DailySession,
  PaymentProfile,
  PreferredQrMode,
  SessionCalculation,
} from '../types';

interface GroupSummaryModalProps {
  session: DailySession;
  calc: SessionCalculation;
  paymentProfile: PaymentProfile;
  onClose: () => void;
  onNotify: (message: string) => void;
}

export function GroupSummaryModal({
  session,
  calc,
  paymentProfile,
  onClose,
  onNotify,
}: GroupSummaryModalProps) {
  const [includeItemDetails, setIncludeItemDetails] = useState(true);
  const [qrMode, setQrMode] = useState<PreferredQrMode>(
    paymentProfile.preferredQrMode,
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pngBlob, setPngBlob] = useState<Blob | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [copied, setCopied] = useState(false);

  const hasPromptPay = Boolean(
    normalizePromptPayTarget(paymentProfile.promptPayId),
  );
  const hasCustomQr = Boolean(paymentProfile.customQrImageDataUrl);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setIsGenerating(true);
    renderGroupSummaryPng(session, calc, paymentProfile, {
      includeItemDetails,
      qrMode,
    })
      .then((res) => {
        if (!cancelled) {
          setPreviewUrl(res.dataUrl);
          setPngBlob(res.blob);
          setIsGenerating(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewUrl(null);
          setPngBlob(null);
          setIsGenerating(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session, calc, paymentProfile, includeItemDetails, qrMode]);

  const handleShareOrSave = async (forceDownload = false) => {
    if (!pngBlob) return;
    const filename = `สรุปบิล-${session.date}.png`;
    if (forceDownload) {
      const url = URL.createObjectURL(pngBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      onNotify('บันทึกรูปใบสรุปรวมแล้ว');
      return;
    }

    const result = await shareOrDownloadPng(
      pngBlob,
      filename,
      `สรุปค่าใช้จ่าย ${session.title}`,
    );
    onNotify(
      result === 'shared'
        ? 'เปิดหน้าต่างแชร์รูปภาพแล้ว'
        : 'บันทึกรูปใบสรุปรวมแล้ว (นำไปส่งต่อใน LINE ได้เลย)',
    );
  };

  const handleCopyText = async () => {
    const text = generateGroupSummaryText(
      session,
      calc,
      paymentProfile,
      includeItemDetails,
    );
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onNotify('คัดลอกข้อความสรุปรวมเข้าคลิปบอร์ดแล้ว');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onNotify('ไม่สามารถคัดลอกอัตโนมัติได้ กรุณาลองใหม่อีกครั้ง');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="group-summary-modal-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-5"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#131C31] shadow-2xl"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div className="min-w-0">
            <h2
              id="group-summary-modal-title"
              className="truncate text-lg font-bold text-white"
            >
              ใบสรุปค่าใช้จ่ายสำหรับส่งเข้ากลุ่ม
            </h2>
            <p className="text-xs text-slate-400">
              บันทึกเป็นรูป PNG หรือคัดลอกข้อความเพื่อส่งเข้า LINE กลุ่มได้ทันที
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-[#0D1526] text-slate-300 hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-[#0D1526] px-5 py-3">
          <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 text-sm font-medium text-slate-200">
            <input
              type="checkbox"
              checked={includeItemDetails}
              onChange={(e) => setIncludeItemDetails(e.target.checked)}
              className="h-4 w-4 rounded accent-teal-500"
            />
            <span>แสดงรายละเอียดเมนูแต่ละร้านในใบสรุป</span>
          </label>

          {hasPromptPay && hasCustomQr && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-400">QR ท้ายใบสรุป:</span>
              <button
                type="button"
                onClick={() => setQrMode('promptpay_dynamic')}
                className={`min-h-[36px] rounded-lg border px-2.5 text-xs font-semibold ${
                  qrMode === 'promptpay_dynamic'
                    ? 'border-teal-400 bg-teal-500 text-slate-950'
                    : 'border-slate-700 bg-[#131C31] text-slate-300'
                }`}
              >
                พร้อมเพย์
              </button>
              <button
                type="button"
                onClick={() => setQrMode('custom_image')}
                className={`min-h-[36px] rounded-lg border px-2.5 text-xs font-semibold ${
                  qrMode === 'custom_image'
                    ? 'border-teal-400 bg-teal-500 text-slate-950'
                    : 'border-slate-700 bg-[#131C31] text-slate-300'
                }`}
              >
                รูป QR ที่อัปโหลด
              </button>
            </div>
          )}
        </div>

        {/* Scrollable Preview Body */}
        <div className="flex-1 overflow-y-auto bg-[#0B1120] p-4 sm:p-6">
          {isGenerating ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center gap-2 text-slate-400">
              <ImageIcon className="h-8 w-8 animate-pulse text-teal-400" />
              <p className="text-sm font-medium">กำลังสร้างภาพใบสรุปคมชัดสูง...</p>
            </div>
          ) : previewUrl ? (
            <div className="mx-auto max-w-xl overflow-hidden rounded-xl border border-slate-700 bg-white shadow-lg">
              <img
                src={previewUrl}
                alt="ตัวอย่างใบสรุปค่าใช้จ่ายรวม"
                className="block h-auto w-full"
              />
            </div>
          ) : (
            <div className="rounded-xl bg-[#131C31] p-6 text-center text-sm text-rose-300">
              ไม่สามารถสร้างรูปภาพได้ กรุณาลองคัดลอกข้อความแทน
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-800 bg-[#131C31] px-5 py-4">
          <button
            type="button"
            onClick={handleCopyText}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-700 bg-[#0D1526] px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-400" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            <span>{copied ? 'คัดลอกแล้ว' : 'คัดลอกข้อความ'}</span>
          </button>

          <button
            type="button"
            disabled={!pngBlob}
            onClick={() => handleShareOrSave(true)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-teal-400/40 bg-teal-500/15 px-4 py-2 text-sm font-semibold text-teal-200 hover:bg-teal-500/25 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            <span>บันทึกรูป PNG</span>
          </button>

          <button
            type="button"
            disabled={!pngBlob}
            onClick={() => handleShareOrSave(false)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-teal-500 px-5 py-2 text-sm font-bold text-slate-950 hover:bg-teal-400 disabled:opacity-50"
          >
            <Share2 className="h-4 w-4" />
            <span>แชร์รูปเข้ากลุ่ม</span>
          </button>
        </div>
      </div>
    </div>
  );
}
