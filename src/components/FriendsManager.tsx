import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Camera,
  Check,
  Pencil,
  Plus,
  Star,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { FRIEND_COLORS, createId } from '../lib/format';
import { compressAvatarImageFile } from '../lib/storage';
import { Friend } from '../types';
import { AvatarBadge } from './AvatarBadge';

interface FriendsManagerProps {
  myName: string;
  myColor: string;
  myAvatarDataUrl?: string | null;
  onChangeMyName: (name: string) => void;
  onChangeMyColor: (color: string) => void;
  onChangeMyAvatar: (avatarDataUrl: string | null) => void;
  friends: Friend[];
  onAddFriend: (friend: Friend) => void;
  onUpdateFriend: (friend: Friend) => void;
  onDeleteFriend: (friendId: string) => void;
  onNotify: (message: string) => void;
}

export function FriendsManager({
  myName,
  myColor,
  myAvatarDataUrl,
  onChangeMyName,
  onChangeMyColor,
  onChangeMyAvatar,
  friends,
  onAddFriend,
  onUpdateFriend,
  onDeleteFriend,
  onNotify,
}: FriendsManagerProps) {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(FRIEND_COLORS[1].id);
  const [newAvatar, setNewAvatar] = useState<string | null>(null);
  const [newDefault, setNewDefault] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(FRIEND_COLORS[1].id);
  const [editAvatar, setEditAvatar] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const myAvatarInputRef = useRef<HTMLInputElement>(null);
  const newAvatarInputRef = useRef<HTMLInputElement>(null);
  const editAvatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (
    e: ChangeEvent<HTMLInputElement>,
    onDone: (dataUrl: string) => void,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await compressAvatarImageFile(file);
      onDone(dataUrl);
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'ไม่สามารถอัปโหลดรูปโปรไฟล์ได้',
      );
    }
  };

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    onAddFriend({
      id: createId('fr'),
      name: trimmed,
      color: newColor,
      avatarDataUrl: newAvatar,
      isDefaultGroup: newDefault,
    });
    setNewName('');
    setNewAvatar(null);
    const nextColorIdx = (friends.length + 2) % FRIEND_COLORS.length;
    setNewColor(FRIEND_COLORS[nextColorIdx].id);
  };

  const startEdit = (friend: Friend) => {
    setEditingId(friend.id);
    setEditName(friend.name);
    setEditColor(friend.color);
    setEditAvatar(friend.avatarDataUrl ?? null);
    setConfirmDeleteId(null);
  };

  const saveEdit = (friend: Friend) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    onUpdateFriend({
      ...friend,
      name: trimmed,
      color: editColor,
      avatarDataUrl: editAvatar,
    });
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      {/* My Profile Card */}
      <div className="rounded-2xl border border-slate-800 bg-[#131C31] p-5 shadow-lg shadow-black/20 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-white">
              โปรไฟล์ของคุณ (ผู้รวบรวมบิล)
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              ใส่ชื่อและรูปโปรไฟล์ของคุณ รูปนี้จะไปแสดงบนใบสรุปยอดที่ส่งให้เพื่อนด้วย
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={myAvatarInputRef}
              type="file"
              accept="image/*"
              onChange={(e) =>
                handleAvatarUpload(e, (url) => {
                  onChangeMyAvatar(url);
                  onNotify('อัปเดตรูปโปรไฟล์ของคุณแล้ว');
                })
              }
              className="hidden"
            />
            <div className="flex items-center gap-2.5">
              <AvatarBadge
                name={myName || 'ฉัน'}
                color={myColor}
                avatarUrl={myAvatarDataUrl}
                size="lg"
              />
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => myAvatarInputRef.current?.click()}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-700 bg-[#0D1526] px-3 text-xs font-semibold text-teal-300 hover:border-teal-400/50"
                >
                  <Camera className="h-3.5 w-3.5" />
                  <span>{myAvatarDataUrl ? 'เปลี่ยนรูป' : 'ใส่รูป'}</span>
                </button>
                {myAvatarDataUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      onChangeMyAvatar(null);
                      onNotify('ลบรูปโปรไฟล์ของคุณแล้ว');
                    }}
                    className="text-left text-[11px] text-rose-400 hover:underline"
                  >
                    ลบรูป
                  </button>
                )}
              </div>
            </div>

            <input
              type="text"
              value={myName}
              onChange={(e) => onChangeMyName(e.target.value)}
              placeholder="ฉัน"
              aria-label="ชื่อของคุณ"
              className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-[#0D1526] px-3.5 py-2 text-base text-slate-100 outline-none focus:border-teal-400 sm:w-48"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-800/80 pt-4">
          <span className="text-sm font-medium text-slate-400">
            สีประจำตัวของคุณ:
          </span>
          {FRIEND_COLORS.map((c) => {
            const selected = (myColor || 'teal') === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onChangeMyColor(c.id);
                  onNotify(`เปลี่ยนสีประจำตัวเป็นสี${c.name}แล้ว`);
                }}
                title={c.name}
                aria-label={`เลือกสีประจำตัวเป็นสี${c.name}`}
                className={`flex h-9 w-9 items-center justify-center rounded-full ${c.bgClass} transition-transform ${
                  selected
                    ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#131C31]'
                    : 'opacity-75 hover:opacity-100'
                }`}
              >
                {selected && <Check className={`h-4 w-4 ${c.textClass}`} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Add Friend Card */}
      <div className="rounded-2xl border border-slate-800 bg-[#131C31] p-5 shadow-lg shadow-black/20 sm:p-6">
        <h2 className="text-lg font-bold text-white">เพิ่มเพื่อนเข้ากลุ่มประจำ</h2>
        <p className="mt-1 text-sm text-slate-400">
          บันทึกชื่อและรูปโปรไฟล์เพื่อนเก็บไว้ครั้งเดียว แล้วค่อยแตะเลือกเฉพาะคนที่ไปทานด้วยกันในแต่ละวัน
        </p>

        <form onSubmit={handleAdd} className="mt-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              ref={newAvatarInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleAvatarUpload(e, setNewAvatar)}
              className="hidden"
            />
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => newAvatarInputRef.current?.click()}
                title="เลือกรูปโปรไฟล์เพื่อน"
                className="relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-dashed border-teal-400/50 bg-[#0D1526] text-teal-300 hover:border-teal-400"
              >
                {newAvatar ? (
                  <img
                    src={newAvatar}
                    alt="ตัวอย่างรูปเพื่อน"
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <Camera className="h-5 w-5" />
                )}
              </button>
              {newAvatar && (
                <button
                  type="button"
                  onClick={() => setNewAvatar(null)}
                  className="text-xs text-rose-400 hover:underline"
                >
                  ลบรูป
                </button>
              )}
            </div>

            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="พิมพ์ชื่อเล่นเพื่อน เช่น เอก, บีม, พลอย..."
              aria-label="ชื่อเพื่อนใหม่"
              className="min-h-[44px] flex-1 rounded-xl border border-slate-700 bg-[#0D1526] px-3.5 py-2 text-base text-slate-100 outline-none focus:border-teal-400"
            />

            <button
              type="submit"
              disabled={!newName.trim()}
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl bg-teal-500 px-5 py-2 text-sm font-bold text-slate-950 transition-colors hover:bg-teal-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              <Plus className="h-4 w-4" />
              <span>เพิ่มเพื่อน</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-400">
                สีป้ายสำรอง:
              </span>
              {FRIEND_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setNewColor(c.id)}
                  title={c.name}
                  aria-label={`เลือกสี${c.name}`}
                  className={`flex h-9 w-9 items-center justify-center rounded-full ${c.bgClass} transition-transform ${
                    newColor === c.id
                      ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#131C31]'
                      : 'opacity-75 hover:opacity-100'
                  }`}
                >
                  {newColor === c.id && <Check className={`h-4 w-4 ${c.textClass}`} />}
                </button>
              ))}
            </div>

            <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-slate-700 bg-[#0D1526] px-3.5 py-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={newDefault}
                onChange={(e) => setNewDefault(e.target.checked)}
                className="h-4 w-4 rounded accent-teal-500"
              />
              <span>เลือกอัตโนมัติเวลาสร้างบิลใหม่</span>
            </label>
          </div>
        </form>
      </div>

      {/* Saved Friends List */}
      <div className="rounded-2xl border border-slate-800 bg-[#131C31] p-5 shadow-lg shadow-black/20 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-white">
            รายชื่อเพื่อนในระบบ ({friends.length} คน)
          </h2>
          {friends.length > 0 && (
            <span className="text-xs text-slate-400">
              กดปุ่มดาวเพื่อตั้งเป็นกลุ่มประจำ หรือกดดินสอเพื่อใส่/เปลี่ยนรูปโปรไฟล์
            </span>
          )}
        </div>

        <input
          ref={editAvatarInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => handleAvatarUpload(e, setEditAvatar)}
          className="hidden"
        />

        {friends.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-[#0D1526] p-6 text-center">
            <UserCheck className="mx-auto h-8 w-8 text-slate-500" />
            <p className="mt-2 text-sm font-semibold text-slate-200">
              ยังไม่มีรายชื่อเพื่อนที่บันทึกไว้
            </p>
            <p className="mt-1 text-xs text-slate-400">
              เพิ่มชื่อและรูปโปรไฟล์เพื่อนที่ทานข้าวด้วยกันบ่อยๆ ด้านบน เพื่อกดเลือกได้เร็วในทุกๆ วัน
            </p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {friends.map((friend) => {
              const isEditing = editingId === friend.id;
              const isConfirmingDelete = confirmDeleteId === friend.id;

              return (
                <div
                  key={friend.id}
                  className="rounded-xl border border-slate-800 bg-[#0D1526] p-4 transition-colors hover:border-slate-700"
                >
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <AvatarBadge
                          name={editName || friend.name}
                          color={editColor}
                          avatarUrl={editAvatar}
                          size="lg"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => editAvatarInputRef.current?.click()}
                            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-teal-400/40 bg-teal-500/15 px-3 text-xs font-semibold text-teal-200"
                          >
                            <Camera className="h-3.5 w-3.5" />
                            <span>{editAvatar ? 'เปลี่ยนรูป' : 'เลือกรูปโปรไฟล์'}</span>
                          </button>
                          {editAvatar && (
                            <button
                              type="button"
                              onClick={() => setEditAvatar(null)}
                              className="inline-flex min-h-[38px] items-center rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 text-xs text-rose-300"
                            >
                              ลบรูป
                            </button>
                          )}
                        </div>
                      </div>

                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        aria-label="แก้ไขชื่อเพื่อน"
                        className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-[#131C31] px-3 py-2 text-base text-slate-100 outline-none focus:border-teal-400"
                      />

                      <div className="flex flex-wrap items-center gap-2">
                        {FRIEND_COLORS.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setEditColor(c.id)}
                            aria-label={`สี${c.name}`}
                            className={`flex h-8 w-8 items-center justify-center rounded-full ${c.bgClass} ${
                              editColor === c.id
                                ? 'ring-2 ring-white ring-offset-1 ring-offset-[#0D1526]'
                                : 'opacity-70'
                            }`}
                          >
                            {editColor === c.id && (
                              <Check className={`h-3.5 w-3.5 ${c.textClass}`} />
                            )}
                          </button>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => saveEdit(friend)}
                          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-teal-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-teal-400"
                        >
                          <Check className="h-4 w-4" />
                          <span>บันทึก</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-700 bg-[#131C31] px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
                        >
                          <X className="h-4 w-4" />
                          <span>ยกเลิก</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <AvatarBadge
                          name={friend.name}
                          color={friend.color}
                          avatarUrl={friend.avatarDataUrl}
                        />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-100">
                            {friend.name}
                          </p>
                          <p className="text-xs text-slate-400">
                            {friend.isDefaultGroup
                              ? 'กลุ่มประจำ (เลือกอัตโนมัติ)'
                              : 'เพื่อนเพิ่มเติม'}
                            {friend.avatarDataUrl ? ' • มีรูปโปรไฟล์' : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateFriend({
                              ...friend,
                              isDefaultGroup: !friend.isDefaultGroup,
                            })
                          }
                          title={
                            friend.isDefaultGroup
                              ? 'เอาออกจากกลุ่มประจำ'
                              : 'ตั้งเป็นกลุ่มประจำ'
                          }
                          aria-label="สลับกลุ่มประจำ"
                          className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border transition-colors ${
                            friend.isDefaultGroup
                              ? 'border-amber-400/40 bg-amber-500/15 text-amber-300'
                              : 'border-slate-700 bg-[#131C31] text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          <Star
                            className={`h-4 w-4 ${friend.isDefaultGroup ? 'fill-amber-400' : ''}`}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(friend)}
                          aria-label={`แก้ไข ${friend.name}`}
                          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-700 bg-[#131C31] text-slate-300 hover:bg-slate-800"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>

                        {isConfirmingDelete ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteFriend(friend.id);
                                setConfirmDeleteId(null);
                              }}
                              className="min-h-[44px] rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-500"
                            >
                              ยืนยันลบ
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="min-h-[44px] rounded-xl border border-slate-700 bg-[#131C31] px-2.5 py-2 text-xs text-slate-300"
                            >
                              ไม่ลบ
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(friend.id)}
                            aria-label={`ลบ ${friend.name}`}
                            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-700 bg-[#131C31] text-rose-400 hover:bg-rose-500/15"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
