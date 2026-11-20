import { PlateTier, ReceiptCategory, ShopTemplate } from '../types';

export interface FriendColorOption {
  id: string;
  name: string;
  bgClass: string;
  textClass: string;
  ringClass: string;
  softBgClass: string;
  hex: string;
}

export const FRIEND_COLORS: FriendColorOption[] = [
  {
    id: 'teal',
    name: 'เขียวมินต์',
    bgClass: 'bg-teal-500',
    textClass: 'text-slate-950',
    ringClass: 'ring-teal-400',
    softBgClass: 'bg-teal-500/15 text-teal-200 border-teal-400/35',
    hex: '#14b8a6',
  },
  {
    id: 'sky',
    name: 'ฟ้า',
    bgClass: 'bg-sky-500',
    textClass: 'text-slate-950',
    ringClass: 'ring-sky-400',
    softBgClass: 'bg-sky-500/15 text-sky-200 border-sky-400/35',
    hex: '#0ea5e9',
  },
  {
    id: 'indigo',
    name: 'คราม',
    bgClass: 'bg-indigo-500',
    textClass: 'text-white',
    ringClass: 'ring-indigo-400',
    softBgClass: 'bg-indigo-500/20 text-indigo-200 border-indigo-400/40',
    hex: '#6366f1',
  },
  {
    id: 'amber',
    name: 'อำพัน',
    bgClass: 'bg-amber-400',
    textClass: 'text-slate-950',
    ringClass: 'ring-amber-300',
    softBgClass: 'bg-amber-500/15 text-amber-200 border-amber-400/35',
    hex: '#f59e0b',
  },
  {
    id: 'rose',
    name: 'ชมพูกุหลาบ',
    bgClass: 'bg-rose-500',
    textClass: 'text-white',
    ringClass: 'ring-rose-400',
    softBgClass: 'bg-rose-500/15 text-rose-200 border-rose-400/35',
    hex: '#f43f5e',
  },
  {
    id: 'emerald',
    name: 'เขียวมรกต',
    bgClass: 'bg-emerald-500',
    textClass: 'text-slate-950',
    ringClass: 'ring-emerald-400',
    softBgClass: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/35',
    hex: '#10b981',
  },
  {
    id: 'violet',
    name: 'ม่วง',
    bgClass: 'bg-violet-500',
    textClass: 'text-white',
    ringClass: 'ring-violet-400',
    softBgClass: 'bg-violet-500/20 text-violet-200 border-violet-400/40',
    hex: '#8b5cf6',
  },
  {
    id: 'slate',
    name: 'เงิน',
    bgClass: 'bg-slate-600',
    textClass: 'text-white',
    ringClass: 'ring-slate-400',
    softBgClass: 'bg-slate-700/60 text-slate-200 border-slate-500/50',
    hex: '#475569',
  },
  {
    id: 'orange',
    name: 'ส้ม',
    bgClass: 'bg-orange-500',
    textClass: 'text-slate-950',
    ringClass: 'ring-orange-400',
    softBgClass: 'bg-orange-500/15 text-orange-200 border-orange-400/35',
    hex: '#f97316',
  },
  {
    id: 'pink',
    name: 'ชมพูสด',
    bgClass: 'bg-pink-500',
    textClass: 'text-white',
    ringClass: 'ring-pink-400',
    softBgClass: 'bg-pink-500/15 text-pink-200 border-pink-400/35',
    hex: '#ec4899',
  },
];

export function getFriendColor(colorId?: string): FriendColorOption {
  return FRIEND_COLORS.find((c) => c.id === colorId) ?? FRIEND_COLORS[1];
}

export const SUSHIRO_PLATE_TIERS: PlateTier[] = [
  { id: 'sushiro_white_30', label: 'จานขาว', colorHex: '#f8fafc', price: 30 },
  { id: 'sushiro_red_40', label: 'จานแดง', colorHex: '#ef4444', price: 40 },
  { id: 'sushiro_silver_60', label: 'จานเงิน', colorHex: '#cbd5e1', price: 60 },
  { id: 'sushiro_gold_80', label: 'จานทอง', colorHex: '#d97706', price: 80 },
  { id: 'sushiro_black_100', label: 'จานดำ', colorHex: '#1e293b', price: 100 },
];

export const DEFAULT_SUSHI_PLATE_TIERS: PlateTier[] = SUSHIRO_PLATE_TIERS.map(
  (t) => ({ ...t }),
);

export const ALT_120_SUSHI_PLATE_TIERS: PlateTier[] = [
  { id: 'alt_white_30', label: 'จานขาว', colorHex: '#f8fafc', price: 30 },
  { id: 'alt_red_40', label: 'จานแดง', colorHex: '#ef4444', price: 40 },
  { id: 'alt_silver_60', label: 'จานเงิน', colorHex: '#cbd5e1', price: 60 },
  { id: 'alt_gold_80', label: 'จานทอง', colorHex: '#d97706', price: 80 },
  { id: 'alt_black_120', label: 'จานดำ', colorHex: '#1e293b', price: 120 },
];

export const BUILTIN_SUSHIRO_TEMPLATE_ID = 'tpl_builtin_sushiro';

