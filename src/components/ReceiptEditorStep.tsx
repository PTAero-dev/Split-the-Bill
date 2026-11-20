import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Pencil,
  Percent,
  Plus,
  ShoppingBag,
  Store,
  Tag,
  Trash2,
  Utensils,
  X,
  ArrowRight,
} from 'lucide-react';
import { calculateLineItem, calculateReceipt } from '../lib/calculator';
import {
  RECEIPT_PRESETS,
  type ReceiptPreset,
  createId,
  formatBaht,
  getFriendColor,
} from '../lib/format';
import { cloneDefaultSushiTiers, createEmptyReceipt } from '../lib/storage';
import {
  BillDiscountAllocation,
  BillDiscountTiming,
  DailySession,
  DiscountType,
  LineItem,
  ME_ID,
  ParticipantInfo,
  Receipt,
} from '../types';
import { AvatarBadge } from './AvatarBadge';
import { SushiPlateCounter } from './SushiPlateCounter';

interface ReceiptEditorStepProps {
  session: DailySession;
  participants: ParticipantInfo[];
  onUpdateSession: (updater: (prev: DailySession) => DailySession) => void;
  onGoToSummary: () => void;
}

export function ReceiptEditorStep({
  session,
  participants,
  onUpdateSession,
  onGoToSummary,
}: ReceiptEditorStepProps) {
  const [activeReceiptId, setActiveReceiptId] = useState<string>(
    () => session.receipts[0]?.id ?? '',
  );
  const [confirmDeleteReceiptId, setConfirmDeleteReceiptId] = useState<string | null>(
    null,
  );

  // Add item form state
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [showItemDiscount, setShowItemDiscount] = useState(false);
  const [itemDiscType, setItemDiscType] = useState<DiscountType>('none');
  const [itemDiscVal, setItemDiscVal] = useState('');
  const [itemExemptSC, setItemExemptSC] = useState(false);
  const [itemExemptVAT, setItemExemptVAT] = useState(false);
  const [itemOwners, setItemOwners] = useState<string[]>([]);
  const [showTaxAdvanced, setShowTaxAdvanced] = useState(false);

  // Inline editing item state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    name: string;
    unitPrice: string;
    quantity: string;
    discountType: DiscountType;
    discountValue: string;
    exemptSC: boolean;
    exemptVAT: boolean;
  } | null>(null);

  const activeReceipt =
    session.receipts.find((r) => r.id === activeReceiptId) ??
    session.receipts[0];

  useEffect(() => {
    if (!activeReceipt && session.receipts.length > 0) {
      setActiveReceiptId(session.receipts[0].id);
    }
  }, [activeReceipt, session.receipts]);

  useEffect(() => {
    if (activeReceipt?.category === 'supermarket') {
      setShowItemDiscount(true);
    }
  }, [activeReceipt?.id, activeReceipt?.category]);

  useEffect(() => {
    if (!activeReceipt) return;
    setItemOwners((prev) => {
      const valid = prev.filter((id) => activeReceipt.attendeeIds.includes(id));
      if (valid.length > 0) return valid;
      return activeReceipt.attendeeIds.length > 0
        ? [activeReceipt.attendeeIds[0]]
        : [];
    });
    setEditingItemId(null);
    setEditDraft(null);
    setConfirmDeleteReceiptId(null);
  }, [activeReceipt?.id]);

  const participantMap = new Map(participants.map((p) => [p.id, p]));

  const updateActiveReceipt = (updater: (receipt: Receipt) => Receipt) => {
    if (!activeReceipt) return;
    onUpdateSession((prev) => ({
      ...prev,
      receipts: prev.receipts.map((r) =>
        r.id === activeReceipt.id ? updater(r) : r,
      ),
    }));
  };

  const handleAddShop = (preset?: ReceiptPreset) => {
    const allIds = participants.map((p) => p.id);
    const defaultPayer = participants.some((p) => p.id === ME_ID)
      ? ME_ID
      : (allIds[0] ?? ME_ID);
    const newRc = createEmptyReceipt(
      allIds,
      defaultPayer,
      session.receipts.length + 1,
      preset?.category ?? 'restaurant',
    );

    if (preset) {
      newRc.category = preset.category;
      newRc.serviceChargeRate = preset.serviceChargeRate;
      newRc.vatRate = preset.vatRate;
      newRc.vatOnServiceCharge = preset.vatOnServiceCharge;
      if (preset.category === 'supermarket') {
        newRc.shopName = `ซูเปอร์มาร์เก็ต (บิลที่ ${session.receipts.length + 1})`;
      } else if (preset.category === 'cafe') {
        newRc.shopName = `คาเฟ่ / ร้านที่ ${session.receipts.length + 1}`;
      } else if (preset.category === 'sushi') {
        newRc.shopName = `ซูชิสายพาน (บิลที่ ${session.receipts.length + 1})`;
      }
    }

    onUpdateSession((prev) => ({
      ...prev,
      receipts: [...prev.receipts, newRc],
    }));
    setActiveReceiptId(newRc.id);
  };

  const handleDeleteShop = (receiptId: string) => {
    if (session.receipts.length <= 1) return;
    const remaining = session.receipts.filter((r) => r.id !== receiptId);
    onUpdateSession((prev) => ({
      ...prev,
      receipts: remaining,
    }));
    if (activeReceiptId === receiptId && remaining[0]) {
      setActiveReceiptId(remaining[0].id);
    }
    setConfirmDeleteReceiptId(null);
  };

  const applyPresetToCurrentShop = (preset: ReceiptPreset) => {
    updateActiveReceipt((r) => ({
      ...r,
      category: preset.category,
      serviceChargeRate: preset.serviceChargeRate,
      vatRate: preset.vatRate,
      vatOnServiceCharge: preset.vatOnServiceCharge,
      plateTiers:
        preset.category === 'sushi' && (!r.plateTiers || r.plateTiers.length === 0)
          ? cloneDefaultSushiTiers()
          : r.plateTiers,
      plateCounts:
        preset.category === 'sushi' && !r.plateCounts ? {} : r.plateCounts,
    }));
    if (preset.category === 'supermarket') {
      setShowItemDiscount(true);
    }
  };

  const toggleShopAttendee = (participantId: string) => {
    updateActiveReceipt((r) => {
      const exists = r.attendeeIds.includes(participantId);
      const nextAttendees = exists
        ? r.attendeeIds.filter((id) => id !== participantId)
        : [...r.attendeeIds, participantId];

      const nextItems = exists
        ? r.items.map((it) => ({
            ...it,
            shares: it.shares.filter((s) => s.participantId !== participantId),
          }))
        : r.items;

      let nextPlateCounts = r.plateCounts;
      if (exists && r.plateCounts && participantId in r.plateCounts) {
        const copy = { ...r.plateCounts };
        delete copy[participantId];
        nextPlateCounts = copy;
      }

      return {
        ...r,
        attendeeIds: nextAttendees,
        items: nextItems,
        plateCounts: nextPlateCounts,
      };
    });
  };

  const toggleNewItemOwner = (id: string) => {
    setItemOwners((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleAddItem = (e: FormEvent) => {
    e.preventDefault();
    if (!activeReceipt) return;
    const priceNum = Number(itemPrice);
    const qtyNum = Math.max(1, Number(itemQty) || 1);
    if (!itemName.trim() && (!Number.isFinite(priceNum) || priceNum <= 0)) {
      return;
    }

    const safePrice = Number.isFinite(priceNum) && priceNum >= 0 ? priceNum : 0;
    const discValNum =
      itemDiscType !== 'none'
        ? Math.max(0, Number(itemDiscVal) || 0)
        : 0;

    const chosenOwners = itemOwners.filter((id) =>
      activeReceipt.attendeeIds.includes(id),
    );

    const newItem: LineItem = {
      id: createId('item'),
      name: itemName.trim() || `รายการที่ ${activeReceipt.items.length + 1}`,
      unitPrice: safePrice,
      quantity: qtyNum,
      discountType: discValNum > 0 ? itemDiscType : 'none',
      discountValue: discValNum,
      shares: chosenOwners.map((id) => ({ participantId: id, weight: 1 })),
      exemptSC: itemExemptSC,
      exemptVAT: itemExemptVAT,
    };

    updateActiveReceipt((r) => ({
      ...r,
      items: [...r.items, newItem],
    }));

    setItemName('');
    setItemPrice('');
    setItemQty('1');
    setItemDiscVal('');
    if (activeReceipt.category !== 'supermarket') {
      setItemDiscType('none');
    }
  };

  const toggleItemShare = (itemId: string, participantId: string) => {
    updateActiveReceipt((r) => ({
      ...r,
      items: r.items.map((it) => {
        if (it.id !== itemId) return it;
        const exists = it.shares.some((s) => s.participantId === participantId);
        const nextShares = exists
          ? it.shares.filter((s) => s.participantId !== participantId)
          : [...it.shares, { participantId, weight: 1 }];
        return { ...it, shares: nextShares };
      }),
    }));
  };

  const assignItemToAllAttendees = (itemId: string) => {
    if (!activeReceipt) return;
    updateActiveReceipt((r) => ({
      ...r,
      items: r.items.map((it) => {
        if (it.id !== itemId) return it;
        const allAssigned = r.attendeeIds.every((id) =>
          it.shares.some((s) => s.participantId === id),
        );
        return {
          ...it,
          shares: allAssigned
            ? []
            : r.attendeeIds.map((id) => ({ participantId: id, weight: 1 })),
        };
      }),
    }));
  };

  const startEditItem = (item: LineItem) => {
    setEditingItemId(item.id);
    setEditDraft({
      name: item.name,
      unitPrice: String(item.unitPrice),
      quantity: String(item.quantity),
      discountType: item.discountType,
      discountValue: item.discountValue > 0 ? String(item.discountValue) : '',
      exemptSC: item.exemptSC,
      exemptVAT: item.exemptVAT,
    });
  };

  const saveEditItem = (itemId: string) => {
    if (!editDraft) return;
    const price = Math.max(0, Number(editDraft.unitPrice) || 0);
    const qty = Math.max(1, Number(editDraft.quantity) || 1);
    const discVal =
      editDraft.discountType !== 'none'
        ? Math.max(0, Number(editDraft.discountValue) || 0)
        : 0;

    updateActiveReceipt((r) => ({
      ...r,
      items: r.items.map((it) =>
        it.id === itemId
          ? {
              ...it,
              name: editDraft.name.trim() || it.name,
              unitPrice: price,
              quantity: qty,
              discountType: discVal > 0 ? editDraft.discountType : 'none',
              discountValue: discVal,
              exemptSC: editDraft.exemptSC,
              exemptVAT: editDraft.exemptVAT,
            }
          : it,
      ),
    }));
    setEditingItemId(null);
    setEditDraft(null);
  };

  const duplicateItem = (item: LineItem) => {
    updateActiveReceipt((r) => ({
      ...r,
      items: [
        ...r.items,
        {
          ...item,
          id: createId('item'),
          name: `${item.name} (สำเนา)`,
          shares: item.shares.map((s) => ({ ...s })),
        },
      ],
    }));
  };

  const deleteItem = (itemId: string) => {
    updateActiveReceipt((r) => ({
      ...r,
      items: r.items.filter((it) => it.id !== itemId),
    }));
  };

  if (!activeReceipt) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-[#131C31] p-8 text-center">
        <p className="text-slate-300">ยังไม่มีร้านค้าในบิลวันนี้</p>
        <button
          type="button"
          onClick={() => handleAddShop()}
          className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-bold text-slate-950"
        >
          <Plus className="h-4 w-4" />
          <span>เพิ่มร้านแรก</span>
        </button>
      </div>
    );
  }

  const receiptCalc = calculateReceipt(activeReceipt, participantMap);
  const shopAttendees = participants.filter((p) =>
    activeReceipt.attendeeIds.includes(p.id),
  );

  const sushiPreset = RECEIPT_PRESETS.find((p) => p.category === 'sushi');
  const superPreset = RECEIPT_PRESETS.find((p) => p.category === 'supermarket');

  return (
    <div className="space-y-6">
      {/* Shop Switcher Bar */}
      <div className="rounded-2xl border border-slate-800 bg-[#131C31] p-4 shadow-lg shadow-black/20">
        <div className="flex flex-wrap items-center gap-2">
          {session.receipts.map((r, idx) => {
            const isActive = r.id === activeReceipt.id;
            const rc = calculateReceipt(r, participantMap);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setActiveReceiptId(r.id)}
                className={`inline-flex min-h-[44px] max-w-full items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-all ${
                  isActive
                    ? 'border-teal-400 bg-teal-500 text-slate-950 shadow-sm shadow-teal-500/20'
                    : 'border-slate-700 bg-[#0D1526] text-slate-200 hover:border-slate-600'
                }`}
              >
                {r.category === 'sushi' ? (
                  <span aria-hidden="true">🍣</span>
                ) : r.category === 'supermarket' ? (
                  <ShoppingBag className="h-4 w-4 shrink-0" />
                ) : (
                  <Store className="h-4 w-4 shrink-0" />
                )}
                <span className="max-w-[180px] truncate">
                  {r.shopName || `ร้านที่ ${idx + 1}`}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs tabular-nums ${
                    isActive
                      ? 'bg-slate-950/20 text-slate-950'
                      : 'bg-[#131C31] text-teal-300'
                  }`}
                >
                  {formatBaht(rc.calculatedTotal)}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => handleAddShop()}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-dashed border-teal-400/50 bg-teal-500/10 px-3.5 py-2 text-sm font-semibold text-teal-200 hover:bg-teal-500/20"
          >
            <Plus className="h-4 w-4" />
            <span>เพิ่มร้านต่อ</span>
          </button>

          {sushiPreset && (
            <button
              type="button"
              onClick={() => handleAddShop(sushiPreset)}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-dashed border-rose-400/50 bg-rose-500/10 px-3.5 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/20"
            >
              <span>🍣 + ซูชิสายพาน</span>
            </button>
          )}

          {superPreset && (
            <button
              type="button"
              onClick={() => handleAddShop(superPreset)}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-dashed border-amber-400/50 bg-amber-500/10 px-3.5 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/20"
            >
              <ShoppingBag className="h-4 w-4" />
              <span>+ ซูเปอร์ฯ</span>
            </button>
          )}
        </div>
      </div>

      {/* Main 2-column Desktop / 1-column Mobile & iPad Layout */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Left / Main Column */}
        <div className="min-w-0 space-y-6">
          {/* Shop Settings Card */}
          <div className="rounded-2xl border border-slate-800 bg-[#131C31] p-5 shadow-lg shadow-black/20">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {activeReceipt.category === 'sushi' ? (
                  <span className="text-lg">🍣</span>
                ) : activeReceipt.category === 'supermarket' ? (
                  <ShoppingBag className="h-5 w-5 text-amber-400" />
                ) : (
                  <Utensils className="h-5 w-5 text-teal-400" />
                )}
                <h3 className="text-base font-bold text-white">
                  ตั้งค่าร้านค้า &amp; ภาษี / ส่วนลดท้ายบิล
                </h3>
              </div>

              {session.receipts.length > 1 && (
                <div>
                  {confirmDeleteReceiptId === activeReceipt.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDeleteShop(activeReceipt.id)}
                        className="min-h-[40px] rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        ยืนยันลบร้านนี้
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteReceiptId(null)}
                        className="min-h-[40px] rounded-xl border border-slate-700 px-3 py-1.5 text-xs text-slate-300"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteReceiptId(activeReceipt.id)}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/25"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>ลบร้านนี้</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Shop Name + Payer */}
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="shop-name-input"
                  className="block text-xs font-semibold text-slate-400"
                >
                  ชื่อร้าน / สถานที่
                </label>
                <input
                  id="shop-name-input"
                  type="text"
                  value={activeReceipt.shopName}
                  onChange={(e) =>
                    updateActiveReceipt((r) => ({
                      ...r,
                      shopName: e.target.value,
                    }))
                  }
                  placeholder="เช่น ซูชิสายพาน, ร้านอาหาร, Tops..."
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-700 bg-[#0D1526] px-3.5 py-2 text-base text-white outline-none focus:border-teal-400"
                />
              </div>

              <div>
                <label
                  htmlFor="shop-payer-select"
                  className="block text-xs font-semibold text-slate-400"
                >
                  คนที่สำรองจ่ายบิลร้านนี้
                </label>
                <select
                  id="shop-payer-select"
                  value={activeReceipt.payerId}
                  onChange={(e) =>
                    updateActiveReceipt((r) => ({ ...r, payerId: e.target.value }))
                  }
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-700 bg-[#0D1526] px-3.5 py-2 text-base text-white outline-none focus:border-teal-400"
                >
                  {participants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.isMe ? `${p.name} (ฉัน)` : p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="mt-4">
              <p className="text-xs font-semibold text-slate-400">
                รูปแบบการคิด SC / VAT &amp; ประเภทร้าน (กดเลือกด่วน):
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {RECEIPT_PRESETS.map((preset) => {
                  const isCurrent =
                    activeReceipt.category === preset.category &&
                    activeReceipt.serviceChargeRate === preset.serviceChargeRate &&
                    activeReceipt.vatRate === preset.vatRate &&
                    activeReceipt.vatOnServiceCharge === preset.vatOnServiceCharge;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPresetToCurrentShop(preset)}
                      className={`min-h-[54px] rounded-xl border p-2.5 text-left transition-colors ${
                        isCurrent
                          ? 'border-teal-400 bg-teal-500/15 ring-1 ring-teal-400/50'
                          : 'border-slate-700 bg-[#0D1526] hover:border-slate-600'
                      }`}
                    >
                      <p className="text-xs font-bold text-white">
                        {preset.label}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {preset.shortLabel}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Attendees for this specific shop */}
            <div className="mt-4 border-t border-slate-800 pt-4">
              <p className="text-xs font-semibold text-slate-400">
                เพื่อนที่มาร้านนี้ ({shopAttendees.length} คน — แตะเปิด/ปิดได้ถ้าบางคนไม่ได้มาร้านนี้):
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {participants.map((p) => {
                  const isInShop = activeReceipt.attendeeIds.includes(p.id);
                  const palette = getFriendColor(p.color);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleShopAttendee(p.id)}
                      className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                        isInShop
                          ? palette.softBgClass
                          : 'border-slate-800 bg-[#0D1526] text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      <AvatarBadge
                        name={p.name}
                        color={p.color}
                        avatarUrl={p.avatarDataUrl}
                        size="sm"
                      />
                      <span>{p.name}</span>
                      {isInShop && <Check className="h-3.5 w-3.5" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SC / VAT Custom & Bill-level Discount */}
            <div className="mt-4 border-t border-slate-800 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-400">
                  ส่วนลดท้ายบิล (คูปอง / ส่วนลดสมาชิก / บัตรเครดิต) &amp; ปรับ % SC/VAT เอง
                </span>
                <button
                  type="button"
                  onClick={() => setShowTaxAdvanced((s) => !s)}
                  className="inline-flex min-h-[38px] items-center gap-1 text-xs font-semibold text-teal-300 hover:text-teal-200"
                >
                  <span>
                    {showTaxAdvanced
                      ? 'ซ่อนการตั้งค่า SC/VAT ละเอียด'
                      : 'ปรับ % SC/VAT เอง'}
                  </span>
                  {showTaxAdvanced ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              </div>

              {showTaxAdvanced && (
                <div className="mt-3 grid grid-cols-1 gap-3 rounded-xl border border-slate-700 bg-[#0D1526] p-3.5 sm:grid-cols-3">
                  <div>
                    <label
                      htmlFor="sc-rate-input"
                      className="block text-xs font-semibold text-slate-400"
                    >
                      Service Charge (%)
                    </label>
                    <input
                      id="sc-rate-input"
                      type="number"
                      min="0"
                      step="0.5"
                      inputMode="decimal"
                      value={activeReceipt.serviceChargeRate}
                      onChange={(e) =>
                        updateActiveReceipt((r) => ({
                          ...r,
                          serviceChargeRate: Math.max(0, Number(e.target.value) || 0),
                        }))
                      }
                      className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-700 bg-[#131C31] px-3 py-2 text-base text-white tabular-nums"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="vat-rate-input"
                      className="block text-xs font-semibold text-slate-400"
                    >
                      VAT (%)
                    </label>
                    <input
                      id="vat-rate-input"
                      type="number"
                      min="0"
                      step="0.5"
                      inputMode="decimal"
                      value={activeReceipt.vatRate}
                      onChange={(e) =>
                        updateActiveReceipt((r) => ({
                          ...r,
                          vatRate: Math.max(0, Number(e.target.value) || 0),
                        }))
                      }
                      className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-700 bg-[#131C31] px-3 py-2 text-base text-white tabular-nums"
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="flex min-h-[44px] w-full cursor-pointer items-center gap-2 rounded-xl border border-slate-700 bg-[#131C31] px-3 py-2 text-xs font-medium text-slate-200">
                      <input
                        type="checkbox"
                        checked={activeReceipt.vatOnServiceCharge}
                        onChange={(e) =>
                          updateActiveReceipt((r) => ({
                            ...r,
                            vatOnServiceCharge: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded accent-teal-500"
                      />
                      <span>คิด VAT ทบ SC (++)</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Bill-level Discount Panel */}
              <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Tag className="h-4 w-4 text-amber-300" />
                  <span className="text-xs font-bold text-amber-200">
                    ส่วนลดรวมทั้งบิล (ท้ายใบเสร็จ)
                  </span>
                </div>

                <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        { id: 'none', label: 'ไม่มี' },
                        { id: 'amount', label: 'ลดเป็นบาท (฿)' },
                        { id: 'percent', label: 'ลดเป็น %' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          updateActiveReceipt((r) => ({
                            ...r,
                            billDiscountType: opt.id,
                            billDiscountValue:
                              opt.id === 'none' ? 0 : r.billDiscountValue,
                          }))
                        }
                        className={`min-h-[40px] rounded-xl border px-3 py-1.5 text-xs font-semibold ${
                          activeReceipt.billDiscountType === opt.id
                            ? 'border-amber-400 bg-amber-400 text-slate-950'
                            : 'border-slate-700 bg-[#0D1526] text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {activeReceipt.billDiscountType !== 'none' && (
                    <>
                      <div>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={
                            activeReceipt.billDiscountValue > 0
                              ? activeReceipt.billDiscountValue
                              : ''
                          }
                          onChange={(e) =>
                            updateActiveReceipt((r) => ({
                              ...r,
                              billDiscountValue: Math.max(
                                0,
                                Number(e.target.value) || 0,
                              ),
                            }))
                          }
                          placeholder={
                            activeReceipt.billDiscountType === 'percent'
                              ? 'เช่น 10 (%)'
                              : 'เช่น 50 (บาท)'
                          }
                          aria-label="จำนวนส่วนลดท้ายบิล"
                          className="min-h-[44px] w-full rounded-xl border border-amber-400/40 bg-[#0D1526] px-3 py-2 text-base text-white tabular-nums outline-none focus:border-amber-400"
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <select
                          aria-label="วิธีแบ่งส่วนลดท้ายบิล"
                          value={activeReceipt.billDiscountAllocation}
                          onChange={(e) =>
                            updateActiveReceipt((r) => ({
                              ...r,
                              billDiscountAllocation: e.target
                                .value as BillDiscountAllocation,
                            }))
                          }
                          className="min-h-[44px] w-full rounded-xl border border-amber-400/40 bg-[#0D1526] px-3 py-2 text-base text-slate-100 sm:text-sm"
                        >
                          <option value="proportional">
                            กระจายตามสัดส่วนยอดซื้อ
                          </option>
                          <option value="equal">หารเท่ากันทุกคน</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>

                {activeReceipt.billDiscountType !== 'none' &&
                  (activeReceipt.serviceChargeRate > 0 ||
                    activeReceipt.vatRate > 0) && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-slate-300">จังหวะคิดส่วนลด:</span>
                      {(
                        [
                          { id: 'before_tax', label: 'ลดก่อนคิด SC/VAT' },
                          { id: 'after_tax', label: 'ลดหลังรวม SC/VAT แล้ว' },
                        ] as Array<{ id: BillDiscountTiming; label: string }>
                      ).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() =>
                            updateActiveReceipt((r) => ({
                              ...r,
                              billDiscountTiming: t.id,
                            }))
                          }
                          className={`min-h-[36px] rounded-lg border px-2.5 py-1 text-xs font-medium ${
                            activeReceipt.billDiscountTiming === t.id
                              ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                              : 'border-slate-700 bg-[#0D1526] text-slate-400'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  )}
              </div>

              {/* Actual Receipt Total Checksum */}
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <label
                  htmlFor="actual-total-input"
                  className="text-xs font-medium text-slate-400"
                >
                  เช็กยอดตรงใบเสร็จจริง (ไม่บังคับกรอก):
                </label>
                <input
                  id="actual-total-input"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={
                    activeReceipt.actualReceiptTotal !== null
                      ? activeReceipt.actualReceiptTotal
                      : ''
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    updateActiveReceipt((r) => ({
                      ...r,
                      actualReceiptTotal:
                        val === '' ? null : Math.max(0, Number(val) || 0),
                    }));
                  }}
                  placeholder="กรอกยอดสุทธิท้ายบิลเพื่อตรวจทาน"
                  className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-[#0D1526] px-3.5 py-2 text-base text-white tabular-nums outline-none focus:border-teal-400 sm:w-64"
                />
              </div>
            </div>
          </div>

          {/* Sushi Belt Plate Counter when category === 'sushi' */}
          {activeReceipt.category === 'sushi' && (
            <SushiPlateCounter
              receipt={activeReceipt}
              shopAttendees={shopAttendees}
              onUpdateReceipt={updateActiveReceipt}
            />
          )}

          {/* Add Line Item Form */}
          <form
            onSubmit={handleAddItem}
            className="rounded-2xl border border-slate-800 bg-[#131C31] p-5 shadow-lg shadow-black/20"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-bold text-white">
                {activeReceipt.category === 'sushi'
                  ? '+ เพิ่มเมนูเสริมนอกสายพาน (ชาเขียว / ราเมง / ของหวาน / น้ำซุป)'
                  : '+ เพิ่มรายการอาหาร / สินค้า'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowItemDiscount((v) => !v);
                  if (!showItemDiscount && itemDiscType === 'none') {
                    setItemDiscType('amount');
                  }
                }}
                className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  showItemDiscount
                    ? 'border-amber-400/40 bg-amber-500/15 text-amber-200'
                    : 'border-slate-700 bg-[#0D1526] text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Percent className="h-3.5 w-3.5" />
                <span>
                  {showItemDiscount
                    ? 'ซ่อนส่วนลดเฉพาะชิ้น'
                    : 'มีส่วนลดเฉพาะชิ้นนี้ (เช่น ป้ายเหลือง)'}
                </span>
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-12">
              <div className="sm:col-span-6">
                <label
                  htmlFor="item-name-input"
                  className="block text-xs font-semibold text-slate-400"
                >
                  ชื่อเมนู / สินค้า
                </label>
                <input
                  id="item-name-input"
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder={
                    activeReceipt.category === 'sushi'
                      ? 'เช่น ชาเขียวรีฟิล, ราเมง, ไอศกรีม...'
                      : 'เช่น กะเพราหมูกรอบ, นมแพ็ค, น้ำแข็ง...'
                  }
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-700 bg-[#0D1526] px-3.5 py-2 text-base text-white outline-none focus:border-teal-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 sm:col-span-6">
                <div>
                  <label
                    htmlFor="item-price-input"
                    className="block text-xs font-semibold text-slate-400"
                  >
                    ราคาต่อหน่วย (฿)
                  </label>
                  <input
                    id="item-price-input"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    placeholder="0.00"
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-700 bg-[#0D1526] px-3.5 py-2 text-base text-white tabular-nums outline-none focus:border-teal-400"
                  />
                </div>
                <div>
                  <label
                    htmlFor="item-qty-input"
                    className="block text-xs font-semibold text-slate-400"
                  >
                    จำนวน
                  </label>
                  <input
                    id="item-qty-input"
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={itemQty}
                    onChange={(e) => setItemQty(e.target.value)}
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-700 bg-[#0D1526] px-3.5 py-2 text-base text-white tabular-nums outline-none focus:border-teal-400"
                  />
                </div>
              </div>
            </div>

            {showItemDiscount && (
              <div className="mt-3 grid grid-cols-1 gap-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 sm:grid-cols-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-amber-200">
                    ส่วนลดเฉพาะรายการนี้:
                  </span>
                  {(
                    [
                      { id: 'amount', label: 'ลดเป็นบาท (฿)' },
                      { id: 'percent', label: 'ลดเป็น %' },
                      { id: 'none', label: 'ไม่ลด' },
                    ] as const
                  ).map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setItemDiscType(d.id)}
                      className={`min-h-[38px] rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                        itemDiscType === d.id
                          ? 'border-amber-400 bg-amber-400 text-slate-950'
                          : 'border-slate-700 bg-[#0D1526] text-slate-300'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>

                {itemDiscType !== 'none' && (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={itemDiscVal}
                    onChange={(e) => setItemDiscVal(e.target.value)}
                    placeholder={
                      itemDiscType === 'percent' ? 'ส่วนลด %' : 'ส่วนลดเป็นบาท'
                    }
                    aria-label="ส่วนลดเฉพาะรายการ"
                    className="min-h-[44px] w-full rounded-xl border border-amber-400/40 bg-[#0D1526] px-3 py-2 text-base text-white tabular-nums outline-none focus:border-amber-400"
                  />
                )}
              </div>
            )}

            {(activeReceipt.serviceChargeRate > 0 || activeReceipt.vatRate > 0) && (
              <div className="mt-3 flex flex-wrap gap-3">
                {activeReceipt.serviceChargeRate > 0 && (
                  <label className="inline-flex min-h-[38px] cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-[#0D1526] px-3 py-1 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={itemExemptSC}
                      onChange={(e) => setItemExemptSC(e.target.checked)}
                      className="h-4 w-4 rounded accent-teal-500"
                    />
                    <span>รายการนี้ไม่คิด SC</span>
                  </label>
                )}
                {activeReceipt.vatRate > 0 && (
                  <label className="inline-flex min-h-[38px] cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-[#0D1526] px-3 py-1 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={itemExemptVAT}
                      onChange={(e) => setItemExemptVAT(e.target.checked)}
                      className="h-4 w-4 rounded accent-teal-500"
                    />
                    <span>รายการนี้ไม่คิด VAT</span>
                  </label>
                )}
              </div>
            )}

            {/* Owner selection */}
            <div className="mt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-400">
                  ใครสั่ง / แชร์รายการนี้: (เลือกหลายคนเพื่อหารเท่า)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const allSelected =
                      shopAttendees.length > 0 &&
                      shopAttendees.every((p) => itemOwners.includes(p.id));
                    setItemOwners(
                      allSelected ? [] : shopAttendees.map((p) => p.id),
                    );
                  }}
                  className="text-xs font-semibold text-teal-300 hover:underline"
                >
                  {shopAttendees.every((p) => itemOwners.includes(p.id))
                    ? 'ล้างการเลือก'
                    : 'เลือกทุกคนในร้านนี้'}
                </button>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {shopAttendees.map((p) => {
                  const selected = itemOwners.includes(p.id);
                  const palette = getFriendColor(p.color);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleNewItemOwner(p.id)}
                      className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                        selected
                          ? `${palette.bgClass} ${palette.textClass} border-transparent shadow-xs`
                          : 'border-slate-700 bg-[#0D1526] text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <AvatarBadge
                        name={p.name}
                        color={p.color}
                        avatarUrl={p.avatarDataUrl}
                        size="xs"
                      />
                      <span>{p.name}</span>
                      {selected && <Check className="h-3.5 w-3.5" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={!itemName.trim() && !(Number(itemPrice) > 0)}
                className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-teal-500 px-6 py-2.5 text-sm font-bold text-slate-950 shadow-sm shadow-teal-500/20 transition-colors hover:bg-teal-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                <span>เพิ่มรายการ</span>
              </button>
            </div>
          </form>

          {/* Items List (Card per Item) */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-bold text-white">
                {activeReceipt.category === 'sushi'
                  ? `เมนูเสริมนอกสายพาน (${activeReceipt.items.length} รายการ)`
                  : `รายการทั้งหมดในร้านนี้ (${activeReceipt.items.length} รายการ)`}
              </h3>
              {receiptCalc.unassignedItems.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-200">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>
                    ยังไม่ได้ระบุคนสั่ง {receiptCalc.unassignedItems.length} รายการ
                  </span>
                </span>
              )}
            </div>

            {activeReceipt.items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-[#131C31] p-6 text-center text-sm text-slate-400">
                {activeReceipt.category === 'sushi'
                  ? 'ยังไม่มีเมนูเสริมนอกสายพาน (ถ้ามีแค่จานสีบนสายพาน กดปุ่มสรุปยอดด้านล่าง/ขวาได้เลย)'
                  : 'ยังไม่มีรายการอาหาร/สินค้าในร้านนี้ เพิ่มรายการแรกจากแบบฟอร์มด้านบนได้เลย'}
              </div>
            ) : (
              activeReceipt.items.map((item) => {
                const { gross, itemDiscount, net } = calculateLineItem(item);
                const isEditing = editingItemId === item.id && editDraft;
                const assignedCount = item.shares.filter((s) => s.weight > 0).length;

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border bg-[#131C31] p-4 shadow-lg shadow-black/20 transition-colors ${
                      assignedCount === 0
                        ? 'border-amber-400/50 bg-amber-500/5'
                        : 'border-slate-800'
                    }`}
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                          <input
                            type="text"
                            value={editDraft.name}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, name: e.target.value })
                            }
                            aria-label="แก้ไขชื่อรายการ"
                            className="min-h-[44px] rounded-xl border border-slate-700 bg-[#0D1526] px-3 py-2 text-base text-white sm:col-span-6"
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={editDraft.unitPrice}
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                unitPrice: e.target.value,
                              })
                            }
                            aria-label="แก้ไขราคา"
                            className="min-h-[44px] rounded-xl border border-slate-700 bg-[#0D1526] px-3 py-2 text-base text-white tabular-nums sm:col-span-3"
                          />
                          <input
                            type="number"
                            min="1"
                            step="1"
                            inputMode="numeric"
                            value={editDraft.quantity}
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                quantity: e.target.value,
                              })
                            }
                            aria-label="แก้ไขจำนวน"
                            className="min-h-[44px] rounded-xl border border-slate-700 bg-[#0D1526] px-3 py-2 text-base text-white tabular-nums sm:col-span-3"
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 p-2.5">
                          <span className="text-xs font-semibold text-amber-200">
                            ส่วนลดรายการ:
                          </span>
                          {(['none', 'amount', 'percent'] as const).map((dt) => (
                            <button
                              key={dt}
                              type="button"
                              onClick={() =>
                                setEditDraft({ ...editDraft, discountType: dt })
                              }
                              className={`min-h-[36px] rounded-lg border px-2.5 text-xs font-semibold ${
                                editDraft.discountType === dt
                                  ? 'border-amber-400 bg-amber-400 text-slate-950'
                                  : 'border-slate-700 bg-[#0D1526] text-slate-300'
                              }`}
                            >
                              {dt === 'none'
                                ? 'ไม่ลด'
                                : dt === 'amount'
                                  ? 'ลด ฿'
                                  : 'ลด %'}
                            </button>
                          ))}
                          {editDraft.discountType !== 'none' && (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              inputMode="decimal"
                              value={editDraft.discountValue}
                              onChange={(e) =>
                                setEditDraft({
                                  ...editDraft,
                                  discountValue: e.target.value,
                                })
                              }
                              className="min-h-[40px] w-28 rounded-lg border border-amber-400/40 bg-[#0D1526] px-2.5 text-base text-white tabular-nums"
                            />
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => saveEditItem(item.id)}
                            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-teal-500 px-4 py-2 text-sm font-bold text-slate-950"
                          >
                            <Check className="h-4 w-4" />
                            <span>บันทึก</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingItemId(null);
                              setEditDraft(null);
                            }}
                            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-700 bg-[#0D1526] px-4 py-2 text-sm font-medium text-slate-300"
                          >
                            <X className="h-4 w-4" />
                            <span>ยกเลิก</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="break-words text-base font-bold text-white">
                              {item.name}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                              <span className="tabular-nums">
                                {item.quantity > 1
                                  ? `${item.quantity} × ${formatBaht(item.unitPrice)} = ${formatBaht(gross)}`
                                  : `ราคา ${formatBaht(gross)}`}
                              </span>
                              {itemDiscount > 0 && (
                                <span className="rounded-md border border-amber-400/30 bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-200">
                                  {item.discountType === 'percent'
                                    ? `ลด ${item.discountValue}% (-${formatBaht(itemDiscount)})`
                                    : `ลด -${formatBaht(itemDiscount)}`}
                                </span>
                              )}
                              {item.exemptSC && (
                                <span className="rounded-md bg-slate-800 px-2 py-0.5 text-slate-300">
                                  ยกเว้น SC
                                </span>
                              )}
                              {item.exemptVAT && (
                                <span className="rounded-md bg-slate-800 px-2 py-0.5 text-slate-300">
                                  ยกเว้น VAT
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-1.5">
                            <div className="mr-1 text-right">
                              <p className="text-lg font-bold text-teal-300 tabular-nums whitespace-nowrap">
                                {formatBaht(net)}
                              </p>
                              {assignedCount > 1 && (
                                <p className="text-xs text-slate-400 tabular-nums whitespace-nowrap">
                                  คนละ {formatBaht(net / assignedCount)}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => startEditItem(item)}
                              aria-label={`แก้ไข ${item.name}`}
                              className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-slate-700 bg-[#0D1526] text-slate-300 hover:bg-slate-800"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => duplicateItem(item)}
                              aria-label={`ทำสำเนา ${item.name}`}
                              className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-slate-700 bg-[#0D1526] text-slate-300 hover:bg-slate-800"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteItem(item.id)}
                              aria-label={`ลบ ${item.name}`}
                              className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-slate-700 bg-[#0D1526] text-rose-400 hover:bg-rose-500/15"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* 1-tap owner chips with profile photos */}
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3">
                          {shopAttendees.map((p) => {
                            const isOwner = item.shares.some(
                              (s) => s.participantId === p.id && s.weight > 0,
                            );
                            const palette = getFriendColor(p.color);
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => toggleItemShare(item.id, p.id)}
                                className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                                  isOwner
                                    ? `${palette.bgClass} ${palette.textClass} border-transparent`
                                    : 'border-slate-700 bg-[#0D1526] text-slate-300 hover:border-slate-600'
                                }`}
                              >
                                <AvatarBadge
                                  name={p.name}
                                  color={p.color}
                                  avatarUrl={p.avatarDataUrl}
                                  size="xs"
                                />
                                <span>{p.name}</span>
                                {isOwner && <Check className="h-3 w-3" />}
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => assignItemToAllAttendees(item.id)}
                            className="min-h-[40px] rounded-full border border-dashed border-slate-600 px-3 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                          >
                            ทุกคนในร้าน
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column (Desktop) / Inline Summary Card below Items (iPad & Mobile) */}
        <aside className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-[#131C31] p-5 shadow-lg shadow-black/20">
            <h3 className="text-base font-bold text-white">
              สรุปยอดร้าน: {activeReceipt.shopName}
            </h3>

            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-400">ยอดอาหาร/สินค้า (ก่อนลด)</dt>
                <dd className="font-semibold text-slate-100 tabular-nums whitespace-nowrap">
                  {formatBaht(receiptCalc.itemsGrossTotal)}
                </dd>
              </div>
              {receiptCalc.itemDiscountTotal > 0 && (
                <div className="flex items-center justify-between gap-2 text-amber-300">
                  <dt>ส่วนลดเฉพาะรายการ</dt>
                  <dd className="font-semibold tabular-nums whitespace-nowrap">
                    -{formatBaht(receiptCalc.itemDiscountTotal)}
                  </dd>
                </div>
              )}
              {receiptCalc.billDiscountTotal > 0 && (
                <div className="flex items-center justify-between gap-2 text-amber-300">
                  <dt>ส่วนลดรวมท้ายบิล</dt>
                  <dd className="font-semibold tabular-nums whitespace-nowrap">
                    -{formatBaht(receiptCalc.billDiscountTotal)}
                  </dd>
                </div>
              )}
              {receiptCalc.serviceChargeTotal > 0 && (
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-slate-400">
                    Service Charge ({activeReceipt.serviceChargeRate}%)
                  </dt>
                  <dd className="font-semibold text-slate-100 tabular-nums whitespace-nowrap">
                    +{formatBaht(receiptCalc.serviceChargeTotal)}
                  </dd>
                </div>
              )}
              {receiptCalc.vatTotal > 0 && (
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-slate-400">
                    VAT ({activeReceipt.vatRate}%)
                  </dt>
                  <dd className="font-semibold text-slate-100 tabular-nums whitespace-nowrap">
                    +{formatBaht(receiptCalc.vatTotal)}
                  </dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-2 border-t border-slate-800 pt-3">
                <dt className="font-bold text-white">รวมสุทธิร้านนี้</dt>
                <dd className="text-xl font-bold text-teal-300 tabular-nums whitespace-nowrap">
                  {formatBaht(receiptCalc.calculatedTotal)}
                </dd>
              </div>
            </dl>

            {/* Actual receipt checksum */}
            {receiptCalc.actualDiff !== null && (
              <div
                className={`mt-3 flex items-start gap-2 rounded-xl border p-3 text-xs font-medium ${
                  Math.abs(receiptCalc.actualDiff) <= 1
                    ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200'
                    : 'border-amber-400/30 bg-amber-500/15 text-amber-200'
                }`}
              >
                {Math.abs(receiptCalc.actualDiff) <= 1 ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <span>
                  {Math.abs(receiptCalc.actualDiff) <= 0.05
                    ? 'ยอดตรงกับใบเสร็จจริง 100% ✓'
                    : receiptCalc.actualDiff > 0
                      ? `ยอดคำนวณต่ำกว่าใบเสร็จจริง ${formatBaht(receiptCalc.actualDiff)}`
                      : `ยอดคำนวณสูงกว่าใบเสร็จจริง ${formatBaht(Math.abs(receiptCalc.actualDiff))}`}
                </span>
              </div>
            )}

            {receiptCalc.unassignedItems.length > 0 && (
              <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/15 p-3 text-xs text-amber-200">
                มี {receiptCalc.unassignedItems.length} รายการ (
                {formatBaht(receiptCalc.unassignedTotal)}) ที่ยังไม่ได้กดเลือกชื่อเพื่อน — ยอดจะยังไม่ถูกนำไปหารจนกว่าจะเลือกคนสั่ง
              </div>
            )}

            {/* Per-person total in this shop */}
            <div className="mt-4 border-t border-slate-800 pt-4">
              <p className="text-xs font-bold text-slate-400">
                แยกยอดร้านนี้รายบุคคล
              </p>
              <div className="mt-2.5 space-y-2">
                {shopAttendees.map((p) => {
                  const b = receiptCalc.personBreakdowns[p.id];
                  const amt = b ? b.total : 0;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <AvatarBadge
                          name={p.name}
                          color={p.color}
                          avatarUrl={p.avatarDataUrl}
                          size="sm"
                        />
                        <span className="truncate font-medium text-slate-200">
                          {p.name}
                        </span>
                      </div>
                      <span className="shrink-0 font-bold text-white tabular-nums whitespace-nowrap">
                        {formatBaht(amt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={onGoToSummary}
              className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-teal-500 px-4 py-3 text-sm font-bold text-slate-950 shadow-sm shadow-teal-500/20 transition-colors hover:bg-teal-400"
            >
              <span>สรุปยอดทั้งวัน &amp; แชร์ QR</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
