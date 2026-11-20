import { useState } from 'react';
import {
  Calendar,
  Copy,
  Plus,
  ReceiptText,
  Sparkles,
  Store,
  Trash2,
} from 'lucide-react';
import { calculateSession } from '../lib/calculator';
import { formatBaht, formatThaiDate } from '../lib/format';
import { DailySession, Friend } from '../types';
import { AvatarBadge } from './AvatarBadge';

interface SessionListViewProps {
  sessions: DailySession[];
  friends: Friend[];
  myName: string;
  myColor?: string;
  myAvatarDataUrl?: string | null;
  onCreateSession: () => void;
  onLoadDemo: () => void;
  onOpenSession: (sessionId: string) => void;
  onDuplicateSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

export function SessionListView({
  sessions,
  friends,
  myName,
  myColor = 'teal',
  myAvatarDataUrl,
  onCreateSession,
  onLoadDemo,
  onOpenSession,
  onDuplicateSession,
  onDeleteSession,
}: SessionListViewProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Top Action Banner (Obsidian Gradient Hero) */}
      <div className="rounded-2xl border border-teal-400/25 bg-gradient-to-br from-[#131C31] via-[#102A38] to-[#0F3D3E] p-5 text-white shadow-xl shadow-black/25 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              รวมบิลรายวัน &amp; แจ้งยอดเพื่อน
            </h2>
            <p className="text-sm text-teal-100/80">
              รองรับร้านอาหาร (SC/VAT ตามสัดส่วน), ซูชิสายพานนับจานสี (30/40/60/80/120), และบิลซูเปอร์มาร์เก็ตที่มีส่วนลด
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={onCreateSession}
              className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-sm shadow-teal-500/20 transition-colors hover:bg-teal-400"
            >
              <Plus className="h-4 w-4" />
              <span>สร้างบิลใหม่วันนี้</span>
            </button>
            <button
              type="button"
              onClick={onLoadDemo}
              className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-teal-400/35 bg-[#0B1120]/50 px-4 py-2.5 text-sm font-semibold text-teal-200 transition-colors hover:bg-[#0B1120]/80"
            >
              <Sparkles className="h-4 w-4 text-amber-300" />
              <span>โหลดบิลตัวอย่าง 3 ร้าน</span>
            </button>
          </div>
        </div>
      </div>

      {/* Empty State vs List */}
      {sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-[#131C31] p-8 text-center shadow-lg shadow-black/20">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/15 text-teal-300 ring-1 ring-teal-400/30">
            <ReceiptText className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-white">
            ยังไม่มีบิลรายวัน
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-400">
            กด &ldquo;สร้างบิลใหม่วันนี้&rdquo; เพื่อเริ่มเลือกเพื่อนและเพิ่มร้านอาหาร ซูชิสายพาน หรือซูเปอร์มาร์เก็ต หรือลองกด &ldquo;โหลดบิลตัวอย่าง 3 ร้าน&rdquo; เพื่อดูวิธีคิดได้เลย
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={onCreateSession}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-teal-400"
            >
              <Plus className="h-4 w-4" />
              <span>เริ่มสร้างบิลแรก</span>
            </button>
            <button
              type="button"
              onClick={onLoadDemo}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-700 bg-[#0D1526] px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800"
            >
              <Sparkles className="h-4 w-4 text-amber-300" />
              <span>ดูตัวอย่าง 3 ร้าน (ร้านอาหาร + คาเฟ่ + ซูเปอร์ฯ)</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {sessions.map((session) => {
            const calc = calculateSession(session, friends, myName, myAvatarDataUrl, myColor);
            const friendSummaries = calc.personSummaries.filter(
              (p) => !p.participant.isMe && p.roundedTotal > 0,
            );
            const paidCount = friendSummaries.filter((p) => p.isPaid).length;
            const isAllPaid =
              friendSummaries.length > 0 && paidCount === friendSummaries.length;
            const paidPct =
              friendSummaries.length > 0
                ? Math.round((paidCount / friendSummaries.length) * 100)
                : 0;

            return (
              <div
                key={session.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-[#131C31] p-5 shadow-lg shadow-black/20 transition-colors hover:border-slate-700"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-teal-400" />
                          {formatThaiDate(session.date)}
                        </span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1">
                          <Store className="h-3.5 w-3.5 text-teal-400" />
                          {session.receipts.length} ร้าน
                        </span>
                      </div>
                      <h3 className="mt-1 break-words text-lg font-bold text-white">
                        {session.title || 'มื้ออาหาร'}
                      </h3>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-xs text-slate-400">ยอดรวมทั้งวัน</p>
                      <p className="text-xl font-bold text-teal-300 tabular-nums">
                        {formatBaht(calc.grandTotal)}
                      </p>
                    </div>
                  </div>

                  {/* Shop Tags */}
                  {session.receipts.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {session.receipts.map((r) => (
                        <span
                          key={r.id}
                          className="rounded-lg border border-slate-700/80 bg-[#0D1526] px-2.5 py-1 text-xs font-medium text-slate-300"
                        >
                          {r.category === 'sushi' ? '🍣 ' : ''}
                          {r.shopName}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Participant Avatars + Payment Progress */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {calc.participants.map((p) => (
                        <div
                          key={p.id}
                          className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-[#0D1526] py-0.5 pr-2.5 pl-0.5"
                        >
                          <AvatarBadge
                            name={p.name}
                            color={p.color}
                            avatarUrl={p.avatarDataUrl}
                            size="sm"
                          />
                          <span className="text-xs font-medium text-slate-200">
                            {p.name}
                          </span>
                        </div>
                      ))}
                    </div>

                    {friendSummaries.length > 0 && (
                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          isAllPaid
                            ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-300'
                            : 'border-amber-400/35 bg-amber-500/15 text-amber-200'
                        }`}
                      >
                        {isAllPaid
                          ? 'เก็บครบแล้ว ✓'
                          : `โอนแล้ว ${paidCount}/${friendSummaries.length} คน (${paidPct}%)`}
                      </span>
                    )}
                  </div>

                  {friendSummaries.length > 0 && (
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isAllPaid ? 'bg-emerald-400' : 'bg-teal-400'
                        }`}
                        style={{ width: `${paidPct}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-4">
                  <button
                    type="button"
                    onClick={() => onOpenSession(session.id)}
                    className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-teal-500 px-4 py-2 text-sm font-bold text-slate-950 transition-colors hover:bg-teal-400 sm:flex-none"
                  >
                    เปิดจัดการบิล
                  </button>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onDuplicateSession(session.id)}
                      title="ทำสำเนาบิลนี้"
                      aria-label={`ทำสำเนา ${session.title}`}
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-700 bg-[#0D1526] text-slate-300 hover:bg-slate-800"
                    >
                      <Copy className="h-4 w-4" />
                    </button>

                    {confirmDeleteId === session.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteSession(session.id);
                            setConfirmDeleteId(null);
                          }}
                          className="min-h-[44px] rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-500"
                        >
                          ยืนยันลบ
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="min-h-[44px] rounded-xl border border-slate-700 bg-[#0D1526] px-3 py-2 text-xs text-slate-300"
                        >
                          ยกเลิก
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(session.id)}
                        title="ลบบิลนี้"
                        aria-label={`ลบ ${session.title}`}
                        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-700 bg-[#0D1526] text-rose-400 hover:bg-rose-500/15"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