export const BUILTIN_SHOP_TEMPLATES: ShopTemplate[] = [
  {
    id: BUILTIN_SUSHIRO_TEMPLATE_ID,
    name: 'Sushiro',
    category: 'sushi',
    serviceChargeRate: 10,
    vatRate: 7,
    vatOnServiceCharge: true,
    plateTiers: SUSHIRO_PLATE_TIERS.map((t) => ({ ...t })),
    isPinned: true,
    lastUsedAt: '2026-01-01T00:00:00.000Z',
  },
];

export const PLATE_COLOR_CHOICES: Array<{ label: string; hex: string }> = [
  { label: 'ขาว', hex: '#f8fafc' },
  { label: 'เงิน', hex: '#cbd5e1' },
  { label: 'เหลือง', hex: '#facc15' },
  { label: 'ทอง', hex: '#d97706' },
  { label: 'ส้ม', hex: '#f97316' },
  { label: 'แดง', hex: '#ef4444' },
  { label: 'ชมพู', hex: '#ec4899' },
  { label: 'ม่วง', hex: '#a855f7' },
  { label: 'ฟ้า', hex: '#38bdf8' },
  { label: 'น้ำเงิน', hex: '#2563eb' },
  { label: 'เขียวอ่อน', hex: '#22c55e' },
  { label: 'เขียวเข้ม', hex: '#15803d' },
  { label: 'น้ำตาล', hex: '#92400e' },
  { label: 'ดำ', hex: '#1e293b' },
];

export interface ReceiptPreset {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  category: ReceiptCategory;
  serviceChargeRate: number;
  vatRate: number;
  vatOnServiceCharge: boolean;
}

export const RECEIPT_PRESETS: ReceiptPreset[] = [
  {
    id: 'restaurant_pp',
    label: 'ร้านอาหาร (++)',
    shortLabel: 'SC 10% + VAT 7%',
    description: 'คิด Service Charge 10% แล้วทบ VAT 7%',
    category: 'restaurant',
    serviceChargeRate: 10,
    vatRate: 7,
    vatOnServiceCharge: true,
  },
  {
    id: 'restaurant_vat',
    label: 'ร้านอาหาร (VAT 7%)',
    shortLabel: 'VAT 7%',
    description: 'ไม่มี Service Charge คิดเฉพาะ VAT 7%',
    category: 'restaurant',
    serviceChargeRate: 0,
    vatRate: 7,
    vatOnServiceCharge: false,
  },
  {
    id: 'cafe_net',
    label: 'คาเฟ่ / ร้านทั่วไป (Net)',
    shortLabel: 'Net 0%',
    description: 'ราคารวมภาษีแล้ว ไม่บวกเพิ่ม',
    category: 'cafe',
    serviceChargeRate: 0,
    vatRate: 0,
    vatOnServiceCharge: false,
  },
  {
    id: 'supermarket',
    label: 'ซูเปอร์มาร์เก็ต (Net + ส่วนลด)',
    shortLabel: 'ซูเปอร์ฯ + ส่วนลด',
    description: 'ราคารวม VAT แล้ว พร้อมช่องกรอกส่วนลดรายชิ้นและท้ายบิล',
    category: 'supermarket',
    serviceChargeRate: 0,
    vatRate: 0,
    vatOnServiceCharge: false,
  },
  {
    id: 'sushi_belt',
    label: 'ซูชิสายพาน (นับจานสี ++)',
    shortLabel: 'จานสี + SC 10% + VAT 7%',
    description: 'นับจำนวนจานแต่ละสีรายคน (ขาว 30 / แดง 40 / เงิน 60 / ทอง 80 / ดำ 100) + เมนูเสริม',
    category: 'sushi',
    serviceChargeRate: 10,
    vatRate: 7,
    vatOnServiceCharge: true,
  },
];

export const CATEGORY_LABELS: Record<ReceiptCategory, string> = {
  restaurant: 'ร้านอาหาร',
  cafe: 'คาเฟ่ / ของหวาน',
  supermarket: 'ซูเปอร์มาร์เก็ต',
  sushi: 'ซูชิสายพาน',
  other: 'ร้านอื่นๆ',
};

export function formatNumber(amount: number, decimals = 2): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const isWhole = Math.abs(safe - Math.round(safe)) < 0.005;
  return safe.toLocaleString('th-TH', {
    minimumFractionDigits: isWhole ? 0 : decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatBaht(amount: number, forceDecimals = false): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const isWhole = !forceDecimals && Math.abs(safe - Math.round(safe)) < 0.005;
  const formatted = safe.toLocaleString('th-TH', {
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `฿${formatted}`;
}

const THAI_MONTHS_SHORT = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];

export function formatThaiDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const year = Number(match[1]) + 543;
  const monthIdx = Number(match[2]) - 1;
  const day = Number(match[3]);
  const monthLabel = THAI_MONTHS_SHORT[monthIdx] ?? match[2];
  return `${day} ${monthLabel} ${year}`;
}

export function todayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function createId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function sortShopTemplates(templates: ShopTemplate[]): ShopTemplate[] {
  return [...templates].sort((a, b) => {
    const pinDiff = Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned));
    if (pinDiff !== 0) return pinDiff;
    return (b.lastUsedAt || '').localeCompare(a.lastUsedAt || '');
  });
}
