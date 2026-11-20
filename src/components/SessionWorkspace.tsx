import { useState } from 'react';
import { ArrowLeft, Calendar, CheckCircle2, ReceiptText, Share2, Users } from 'lucide-react';
import { calculateSession } from '../lib/calculator';
import { DailySession, Friend, PaymentProfile } from '../types';
import { ParticipantsStep } from './ParticipantsStep';
import { ReceiptEditorStep } from './ReceiptEditorStep';
import { SummaryShareStep } from './SummaryShareStep';

export type WorkspaceStep = 'participants' | 'receipts' | 'summary';

interface SessionWorkspaceProps {
  session: DailySession;
  friends: Friend[];
  myName: string;
  myAvatarDataUrl?: string | null;
  paymentProfile: PaymentProfile;
  onBackToList: () => void;
  onUpdateSession: (updater: (prev: DailySession) => DailySession) => void;
  onAddFriendAndSelect: (friend: Friend) => void;
  onGoToPaymentSettings: () => void;
  onNotify: (message: string) => void;
}

export function SessionWorkspace({
  session,
  friends,
  myName,
  myAvatarDataUrl,
  paymentProfile,
  onBackToList,
  onUpdateSession,
  onAddFriendAndSelect,
  onGoToPaymentSettings,
  onNotify,
}: SessionWorkspaceProps) {
  const [step, setStep] = useState<WorkspaceStep>(() => {
    const hasItems = session.receipts.some(
      (r) =>
        r.items.length > 0 ||
        (r.plateCounts &&
          Object.values(r.plateCounts).some((m) =>
            Object.values(m).some((q) => q > 0),
          )),
    );
    if (hasItems) return 'summary';
    if (session.participantIds.length > 0 || session.includeMe) return 'receipts';
    return 'participants';
  });

  const calc = calculateSession(session, friends, myName, myAvatarDataUrl);

  const steps: Array<{
    id: WorkspaceStep;
    number: string;
    label: string;
    icon: typeof Users;
  }> = [
    {
      id: 'participants',
      number: '1',
      label: `เลือกเพื่อน (${calc.participants.length})`,
      icon: Users,
    },
    {
      id: 'receipts',
      number: '2',
      label: `ใส่รายการ (${session.receipts.length} ร้าน)`,
      icon: ReceiptText,
    },
    {
      id: 'summary',
      number: '3',
      label: 'สรุปยอด & แชร์',
      icon: Share2,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Top Session Bar (normal flow, zero fixed overlap) */}
      <div className="rounded-2xl border border-slate-800 bg-[#131C31] p-4 shadow-lg shadow-black/20 sm:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={onBackToList}
              className="inline-flex min-h-[44px] w-fit shrink-0 items-center gap-1.5 rounded-xl border border-slate-700 bg-[#0D1526] px-3.5 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>รายการบิล</span>
            </button>

            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="text"
                value={session.title}
                onChange={(e) =>
                  onUpdateSession((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="ตั้งชื่อบิล เช่น กินข้าว + ซูชิสายพาน + ซูเปอร์ฯ"
                aria-label="ชื่อบิลประจำวัน"
                className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-slate-700 bg-[#0D1526] px-3.5 py-2 text-base font-bold text-white outline-none focus:border-teal-400"
              />
              <div className="relative flex shrink-0 items-center">
                <Calendar className="pointer-events-none absolute left-3 h-4 w-4 text-teal-400" />
                <input
                  type="date"
                  value={session.date}
                  onChange={(e) =>
                    onUpdateSession((prev) => ({ ...prev, date: e.target.value }))
                  }
                  aria-label="วันที่"
                  className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-[#0D1526] py-2 pr-3 pl-9 text-base font-medium text-slate-200 outline-none focus:border-teal-400 sm:w-auto"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 3-Step Normal-Flow Tabs */}
        <div className="mt-4 grid grid-cols-1 gap-2 border-t border-slate-800 pt-4 sm:grid-cols-3">
          {steps.map((st) => {
            const Icon = st.icon;
            const isActive = step === st.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setStep(st.id)}
                className={`flex min-h-[46px] items-center justify-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-all ${
                  isActive
                    ? 'border-teal-400 bg-teal-500 text-slate-950 shadow-sm shadow-teal-500/20'
                    : 'border-slate-700/80 bg-[#0D1526] text-slate-300 hover:border-slate-600 hover:text-white'
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isActive
                      ? 'bg-slate-950/20 text-slate-950'
                      : 'bg-slate-800 text-teal-300'
                  }`}
                >
                  {isActive ? <CheckCircle2 className="h-4 w-4" /> : st.number}
                </span>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{st.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step Body */}
      {step === 'participants' && (
        <ParticipantsStep
          session={session}
          friends={friends}
          myName={myName}
          myAvatarDataUrl={myAvatarDataUrl}
          onUpdateSession={onUpdateSession}
          onAddFriendAndSelect={onAddFriendAndSelect}
          onNextStep={() => setStep('receipts')}
        />
      )}

      {step === 'receipts' && (
        <ReceiptEditorStep
          session={session}
          participants={calc.participants}
          onUpdateSession={onUpdateSession}
          onGoToSummary={() => setStep('summary')}
        />
      )}

      {step === 'summary' && (
        <SummaryShareStep
          session={session}
          calc={calc}
          paymentProfile={paymentProfile}
          onUpdateSession={onUpdateSession}
          onGoToReceipts={() => setStep('receipts')}
          onGoToPaymentSettings={onGoToPaymentSettings}
          onNotify={onNotify}
        />
      )}
    </div>
  );
}
