import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  Camera,
  Check,
  Image as ImageIcon,
  Minus,
  Plus,
  Settings2,
  Table2,
  Trash2,
  User,
  X,
} from 'lucide-react';
import {
  DEFAULT_SUSHI_PLATE_TIERS,
  PLATE_COLOR_CHOICES,
  SUSHIRO_PLATE_TIERS,
  createId,
  formatBaht,
} from '../lib/format';
import { ParticipantInfo, PlateTier, Receipt } from '../types';
import { AvatarBadge } from './AvatarBadge';

interface SushiPlateCounterProps {
  receipt: Receipt;
  shopAttendees: ParticipantInfo[];
  onUpdateReceipt: (updater: (receipt: Receipt) => Receipt) => void;
}

export function SushiPlateCounter({
  receipt,
  shopAttendees,
  onUpdateReceipt,
}: SushiPlateCounterProps) {
  const tiers = receipt.plateTiers ?? DEFAULT_SUSHI_PLATE_TIERS;
  const counts = receipt.plateCounts ?? {};

  const [selectedPersonId, setSelectedPersonId] = useState<string>(
    () => shopAttendees[0]?.id ?? '',
  );
  const [viewMode, setViewMode] = useState<'person' | 'matrix'>('person');
  const [showTierEditor, setShowTierEditor] = useState(false);

  // Temporary in-memory reference photo URL (no localStorage usage)
  const [refPhotoUrl, setRefPhotoUrl] = useState<string | null>(null);
  const [showRefPhoto, setShowRefPhoto] = useState(true);
  const refPhotoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (
      shopAttendees.length > 0 &&
      !shopAttendees.some((p) => p.id === selectedPersonId)
    ) {
      setSelectedPersonId(shopAttendees[0].id);
    }
  }, [shopAttendees, selectedPersonId]);

  useEffect(() => {
    return () => {
      if (refPhotoUrl) URL.revokeObjectURL(refPhotoUrl);
    };
  }, [refPhotoUrl]);

  const handleRefPhotoSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (refPhotoUrl) URL.revokeObjectURL(refPhotoUrl);
    const nextUrl = URL.createObjectURL(file);
    setRefPhotoUrl(nextUrl);
    setShowRefPhoto(true);
  };

  const clearRefPhoto = () => {
    if (refPhotoUrl) URL.revokeObjectURL(refPhotoUrl);
    setRefPhotoUrl(null);
  };

  const getPlateCount = (personId: string, tierId: string): number =>
    Math.max(0, counts[personId]?.[tierId] ?? 0);

  const setPlateCount = (personId: string, tierId: string, nextQty: number) => {
    const safeQty = Math.max(0, Math.floor(nextQty));
    onUpdateReceipt((r) => {
      const currentTiers = r.plateTiers ?? DEFAULT_SUSHI_PLATE_TIERS.map((t) => ({ ...t }));
      const prevCounts = r.plateCounts ?? {};
      const prevPerson = prevCounts[personId] ?? {};
      return {
        ...r,
        plateTiers: currentTiers,
        plateCounts: {
          ...prevCounts,
          [personId]: {
            ...prevPerson,
            [tierId]: safeQty,
          },
        },
      };
    });
  };

  const applyTierPreset = (presetTiers: PlateTier[]) => {
    onUpdateReceipt((r) => ({
      ...r,
      plateTiers: presetTiers.map((t) => ({ ...t })),
    }));
  };

  const updateTier = (tierId: string, patch: Partial<PlateTier>) => {
    onUpdateReceipt((r) => {
      const current = r.plateTiers ?? DEFAULT_SUSHI_PLATE_TIERS.map((t) => ({ ...t }));
      return {
        ...r,
        plateTiers: current.map((t) => (t.id === tierId ? { ...t, ...patch } : t)),
      };
    });
  };

  const addCustomTier = () => {
    onUpdateReceipt((r) => {
      const current = r.plateTiers ?? DEFAULT_SUSHI_PLATE_TIERS.map((t) => ({ ...t }));
      const nextColor =
        PLATE_COLOR_CHOICES[current.length % PLATE_COLOR_CHOICES.length];
      return {
        ...r,
        plateTiers: [
          ...current,
          {
            id: createId('plate'),
            label: `จาน${nextColor.label}`,
            colorHex: nextColor.hex,
            price: 100,
          },
        ],
      };
    });
  };

  const removeTier = (tierId: string) => {
    if (tiers.length <= 1) return;
    onUpdateReceipt((r) => ({
      ...r,
      plateTiers: (r.plateTiers ?? []).filter((t) => t.id !== tierId),
    }));
  };

  // Compute person & table totals
  const getPersonPlateSummary = (personId: string) => {
    let totalPlates = 0;
    let totalAmount = 0;
    for (const t of tiers) {
      const qty = getPlateCount(personId, t.id);
      totalPlates += qty;
      totalAmount += qty * t.price;
    }
    return { totalPlates, totalAmount };
  };

  const tableTotalsByTier = tiers.map((t) => {
    const qty = shopAttendees.reduce(
      (sum, p) => sum + getPlateCount(p.id, t.id),
      0,
    );
    return { tier: t, qty, amount: qty * t.price };
  });

  const tableTotalPlates = tableTotalsByTier.reduce((s, x) => s + x.qty, 0);
  const tableTotalAmount = tableTotalsByTier.reduce((s, x) => s + x.amount, 0);

  const activePerson =
    shopAttendees.find((p) => p.id === selectedPersonId) ?? shopAttendees[0];

  return (
    <div className="rounded-2xl border border-teal-500/30 bg-[#131C31] p-5 shadow-lg shadow-black/20">
      {/* Header & Quick Tools */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300 ring-1 ring-teal-400/30">
              🍣
            </span>
            <h3 className="text-base font-bold text-slate-100">
              ตัวนับจานซูชิสายพาน (แยกตามสีจาน &amp; รายคน)
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            เปิดรูปกองจานที่ถ่ายไว้แล้วจิ้มปุ่ม <strong className="text-teal-300">+</strong> นับตามสีจานของแต่ละคนได้เลย — ด้านล่างมีสรุปยอดจานรวมทั้งโต๊ะให้เทียบกับบิลร้าน
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={refPhotoInputRef}
            type="file"
            accept="image/*"
            onChange={handleRefPhotoSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => refPhotoInputRef.current?.click()}
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-teal-400/40 bg-teal-500/15 px-3.5 py-2 text-xs font-semibold text-teal-200 transition-colors hover:bg-teal-500/25"
          >
            <Camera className="h-4 w-4" />
            <span>{refPhotoUrl ? 'เปลี่ยนรูปกองจาน' : 'เปิดรูปกองจานอ้างอิง'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowTierEditor((v) => !v)}
            className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors ${
              showTierEditor
                ? 'border-amber-400/50 bg-amber-500/20 text-amber-200'
                : 'border-slate-700 bg-[#0D1526] text-slate-300 hover:border-slate-600'
            }`}
          >
            <Settings2 className="h-4 w-4" />
            <span>ตั้งค่าสี/ราคาจาน</span>
          </button>
        </div>
      </div>

      {/* Temporary In-Memory Reference Photo Viewer */}
      {refPhotoUrl && (
        <div className="mt-4 rounded-xl border border-slate-700 bg-[#0D1526] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-300">
              <ImageIcon className="h-4 w-4" />
              <span>รูปกองจานอ้างอิง (แสดงชั่วคราว ไม่เปลืองพื้นที่บันทึก)</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowRefPhoto((s) => !s)}
                className="min-h-[34px] rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-xs text-slate-200 hover:bg-slate-700"
              >
                {showRefPhoto ? 'พับรูป' : 'กางรูป'}
              </button>
              <button
                type="button"
                onClick={clearRefPhoto}
                aria-label="ลบรูปอ้างอิง"
                className="inline-flex min-h-[34px] min-w-[34px] items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {showRefPhoto && (
            <div className="mt-3 flex justify-center overflow-hidden rounded-lg bg-black/40 p-2">
              <img
                src={refPhotoUrl}
                alt="รูปกองจานซูชิอ้างอิง"
                className="max-h-72 w-auto rounded-lg object-contain"
              />
            </div>
          )}
        </div>
      )}

      {/* Plate Tier Customization Drawer */}
      {showTierEditor && (
        <div className="mt-4 space-y-3 rounded-xl border border-amber-400/30 bg-[#0D1526] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-amber-200">
              ปรับแต่งสีจานและราคาของร้านนี้
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => applyTierPreset(DEFAULT_SUSHI_PLATE_TIERS)}
                className="min-h-[36px] rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
              >
                ครบสี 30/40/60/80/120
              </button>
              <button
                type="button"
                onClick={() => applyTierPreset(SUSHIRO_PLATE_TIERS)}
                className="min-h-[36px] rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
              >
                Sushiro 40/60/80/120
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {tiers.map((tier) => (
              <div
                key={tier.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-[#131C31] p-2.5"
              >
                <select
                  aria-label="สีจาน"
                  value={tier.colorHex}
                  onChange={(e) =>
                    updateTier(tier.id, { colorHex: e.target.value })
                  }
                  className="min-h-[40px] rounded-lg border border-slate-700 bg-[#0D1526] px-2 text-sm text-slate-100"
                >
                  {PLATE_COLOR_CHOICES.map((c) => (
                    <option key={c.hex} value={c.hex}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <span
                  className="h-5 w-5 shrink-0 rounded-full border-2 border-white/60"
                  style={{ backgroundColor: tier.colorHex }}
                />
                <input
                  type="text"
                  value={tier.label}
                  onChange={(e) => updateTier(tier.id, { label: e.target.value })}
                  aria-label="ชื่อสีจาน"
                  className="min-h-[40px] min-w-0 flex-1 rounded-lg border border-slate-700 bg-[#0D1526] px-2.5 text-base text-slate-100 sm:text-sm"
                />
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={tier.price}
                  onChange={(e) =>
                    updateTier(tier.id, {
                      price: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                  aria-label="ราคาต่อจาน"
                  className="min-h-[40px] w-20 rounded-lg border border-slate-700 bg-[#0D1526] px-2.5 text-base tabular-nums text-teal-300 sm:text-sm"
                />
                {tiers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTier(tier.id)}
                    aria-label={`ลบ ${tier.label}`}
                    className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={addCustomTier}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-dashed border-teal-400/40 bg-teal-500/10 px-3.5 py-1.5 text-xs font-semibold text-teal-200 hover:bg-teal-500/20"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>เพิ่มสีจานใหม่</span>
            </button>
            <button
              type="button"
              onClick={() => setShowTierEditor(false)}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-teal-500 px-4 py-1.5 text-xs font-bold text-slate-950 hover:bg-teal-400"
            >
              <Check className="h-3.5 w-3.5" />
              <span>เสร็จสิ้น</span>
            </button>
          </div>
        </div>
      )}

      {/* Mode Switch + Person Selector */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-4">
        <span className="text-xs font-semibold text-slate-300">
          {viewMode === 'person'
            ? 'แตะเลือกเพื่อนเพื่อกดนับจาน:'
            : 'ตารางนับจานทุกคนพร้อมกัน:'}
        </span>

        <div className="flex rounded-xl border border-slate-700 bg-[#0D1526] p-1">
          <button
            type="button"
            onClick={() => setViewMode('person')}
            className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors ${
              viewMode === 'person'
                ? 'bg-teal-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <User className="h-3.5 w-3.5" />
            <span>นับทีละคน</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('matrix')}
            className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors ${
              viewMode === 'matrix'
                ? 'bg-teal-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Table2 className="h-3.5 w-3.5" />
            <span>ตารางรวมทุกคน</span>
          </button>
        </div>
      </div>

      {shopAttendees.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-slate-700 bg-[#0D1526] p-4 text-center text-xs text-slate-400">
          กรุณาเปิดรายชื่อเพื่อนที่มาร้านนี้อย่างน้อย 1 คนด้านบนก่อนครับ
        </div>
      ) : viewMode === 'person' ? (
        <div className="mt-3 space-y-4">
          {/* Friend Selector Tabs with Profile Photos */}
          <div className="flex flex-wrap gap-2">
            {shopAttendees.map((p) => {
              const summary = getPersonPlateSummary(p.id);
              const active = activePerson?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPersonId(p.id)}
                  className={`inline-flex min-h-[48px] items-center gap-2.5 rounded-xl border px-3.5 py-2 text-left transition-all ${
                    active
                      ? 'border-teal-400 bg-teal-500/15 text-white ring-1 ring-teal-400/50'
                      : 'border-slate-700 bg-[#0D1526] text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <AvatarBadge
                    name={p.name}
                    color={p.color}
                    avatarUrl={p.avatarDataUrl}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold">{p.name}</p>
                    <p className="text-[11px] text-teal-300 tabular-nums">
                      {summary.totalPlates} จาน • {formatBaht(summary.totalAmount)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Colored Plate Stepper Cards for Active Person */}
          {activePerson && (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {tiers.map((tier) => {
                const qty = getPlateCount(activePerson.id, tier.id);
                const subtotal = qty * tier.price;
                return (
                  <div
                    key={tier.id}
                    className={`flex min-h-[70px] items-center justify-between gap-3 rounded-xl border p-3 transition-colors ${
                      qty > 0
                        ? 'border-teal-400/45 bg-[#1B2742]'
                        : 'border-slate-800 bg-[#0D1526]'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {/* Visual Sushi Plate Icon */}
                      <span
                        aria-hidden="true"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-4 bg-white/90 shadow-inner"
                        style={{ borderColor: tier.colorHex }}
                      >
                        <span
                          className="h-3.5 w-3.5 rounded-full opacity-35"
                          style={{ backgroundColor: tier.colorHex }}
                        />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-100">
                          {tier.label}
                        </p>
                        <p className="text-xs text-slate-400 tabular-nums">
                          {formatBaht(tier.price)} / จาน
                          {qty > 0 && (
                            <span className="ml-1.5 font-semibold text-teal-300">
                              = {formatBaht(subtotal)}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        disabled={qty <= 0}
                        onClick={() =>
                          setPlateCount(activePerson.id, tier.id, qty - 1)
                        }
                        aria-label={`ลด ${tier.label} ของ ${activePerson.name}`}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 bg-[#131C31] text-slate-200 hover:bg-slate-700 disabled:opacity-35"
                      >
                        <Minus className="h-4 w-4" />
                      </button>

                      <span className="min-w-[32px] text-center text-base font-bold text-white tabular-nums">
                        {qty}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          setPlateCount(activePerson.id, tier.id, qty + 1)
                        }
                        aria-label={`เพิ่ม ${tier.label} ของ ${activePerson.name}`}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500 text-slate-950 font-bold hover:bg-teal-400"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Matrix Overview (Desktop/iPad/Scrollable Grid) */
        <div className="mt-3 space-y-2.5">
          {shopAttendees.map((p) => {
            const summary = getPersonPlateSummary(p.id);
            return (
              <div
                key={p.id}
                className="rounded-xl border border-slate-800 bg-[#0D1526] p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80">
                  <div className="flex items-center gap-2.5">
                    <AvatarBadge
                      name={p.name}
                      color={p.color}
                      avatarUrl={p.avatarDataUrl}
                      size="sm"
                    />
                    <span className="text-sm font-bold text-slate-100">
                      {p.name}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-teal-300 tabular-nums">
                    {summary.totalPlates} จาน • {formatBaht(summary.totalAmount)}
                  </span>
                </div>

                <div className="mt-2.5 flex flex-wrap gap-2">
                  {tiers.map((tier) => {
                    const qty = getPlateCount(p.id, tier.id);
                    return (
                      <div
                        key={tier.id}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-[#131C31] px-2.5 py-1.5"
                      >
                        <span
                          className="h-3.5 w-3.5 rounded-full border-2 border-white/70"
                          style={{ backgroundColor: tier.colorHex }}
                        />
                        <span className="text-xs font-medium text-slate-300 tabular-nums">
                          ฿{tier.price}
                        </span>
                        <button
                          type="button"
                          disabled={qty <= 0}
                          onClick={() => setPlateCount(p.id, tier.id, qty - 1)}
                          aria-label={`ลดจาน ${tier.price} ของ ${p.name}`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-35"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="min-w-[20px] text-center text-xs font-bold text-white tabular-nums">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPlateCount(p.id, tier.id, qty + 1)}
                          aria-label={`เพิ่มจาน ${tier.price} ของ ${p.name}`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500 text-slate-950 hover:bg-teal-400"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table-wide Checksum Bar (Compare total plates per color with receipt) */}
      <div className="mt-4 rounded-xl border border-slate-700/80 bg-[#0D1526] p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-300">
            เช็กยอดจานรวมทั้งโต๊ะ (เทียบกับบิลร้าน)
          </span>
          <span className="text-sm font-bold text-teal-300 tabular-nums">
            รวม {tableTotalPlates} จาน = {formatBaht(tableTotalAmount)}
          </span>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-2">
          {tableTotalsByTier.map(({ tier, qty, amount }) => (
            <div
              key={tier.id}
              className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs tabular-nums ${
                qty > 0
                  ? 'border-slate-600 bg-[#131C31] text-slate-100'
                  : 'border-slate-800 bg-transparent text-slate-500'
              }`}
            >
              <span
                className="h-3 w-3 rounded-full border border-white/60"
                style={{ backgroundColor: tier.colorHex }}
              />
              <span>
                {tier.label} (฿{tier.price}) × <strong>{qty}</strong>
              </span>
              {qty > 0 && (
                <span className="text-teal-300">({formatBaht(amount)})</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
