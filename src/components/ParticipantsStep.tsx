import { useState, type FormEvent } from 'react';
import { ArrowRight, Check, Plus, UserPlus } from 'lucide-react';
import { FRIEND_COLORS, createId } from '../lib/format';
import { DailySession, Friend, RoundingMode } from '../types';
import { AvatarBadge } from './AvatarBadge';

interface ParticipantsStepProps {
  session: DailySession;
  friends: Friend[];
  myName: string;
  myColor?: string;
  myAvatarDataUrl?: string | null;
  onUpdateSession: (updater: (prev: DailySession) => DailySession) => void;
  onAddFriendAndSelect: (friend: Friend) => void;
  onNextStep: () => void;
}

const ROUNDING_OPTIONS: Array<{
  value: RoundingMode;
  label: string;
  desc: string;
}> = [
  {
    value: 'exact',
    label: 'ทศนิยม 2 ตำแหน่ง (แม่นยำ)',
    desc: 'คิดตามจริงถึงสตางค์ เช่น ฿142.50',
  },
  {
    value: 'round_baht',
    label: 'ปัดเป็นบาทเต็ม (ใกล้เคียงสุด)',
    desc: 'เช่น ฿142.40 → ฿142, ฿142.60 → ฿143',
  },
  {
    value: 'ceil_baht',
    label: 'ปัดขึ้นเป็นบาทเต็ม',
    desc: 'ป้องกันยอดขาด เช่น ฿142.10 → ฿143',
  },
];

