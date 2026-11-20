import { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  QrCode,
  Share2,
  X,
} from 'lucide-react';
import { formatBaht, formatThaiDate } from '../lib/format';
import {
  formatPromptPayDisplay,
  normalizePromptPayTarget,
} from '../lib/promptpay';
import {
  ResolvedQrResult,
  generateIndividualSummaryText,
  renderIndividualBillPng,
  resolveQrForSummary,
  shareOrDownloadPng,
} from '../lib/summaryExport';
import {
  DailySession,
  PaymentProfile,
  PersonSessionSummary,
  PreferredQrMode,
} from '../types';
import { AvatarBadge } from './AvatarBadge';

interface IndividualBillModalProps {
  person: PersonSessionSummary;
  session: DailySession;
  paymentProfile: PaymentProfile;
  onClose: () => void;
  onGoToPaymentSettings: () => void;
  onNotify: (message: string) => void;
}

export function IndividualBillModal({
  person,
  session,
  paymentProfile,
  onClose,
  onGoToPaymentSettings,
  onNotify,
}: IndividualBillModalProps) {
  const [qrMode, setQrMode] = useState<PreferredQrMode>(
    paymentProfile.preferredQrMode,
  );
  const [qrInfo, setQrInfo] = useState<ResolvedQrResult>({
    dataUrl: null,
    caption: '',
    isAmountLocked: false,
  });
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

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
    resolveQrForSummary(paymentProfile, person.roundedTotal, qrMode)
      .then((res) => {
        if (!cancelled) setQrInfo(res);
      })
      .catch(() => {
        if (!cancelled) {
          setQrInfo({ dataUrl: null, caption: '', isAmountLocked: false });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [paymentProfile, person.roundedTotal, qrMode]);

  const handleSharePng = async (forceDownload = false) => {
    setIsExporting(true);
    try {
      const { blob } = await renderIndividualBillPng(
        person,
        session,
        paymentProfile,
        qrMode,
      );
      const filename = `แจ้งยอด-${person.participant.name}-${session.date}.png`;

      if (forceDownload) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        onNotify(`บันทึกรูปใบแจ้งยอดของคุณ${person.participant.name}แล้ว`);
        return;
      }

      const result = await shareOrDownloadPng(
        blob,
        filename,
        `แจ้งยอดคุณ${person.participant.name}`,
      );
      onNotify(
        result === 'shared'
          ? 'เปิดหน้าต่างแชร์รูปแล้ว'
          : `บันทึกรูปใบแจ้งยอดของคุณ${person.participant.name}แล้ว`,
      );
    } catch {
      onNotify('ไม่สามารถสร้างรูปภาพได้');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyText = async () => {
    const text = generateIndividualSummaryText(person, session, paymentProfile);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onNotify(`คัดลอกยอดของคุณ${person.participant.name}แล้ว`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onNotify('ไม่สามารถคัดลอกข้อความได้');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="individual-bill-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-5"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#131C31] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <AvatarBadge
              name={person.participant.name}
              color={person.participant.color}
              avatarUrl={person.participant.avatarDataUrl}
            />
            <div className="min-w-0">
              <h2
                id="individual-bill-title"
                className="truncate text-lg font-bold text-white"
              >
                ใบแจ้งยอด: {person.participant.name}
              </h2>
              <p className="truncate text-xs text-slate-400">
                {session.title} • {formatThaiDate(session.date)}
              </p>
            </div>
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

        {/* Scrollable Content */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* Amount Hero */}
          <div className="rounded-2xl border border-teal-400/30 bg-gradient-to-br from-[#0F2C38] to-[#134E4A] p-5 text-center text-white">
            <p className="text-xs font-medium text-teal-200">
              ยอดสุทธิที่ต้องโอนทั้งหมด
            </p>
            <p className="mt-1 text-3xl font-bold text-white tabular-nums">
              {formatBaht(person.roundedTotal)}
            </p>
            {Math.abs(person.exactTotal - person.roundedTotal) >= 0.01 && (
              <p className="mt-1 text-xs text-teal-200/80 tabular-nums">
                (ยอดก่อนปัดเศษ {formatBaht(person.exactTotal, true)})
              </p>
            )}
          </div>

          {/* QR Code Box (Pure white QR card for reliable scanning) */}
          <div className="rounded-2xl border border-slate-700 bg-[#0D1526] p-4 text-center">
            {hasPromptPay && hasCustomQr && (
              <div className="mb-3 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setQrMode('promptpay_dynamic')}
                  className={`min-h-[38px] rounded-xl border px-3 py-1 text-xs font-semibold ${
                    qrMode === 'promptpay_dynamic'
                      ? 'border-teal-400 bg-teal-500 text-slate-950'
                      : 'border-slate-700 bg-[#131C31] text-slate-300'
                  }`}
                >
                  พร้อมเพย์ล็อกยอด
                </button>
                <button
                  type="button"
                  onClick={() => setQrMode('custom_image')}
                  className={`min-h-[38px] rounded-xl border px-3 py-1 text-xs font-semibold ${
                    qrMode === 'custom_image'
                      ? 'border-teal-400 bg-teal-500 text-slate-950'
                      : 'border-slate-700 bg-[#131C31] text-slate-300'
                  }`}
                >
                  รูป QR ที่อัปโหลดไว้
                </button>
              </div>
            )}

            {qrInfo.dataUrl ? (
              <div className="flex flex-col items-center">
                <div className="rounded-2xl bg-white p-3 shadow-md">
                  <img
                    src={qrInfo.dataUrl}
                    alt="QR Code สำหรับโอนเงิน"
                    className="h-52 w-52 object-contain"
                  />
                </div>
                <p className="mt-2.5 text-sm font-bold text-teal-300">
                  {qrInfo.caption}
                </p>
                {(paymentProfile.bankName ||
                  paymentProfile.accountNumber ||
                  paymentProfile.accountName ||
                  hasPromptPay) && (
                  <div className="mt-1 space-y-0.5 text-xs text-slate-400">
                    {hasPromptPay && (
                      <p>
                        พร้อมเพย์:{' '}
                        {formatPromptPayDisplay(paymentProfile.promptPayId)}
                      </p>
                    )}
                    {(paymentProfile.bankName ||
                      paymentProfile.accountNumber) && (
                      <p>
                        {[paymentProfile.bankName, paymentProfile.accountNumber]
                          .filter(Boolean)
                          .join(' • ')}
                      </p>
                    )}
                    {paymentProfile.accountName && (
                      <p>ชื่อบัญชี: {paymentProfile.accountName}</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-4">
                <QrCode className="mx-auto h-9 w-9 text-slate-500" />
                <p className="mt-2 text-sm font-medium text-slate-300">
                  ยังไม่ได้ตั้งค่าพร้อมเพย์หรือรูป QR รับเงิน
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onGoToPaymentSettings();
                  }}
                  className="mt-3 inline-flex min-h-[42px] items-center rounded-xl bg-teal-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-teal-400"
                >
                  ไปตั้งค่าบัญชี &amp; QR
                </button>
              </div>
            )}
          </div>

          {/* Itemized Breakdown per Shop */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-200">
              รายละเอียดแต่ละร้าน
            </h3>
            {person.receipts.map((r) => {
              const b = r.breakdown;
              if (b.total <= 0.001 && b.items.length === 0) return null;
              return (
                <div
                  key={r.receiptId}
                  className="rounded-xl border border-slate-800 bg-[#0D1526] p-4"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
                    <span className="font-bold text-white">
                      {r.category === 'sushi' ? '🍣 ' : ''}
                      {r.shopName}
                    </span>
                    <span className="shrink-0 font-bold text-teal-300 tabular-nums whitespace-nowrap">
                      {formatBaht(b.total)}
                    </span>
                  </div>

                  <ul className="mt-2.5 space-y-1.5 text-sm">
                    {b.items.map((item) => (
                      <li
                        key={item.itemId}
                        className="flex items-start justify-between gap-3"
                      >
                        <span className="min-w-0 text-slate-300">
                          {item.name}
                          {item.sharedCount > 1 && (
                            <span className="ml-1 text-xs text-slate-400">
                              (หาร {item.sharedCount})
                            </span>
                          )}
                          {item.shareItemDiscount > 0.005 && (
                            <span className="ml-1.5 rounded bg-amber-500/20 px-1.5 py-0.5 text-xs font-medium text-amber-200">
                              ลด -{formatBaht(item.shareItemDiscount)}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 font-medium text-white tabular-nums whitespace-nowrap">
                          {formatBaht(item.shareNet)}
                        </span>
                      </li>
                    ))}

                    {b.billDiscountShare > 0.005 && (
                      <li className="flex justify-between gap-3 text-amber-300">
                        <span>ส่วนลดท้ายบิลตามสัดส่วน</span>
                        <span className="shrink-0 font-semibold tabular-nums whitespace-nowrap">
                          -{formatBaht(b.billDiscountShare)}
                        </span>
                      </li>
                    )}
                    {b.serviceCharge > 0.005 && (
                      <li className="flex justify-between gap-3 text-slate-400">
                        <span>Service Charge</span>
                        <span className="shrink-0 tabular-nums whitespace-nowrap">
                          +{formatBaht(b.serviceCharge)}
                        </span>
                      </li>
                    )}
                    {b.vat > 0.005 && (
                      <li className="flex justify-between gap-3 text-slate-400">
                        <span>VAT</span>
                        <span className="shrink-0 tabular-nums whitespace-nowrap">
                          +{formatBaht(b.vat)}
                        </span>
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-800 bg-[#131C31] px-5 py-4">
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
            disabled={isExporting}
            onClick={() => handleSharePng(true)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-teal-400/40 bg-teal-500/15 px-4 py-2 text-sm font-semibold text-teal-200 hover:bg-teal-500/25 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            <span>บันทึกรูป PNG</span>
          </button>

          <button
            type="button"
            disabled={isExporting}
            onClick={() => handleSharePng(false)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-teal-500 px-5 py-2 text-sm font-bold text-slate-950 hover:bg-teal-400 disabled:opacity-50"
          >
            <Share2 className="h-4 w-4" />
            <span>แชร์ใบแจ้งยอด</span>
          </button>
        </div>
      </div>
    </div>
  );
}
