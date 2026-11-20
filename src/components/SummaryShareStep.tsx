import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  Check,
  Copy,
  Image as ImageIcon,
  QrCode,
} from 'lucide-react';
import { formatBaht } from '../lib/format';
import { normalizePromptPayTarget } from '../lib/promptpay';
import { generateGroupSummaryText } from '../lib/summaryExport';
import {
  DailySession,
  PaymentProfile,
  PersonSessionSummary,
  SessionCalculation,
} from '../types';
import { AvatarBadge } from './AvatarBadge';
import { GroupSummaryModal } from './GroupSummaryModal';
import { IndividualBillModal } from './IndividualBillModal';

interface SummaryShareStepProps {
  session: DailySession;
  calc: SessionCalculation;
  paymentProfile: PaymentProfile;
  onUpdateSession: (updater: (prev: DailySession) => DailySession) => void;
  onGoToReceipts: () => void;
  onGoToPaymentSettings: () => void;
  onNotify: (message: string) => void;
}

export function SummaryShareStep({
  session,
  calc,
  paymentProfile,
  onUpdateSession,
  onGoToReceipts,
  onGoToPaymentSettings,
  onNotify,
}: SummaryShareStepProps) {
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [selectedPerson, setSelectedPerson] =
    useState<PersonSessionSummary | null>(null);

  const hasPaymentConfigured =
    Boolean(normalizePromptPayTarget(paymentProfile.promptPayId)) ||
    Boolean(paymentProfile.customQrImageDataUrl);

  const collectedPct =
    calc.collectibleFromFriends > 0
      ? Math.min(
          100,
          Math.round((calc.collectedAmount / calc.collectibleFromFriends) * 100),
        )
      : 100;

  const togglePaidStatus = (participantId: string) => {
    onUpdateSession((prev) => ({
      ...prev,
      paidStatus: {
        ...prev.paidStatus,
        [participantId]: !prev.paidStatus[participantId],
      },
    }));
  };

  const handleCopyGroupText = async () => {
    const text = generateGroupSummaryText(session, calc, paymentProfile, true);
    try {
      await navigator.clipboard.writeText(text);
      onNotify('คัดลอกข้อความสรุปรวมแล้ว (วางส่งใน LINE กลุ่มได้เลย)');
    } catch {
      onNotify('ไม่สามารถคัดลอกข้อความอัตโนมัติได้');
    }
  };

  return (
    <div className="space-y-6">
      {/* Unassigned warning */}
      {calc.unassignedItemCount > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-400/40 bg-amber-500/15 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5 text-sm text-amber-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <div>
              <p className="font-bold">
                มี {calc.unassignedItemCount} รายการที่ยังไม่ได้เลือกคนสั่ง
              </p>
              <p className="text-xs text-amber-200/80">
                รายการเหล่านั้นยังไม่ถูกนำมารวมในยอดของแต่ละคน กรุณากลับไปแตะเลือกชื่อเพื่อน
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onGoToReceipts}
            className="min-h-[44px] shrink-0 rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300"
          >
            กลับไปเลือกคนสั่ง
          </button>
        </div>
      )}

      {/* Payment setup prompt if missing */}
      {!hasPaymentConfigured && (
        <div className="flex flex-col gap-3 rounded-2xl border border-sky-400/35 bg-sky-500/15 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5 text-sm text-sky-100">
            <QrCode className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" />
            <div>
              <p className="font-bold">
                ยังไม่ได้ตั้งค่าพร้อมเพย์หรือรูป QR รับเงินของคุณ
              </p>
              <p className="text-xs text-sky-200/80">
                บันทึกเบอร์พร้อมเพย์หรืออัปโหลดรูป QR ธนาคารไว้ครั้งเดียว เพื่อแนบในใบสรุปส่งให้เพื่อนอัตโนมัติ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onGoToPaymentSettings}
            className="min-h-[44px] shrink-0 rounded-xl bg-sky-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-sky-300"
          >
            ตั้งค่าบัญชี &amp; QR เลย
          </button>
        </div>
      )}

      {/* Hero Overview + Primary Share Actions */}
      <div className="rounded-2xl border border-slate-800 bg-[#131C31] p-5 shadow-lg shadow-black/20 sm:p-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-3.5">
            <p className="text-xs font-medium text-slate-400">ยอดรวมทั้งวัน</p>
            <p className="mt-1 text-xl font-bold text-white tabular-nums sm:text-2xl">
              {formatBaht(calc.grandTotal)}
            </p>
          </div>
          <div className="rounded-xl border border-teal-400/25 bg-teal-500/10 p-3.5">
            <p className="text-xs font-medium text-teal-300">ส่วนของคุณ</p>
            <p className="mt-1 text-xl font-bold text-teal-300 tabular-nums sm:text-2xl">
              {formatBaht(calc.myShare)}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3.5">
            <p className="text-xs font-medium text-emerald-300">
              เพื่อนโอนแล้ว
            </p>
            <p className="mt-1 text-xl font-bold text-emerald-300 tabular-nums sm:text-2xl">
              {formatBaht(calc.collectedAmount)}
            </p>
          </div>
          <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-3.5">
            <p className="text-xs font-medium text-amber-300">รอเก็บเพิ่ม</p>
            <p className="mt-1 text-xl font-bold text-amber-300 tabular-nums sm:text-2xl">
              {formatBaht(calc.remainingAmount)}
            </p>
          </div>
        </div>

        {/* Collected Progress Bar */}
        {calc.collectibleFromFriends > 0 && (
          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>ความคืบหน้าการเก็บเงินจากเพื่อน</span>
              <span className="font-bold text-teal-300 tabular-nums">
                {collectedPct}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-400 transition-all"
                style={{ width: `${collectedPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Share Buttons */}
        <div className="mt-5 flex flex-col gap-3 border-t border-slate-800 pt-5 sm:flex-row">
          <button
            type="button"
            onClick={() => setShowGroupModal(true)}
            className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-teal-500 px-5 py-3 text-sm font-bold text-slate-950 shadow-sm shadow-teal-500/20 transition-colors hover:bg-teal-400"
          >
            <ImageIcon className="h-5 w-5" />
            <span>สร้างรูปใบสรุปรวม (ส่งเข้ากลุ่ม)</span>
          </button>

          <button
            type="button"
            onClick={handleCopyGroupText}
            className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-[#0D1526] px-5 py-3 text-sm font-bold text-slate-100 transition-colors hover:bg-slate-800 sm:flex-none"
          >
            <Copy className="h-4 w-4" />
            <span>คัดลอกข้อความสรุป (LINE)</span>
          </button>
        </div>
      </div>

      {/* Multi-Payer Net Settlement Card */}
      {calc.transfers.length > 0 && (
        <div className="rounded-2xl border border-teal-400/30 bg-[#102436] p-5">
          <div className="flex items-center gap-2 text-teal-300">
            <ArrowRightLeft className="h-5 w-5" />
            <h3 className="text-base font-bold">สรุปยอดโอนสุทธิ</h3>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {calc.transfers.map((t, idx) => (
              <div
                key={`${t.fromId}-${t.toId}-${idx}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-700 bg-[#0D1526] px-4 py-3 text-sm"
              >
                <span className="min-w-0 truncate font-medium text-slate-200">
                  <strong className="text-white">{t.fromName}</strong> โอนให้{' '}
                  <strong className="text-white">{t.toName}</strong>
                </span>
                <span className="shrink-0 font-bold text-teal-300 tabular-nums whitespace-nowrap">
                  {formatBaht(t.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-Person Cards Grid */}
      <div>
        <h3 className="mb-3 text-base font-bold text-white">
          ยอดรายบุคคล ({calc.personSummaries.length} คน) — กดดูรายละเอียด &amp; QR ล็อกยอดรายคนได้
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {calc.personSummaries.map((person) => (
            <div
              key={person.participant.id}
              className={`flex flex-col justify-between rounded-2xl border p-5 shadow-lg shadow-black/20 transition-colors ${
                person.isPaid && !person.participant.isMe
                  ? 'border-emerald-400/40 bg-[#132234]'
                  : 'border-slate-800 bg-[#131C31]'
              }`}
            >
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <AvatarBadge
                      name={person.participant.name}
                      color={person.participant.color}
                      avatarUrl={person.participant.avatarDataUrl}
                      size="lg"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="truncate text-lg font-bold text-white">
                          {person.participant.name}
                        </h4>
                        {person.participant.isMe && (
                          <span className="rounded-full border border-teal-400/35 bg-teal-500/15 px-2.5 py-0.5 text-xs font-semibold text-teal-300">
                            ฉัน
                          </span>
                        )}
                      </div>
                      {person.totalPaidAsPayer > 0 && (
                        <p className="text-xs text-slate-400 tabular-nums">
                          สำรองจ่ายไป {formatBaht(person.totalPaidAsPayer)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-xs text-slate-400">ยอดที่ต้องจ่าย</p>
                    <p className="text-2xl font-bold text-teal-300 tabular-nums whitespace-nowrap">
                      {formatBaht(person.roundedTotal)}
                    </p>
                  </div>
                </div>

                {/* Shop Breakdown */}
                <div className="mt-4 space-y-2 border-t border-slate-800 pt-3">
                  {person.receipts.map((r) => {
                    const b = r.breakdown;
                    return (
                      <div
                        key={r.receiptId}
                        className="rounded-xl border border-slate-800 bg-[#0D1526] px-3 py-2.5 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate font-semibold text-slate-200">
                            {r.category === 'sushi' ? '🍣 ' : ''}
                            {r.shopName}
                          </span>
                          <span className="shrink-0 font-bold text-white tabular-nums whitespace-nowrap">
                            {formatBaht(b.total)}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-400 tabular-nums">
                          <span>ค่าของ/อาหาร {formatBaht(b.netFoodSubtotal)}</span>
                          {b.billDiscountShare > 0.005 && (
                            <span className="text-amber-300">
                              ลดท้ายบิล -{formatBaht(b.billDiscountShare)}
                            </span>
                          )}
                          {b.serviceCharge > 0.005 && (
                            <span>SC +{formatBaht(b.serviceCharge)}</span>
                          )}
                          {b.vat > 0.005 && <span>VAT +{formatBaht(b.vat)}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Card Actions */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setSelectedPerson(person)}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-teal-400/35 bg-teal-500/15 px-3.5 py-2 text-sm font-semibold text-teal-200 hover:bg-teal-500/25"
                >
                  <QrCode className="h-4 w-4" />
                  <span>ดูใบแจ้งยอด &amp; QR</span>
                </button>

                {!person.participant.isMe && person.roundedTotal > 0 && (
                  <button
                    type="button"
                    onClick={() => togglePaidStatus(person.participant.id)}
                    className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                      person.isPaid
                        ? 'border-emerald-400 bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                        : 'border-slate-700 bg-[#0D1526] text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <Check className="h-4 w-4" />
                    <span>{person.isPaid ? 'โอนแล้ว' : 'ติ๊กโอนแล้ว'}</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modals */}
      {showGroupModal && (
        <GroupSummaryModal
          session={session}
          calc={calc}
          paymentProfile={paymentProfile}
          onClose={() => setShowGroupModal(false)}
          onNotify={onNotify}
        />
      )}

      {selectedPerson && (
        <IndividualBillModal
          person={selectedPerson}
          session={session}
          paymentProfile={paymentProfile}
          onClose={() => setSelectedPerson(null)}
          onGoToPaymentSettings={onGoToPaymentSettings}
          onNotify={onNotify}
        />
      )}
    </div>
  );
}