export function ParticipantsStep({
  session,
  friends,
  myName,
  myColor = 'teal',
  myAvatarDataUrl,
  onUpdateSession,
  onAddFriendAndSelect,
  onNextStep,
}: ParticipantsStepProps) {
  const [quickName, setQuickName] = useState('');

  const toggleMe = () => {
    onUpdateSession((prev) => ({
      ...prev,
      includeMe: !prev.includeMe,
    }));
  };

  const toggleFriend = (friendId: string) => {
    onUpdateSession((prev) => {
      const exists = prev.participantIds.includes(friendId);
      const nextIds = exists
        ? prev.participantIds.filter((id) => id !== friendId)
        : [...prev.participantIds, friendId];

      const nextReceipts = prev.receipts.map((r) => {
        if (exists) {
          return {
            ...r,
            attendeeIds: r.attendeeIds.filter((id) => id !== friendId),
            items: r.items.map((it) => ({
              ...it,
              shares: it.shares.filter((s) => s.participantId !== friendId),
            })),
          };
        }
        return r.attendeeIds.includes(friendId)
          ? r
          : { ...r, attendeeIds: [...r.attendeeIds, friendId] };
      });

      return {
        ...prev,
        participantIds: nextIds,
        receipts: nextReceipts,
      };
    });
  };

  const selectDefaultGroup = () => {
    const defaultIds = friends.filter((f) => f.isDefaultGroup).map((f) => f.id);
    const idsToUse = defaultIds.length > 0 ? defaultIds : friends.map((f) => f.id);
    onUpdateSession((prev) => ({
      ...prev,
      includeMe: true,
      participantIds: idsToUse,
    }));
  };

  const selectAllFriends = () => {
    onUpdateSession((prev) => ({
      ...prev,
      includeMe: true,
      participantIds: friends.map((f) => f.id),
    }));
  };

  const handleQuickAdd = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = quickName.trim();
    if (!trimmed) return;
    const color = FRIEND_COLORS[(friends.length + 1) % FRIEND_COLORS.length].id;
    const newFriend: Friend = {
      id: createId('fr'),
      name: trimmed,
      color,
      isDefaultGroup: true,
    };
    onAddFriendAndSelect(newFriend);
    setQuickName('');
  };

  const totalSelectedCount =
    (session.includeMe ? 1 : 0) + session.participantIds.length;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-[#131C31] p-5 shadow-lg shadow-black/20 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-white">
              วันนี้ใครไปทานด้วยกันบ้าง? ({totalSelectedCount} คน)
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              แตะเลือกชื่อเพื่อนจากกลุ่มประจำ (ถ้าบางคนไม่ได้ไปต่อร้านที่ 2 สามารถปรับแยกเฉพาะร้านได้ในขั้นตอนถัดไป)
            </p>
          </div>

          {friends.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={selectDefaultGroup}
                className="min-h-[44px] rounded-xl border border-slate-700 bg-[#0D1526] px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
              >
                เลือกกลุ่มประจำ
              </button>
              <button
                type="button"
                onClick={selectAllFriends}
                className="min-h-[44px] rounded-xl border border-slate-700 bg-[#0D1526] px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
              >
                เลือกทั้งหมด
              </button>
            </div>
          )}
        </div>

        {/* Participant Selection Grid */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* Me card */}
          <button
            type="button"
            onClick={toggleMe}
            className={`flex min-h-[58px] items-center justify-between gap-3 rounded-xl border p-3.5 text-left transition-all ${
              session.includeMe
                ? 'border-teal-400 bg-teal-500/15 ring-1 ring-teal-400/50'
                : 'border-slate-800 bg-[#0D1526] hover:border-slate-700'
            }`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <AvatarBadge
                name={myName || 'ฉัน'}
                color={myColor}
                avatarUrl={myAvatarDataUrl}
              />
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">
                  {myName || 'ฉัน'}
                </p>
                <p className="text-xs text-slate-400">ตัวคุณเอง (ผู้รวบรวมบิล)</p>
              </div>
            </div>
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                session.includeMe
                  ? 'border-teal-400 bg-teal-500 text-slate-950'
                  : 'border-slate-600 bg-[#131C31] text-transparent'
              }`}
            >
              <Check className="h-4 w-4" />
            </span>
          </button>

          {/* Saved Friends */}
          {friends.map((friend) => {
            const isSelected = session.participantIds.includes(friend.id);
            return (
              <button
                key={friend.id}
                type="button"
                onClick={() => toggleFriend(friend.id)}
                className={`flex min-h-[58px] items-center justify-between gap-3 rounded-xl border p-3.5 text-left transition-all ${
                  isSelected
                    ? 'border-teal-400 bg-teal-500/15 ring-1 ring-teal-400/50'
                    : 'border-slate-800 bg-[#0D1526] hover:border-slate-700'
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <AvatarBadge
                    name={friend.name}
                    color={friend.color}
                    avatarUrl={friend.avatarDataUrl}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">
                      {friend.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {friend.isDefaultGroup ? 'กลุ่มประจำ' : 'เพื่อนเพิ่มเติม'}
                    </p>
                  </div>
                </div>
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                    isSelected
                      ? 'border-teal-400 bg-teal-500 text-slate-950'
                      : 'border-slate-600 bg-[#131C31] text-transparent'
                  }`}
                >
                  <Check className="h-4 w-4" />
                </span>
              </button>
            );
          })}
        </div>

        {/* Quick inline add friend */}
        <form
          onSubmit={handleQuickAdd}
          className="mt-5 rounded-xl border border-slate-800 bg-[#0D1526] p-4"
        >
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <UserPlus className="h-4 w-4 text-teal-400" />
            <span>เพิ่มเพื่อนใหม่ด่วน (บันทึกลงกลุ่มเพื่อนให้ด้วย)</span>
          </p>
          <div className="mt-2.5 flex flex-col gap-2.5 sm:flex-row">
            <input
              type="text"
              value={quickName}
              onChange={(e) => setQuickName(e.target.value)}
              placeholder="พิมพ์ชื่อเพื่อน เช่น มิน, ต้น..."
              aria-label="เพิ่มชื่อเพื่อนใหม่"
              className="min-h-[44px] flex-1 rounded-xl border border-slate-700 bg-[#131C31] px-3.5 py-2 text-base text-slate-100 outline-none focus:border-teal-400"
            />
            <button
              type="submit"
              disabled={!quickName.trim()}
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-teal-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-teal-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              <Plus className="h-4 w-4" />
              <span>เพิ่มเข้าบิล</span>
            </button>
          </div>
        </form>
      </div>

      {/* Rounding Rule */}
      <div className="rounded-2xl border border-slate-800 bg-[#131C31] p-5 shadow-lg shadow-black/20 sm:p-6">
        <h3 className="text-base font-bold text-white">
          การปัดเศษยอดสุทธิทั้งวัน
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          {ROUNDING_OPTIONS.map((opt) => {
            const active = session.roundingMode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  onUpdateSession((prev) => ({ ...prev, roundingMode: opt.value }))
                }
                className={`min-h-[56px] rounded-xl border p-3.5 text-left transition-colors ${
                  active
                    ? 'border-teal-400 bg-teal-500/15 ring-1 ring-teal-400/50'
                    : 'border-slate-800 bg-[#0D1526] hover:border-slate-700'
                }`}
              >
                <p className="text-sm font-bold text-white">{opt.label}</p>
                <p className="mt-0.5 text-xs text-slate-400">{opt.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Next Step Action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          {totalSelectedCount === 0
            ? 'กรุณาเลือกผู้ร่วมมื้ออย่างน้อย 1 คน'
            : `พร้อมใส่รายการอาหาร/สินค้าสำหรับ ${totalSelectedCount} คน (ปรับคนต่อร้านได้ในขั้นถัดไป)`}
        </p>
        <button
          type="button"
          disabled={totalSelectedCount === 0}
          onClick={onNextStep}
          className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-teal-500 px-6 py-3 text-sm font-bold text-slate-950 shadow-sm shadow-teal-500/20 transition-colors hover:bg-teal-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 sm:w-auto"
        >
          <span>ถัดไป: เพิ่มรายการร้านค้า ({session.receipts.length} ร้าน)</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
