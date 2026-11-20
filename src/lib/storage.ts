import {
  AppState,
  DailySession,
  Friend,
  ME_ID,
  PaymentProfile,
  PlateTier,
  Receipt,
  ReceiptCategory,
  ShopTemplate,
} from '../types';
import {
  BUILTIN_SHOP_TEMPLATES,
  DEFAULT_SUSHI_PLATE_TIERS,
  createId,
  todayIsoDate,
} from './format';

export const STORAGE_KEY = 'splitbill_thai_v1';

function cloneShopTemplate(tpl: ShopTemplate): ShopTemplate {
  return {
    ...tpl,
    plateTiers: tpl.plateTiers
      ? tpl.plateTiers.map((t) => ({ ...t }))
      : undefined,
  };
}

export function getDefaultPaymentProfile(): PaymentProfile {
  return {
    promptPayId: '',
    accountName: '',
    bankName: '',
    accountNumber: '',
    customQrImageDataUrl: null,
    preferredQrMode: 'promptpay_dynamic',
  };
}

export function getDefaultState(): AppState {
  return {
    version: 1,
    myName: 'ฉัน',
    myColor: 'teal',
    myAvatarDataUrl: null,
    friends: [],
    paymentProfile: getDefaultPaymentProfile(),
    sessions: [],
    activeSessionId: null,
    shopTemplates: BUILTIN_SHOP_TEMPLATES.map(cloneShopTemplate),
    seededBuiltInTemplateIds: BUILTIN_SHOP_TEMPLATES.map((t) => t.id),
  };
}

export function loadAppState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return normalizeAppState(parsed);
  } catch {
    return getDefaultState();
  }
}

export function normalizeAppState(parsed: Partial<AppState>): AppState {
  const defaults = getDefaultState();
  const friends: Friend[] = Array.isArray(parsed.friends)
    ? parsed.friends.filter(
        (f): f is Friend =>
          Boolean(f) && typeof f.id === 'string' && typeof f.name === 'string',
      )
    : [];

  const sessions: DailySession[] = Array.isArray(parsed.sessions)
    ? parsed.sessions.filter(
        (s): s is DailySession =>
          Boolean(s) && typeof s.id === 'string' && Array.isArray(s.receipts),
      )
    : [];

  const profile: PaymentProfile = {
    ...defaults.paymentProfile,
    ...(parsed.paymentProfile ?? {}),
  };

  const shopTemplates: ShopTemplate[] = Array.isArray(parsed.shopTemplates)
    ? parsed.shopTemplates.filter(
        (t): t is ShopTemplate =>
          Boolean(t) && typeof t.id === 'string' && typeof t.name === 'string',
      )
    : [];

  const seededSet = new Set<string>(
    Array.isArray(parsed.seededBuiltInTemplateIds)
      ? parsed.seededBuiltInTemplateIds.filter(
          (id): id is string => typeof id === 'string',
        )
      : [],
  );

  const seededAdditions: ShopTemplate[] = [];
  for (const builtin of BUILTIN_SHOP_TEMPLATES) {
    if (!seededSet.has(builtin.id)) {
      seededSet.add(builtin.id);
      const builtinNameKey = builtin.name.trim().toLowerCase();
      const alreadyExists = shopTemplates.some(
        (t) =>
          t.id === builtin.id ||
          t.name.trim().toLowerCase() === builtinNameKey,
      );
      if (!alreadyExists) {
        seededAdditions.push(cloneShopTemplate(builtin));
      }
    }
  }

  return {
    version: 1,
    myName:
      typeof parsed.myName === 'string' && parsed.myName.trim()
        ? parsed.myName
        : 'ฉัน',
    myColor:
      typeof parsed.myColor === 'string' && parsed.myColor.trim()
        ? parsed.myColor
        : 'teal',
    myAvatarDataUrl:
      typeof parsed.myAvatarDataUrl === 'string' ? parsed.myAvatarDataUrl : null,
    friends,
    paymentProfile: profile,
    sessions,
    activeSessionId:
      typeof parsed.activeSessionId === 'string' &&
      sessions.some((s) => s.id === parsed.activeSessionId)
        ? parsed.activeSessionId
        : null,
    shopTemplates: [...seededAdditions, ...shopTemplates],
    seededBuiltInTemplateIds: Array.from(seededSet),
  };
}

export function saveAppState(state: AppState): { ok: boolean; error?: string } {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'ไม่สามารถบันทึกข้อมูลลงเครื่องได้';
    return { ok: false, error: message };
  }
}

export function compressQrImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('ไฟล์รูปภาพไม่ถูกต้อง'));
      img.onload = () => {
        const maxSide = 520;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('เบราว์เซอร์ไม่รองรับการประมวลผลรูปภาพ'));
          return;
        }

        // Fill white background for transparent PNGs so QR remains scannable
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        let dataUrl = canvas.toDataURL('image/png');
        if (dataUrl.length > 340_000) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        }
        resolve(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function compressAvatarImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('ไฟล์รูปภาพไม่ถูกต้อง'));
      img.onload = () => {
        const size = 160;
        const minSide = Math.min(img.width, img.height);
        const sx = Math.max(0, (img.width - minSide) / 2);
        const sy = Math.max(0, (img.height - minSide) / 2);

        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('เบราว์เซอร์ไม่รองรับการประมวลผลรูปภาพ'));
          return;
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);

        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function cloneDefaultSushiTiers(): PlateTier[] {
  return DEFAULT_SUSHI_PLATE_TIERS.map((t) => ({ ...t }));
}

export function createEmptyReceipt(
  attendeeIds: string[],
  payerId: string = ME_ID,
  index = 1,
  category: ReceiptCategory = 'restaurant',
): Receipt {
  const base: Receipt = {
    id: createId('rcpt'),
    shopName: `ร้านที่ ${index}`,
    category,
    payerId,
    attendeeIds: [...attendeeIds],
    serviceChargeRate: 10,
    vatRate: 7,
    vatOnServiceCharge: true,
    billDiscountType: 'none',
    billDiscountValue: 0,
    billDiscountAllocation: 'proportional',
    billDiscountTiming: 'before_tax',
    actualReceiptTotal: null,
    items: [],
  };

  if (category === 'sushi') {
    base.shopName = `ซูชิสายพาน (บิลที่ ${index})`;
    base.plateTiers = cloneDefaultSushiTiers();
    base.plateCounts = {};
  }

  return base;
}

export function createReceiptFromTemplate(
  template: ShopTemplate,
  attendeeIds: string[],
  payerId: string = ME_ID,
): Receipt {
  const receipt: Receipt = {
    id: createId('rcpt'),
    shopName: template.name,
    category: template.category,
    payerId,
    attendeeIds: [...attendeeIds],
    serviceChargeRate: template.serviceChargeRate,
    vatRate: template.vatRate,
    vatOnServiceCharge: template.vatOnServiceCharge,
    billDiscountType: 'none',
    billDiscountValue: 0,
    billDiscountAllocation: 'proportional',
    billDiscountTiming: 'before_tax',
    actualReceiptTotal: null,
    items: [],
  };

  if (template.category === 'sushi') {
    receipt.plateTiers =
      template.plateTiers && template.plateTiers.length > 0
        ? template.plateTiers.map((t) => ({ ...t }))
        : cloneDefaultSushiTiers();
    receipt.plateCounts = {};
  }

  return receipt;
}

export function createDemoData(): { friends: Friend[]; session: DailySession } {
  const fAkeId = createId('fr');
  const fBeamId = createId('fr');
  const fPloyId = createId('fr');
  const fNutId = createId('fr');

  const friends: Friend[] = [
    { id: fAkeId, name: 'เอก', color: 'sky', isDefaultGroup: true },
    { id: fBeamId, name: 'บีม', color: 'indigo', isDefaultGroup: true },
    { id: fPloyId, name: 'พลอย', color: 'rose', isDefaultGroup: true },
    { id: fNutId, name: 'นัท', color: 'amber', isDefaultGroup: true },
  ];

  const allGroup = [ME_ID, fAkeId, fBeamId, fPloyId, fNutId];
  const cafeGroup = [ME_ID, fAkeId, fBeamId, fNutId]; // พลอยไม่ได้ไปร้าน 2
  const superGroup = [ME_ID, fAkeId, fBeamId, fNutId];

  const nowIso = new Date().toISOString();

  const restaurantReceipt: Receipt = {
    id: createId('rcpt'),
    shopName: 'ร้านอาหารไทย (มื้อเที่ยง)',
    category: 'restaurant',
    payerId: ME_ID,
    attendeeIds: allGroup,
    serviceChargeRate: 10,
    vatRate: 7,
    vatOnServiceCharge: true,
    billDiscountType: 'none',
    billDiscountValue: 0,
    billDiscountAllocation: 'proportional',
    billDiscountTiming: 'before_tax',
    actualReceiptTotal: null,
    items: [
      {
        id: createId('item'),
        name: 'ข้าวผัดปูจานกลาง',
        unitPrice: 280,
        quantity: 1,
        discountType: 'none',
        discountValue: 0,
        shares: [{ participantId: ME_ID, weight: 1 }],
        exemptSC: false,
        exemptVAT: false,
      },
      {
        id: createId('item'),
        name: 'ปลากะพงทอดน้ำปลา',
        unitPrice: 450,
        quantity: 1,
        discountType: 'none',
        discountValue: 0,
        shares: [
          { participantId: fAkeId, weight: 1 },
          { participantId: fBeamId, weight: 1 },
        ],
        exemptSC: false,
        exemptVAT: false,
      },
      {
        id: createId('item'),
        name: 'ผัดไทยกุ้งสด',
        unitPrice: 220,
        quantity: 1,
        discountType: 'none',
        discountValue: 0,
        shares: [{ participantId: fPloyId, weight: 1 }],
        exemptSC: false,
        exemptVAT: false,
      },
      {
        id: createId('item'),
        name: 'แกงส้มชะอมกุ้ง',
        unitPrice: 320,
        quantity: 1,
        discountType: 'none',
        discountValue: 0,
        shares: [{ participantId: fNutId, weight: 1 }],
        exemptSC: false,
        exemptVAT: false,
      },
      {
        id: createId('item'),
        name: 'ต้มยำกุ้ง + น้ำเปล่า + น้ำแข็ง (แชร์ทุกคน)',
        unitPrice: 450,
        quantity: 1,
        discountType: 'none',
        discountValue: 0,
        shares: allGroup.map((id) => ({ participantId: id, weight: 1 })),
        exemptSC: false,
        exemptVAT: false,
      },
    ],
  };

  const cafeReceipt: Receipt = {
    id: createId('rcpt'),
    shopName: 'คาเฟ่ของหวาน (พลอยไม่ได้ไป)',
    category: 'cafe',
    payerId: ME_ID,
    attendeeIds: cafeGroup,
    serviceChargeRate: 0,
    vatRate: 0,
    vatOnServiceCharge: false,
    billDiscountType: 'none',
    billDiscountValue: 0,
    billDiscountAllocation: 'proportional',
    billDiscountTiming: 'before_tax',
    actualReceiptTotal: null,
    items: [
      {
        id: createId('item'),
        name: 'อเมริกาโน่เย็น',
        unitPrice: 95,
        quantity: 1,
        discountType: 'none',
        discountValue: 0,
        shares: [{ participantId: ME_ID, weight: 1 }],
        exemptSC: false,
        exemptVAT: false,
      },
      {
        id: createId('item'),
        name: 'มัทฉะลาเต้',
        unitPrice: 120,
        quantity: 1,
        discountType: 'none',
        discountValue: 0,
        shares: [{ participantId: fAkeId, weight: 1 }],
        exemptSC: false,
        exemptVAT: false,
      },
      {
        id: createId('item'),
        name: 'ฮันนี่โทสต์ (แชร์ บีม+นัท)',
        unitPrice: 240,
        quantity: 1,
        discountType: 'none',
        discountValue: 0,
        shares: [
          { participantId: fBeamId, weight: 1 },
          { participantId: fNutId, weight: 1 },
        ],
        exemptSC: false,
        exemptVAT: false,
      },
    ],
  };

  const supermarketReceipt: Receipt = {
    id: createId('rcpt'),
    shopName: 'ซูเปอร์มาร์เก็ต (มีส่วนลด)',
    category: 'supermarket',
    payerId: ME_ID,
    attendeeIds: superGroup,
    serviceChargeRate: 0,
    vatRate: 0,
    vatOnServiceCharge: false,
    billDiscountType: 'amount',
    billDiscountValue: 50,
    billDiscountAllocation: 'proportional',
    billDiscountTiming: 'before_tax',
    actualReceiptTotal: null,
    items: [
      {
        id: createId('item'),
        name: 'ผลไม้กล่องป้ายเหลือง (ลด ฿25)',
        unitPrice: 145,
        quantity: 1,
        discountType: 'amount',
        discountValue: 25,
        shares: [{ participantId: fAkeId, weight: 1 }],
        exemptSC: false,
        exemptVAT: false,
      },
      {
        id: createId('item'),
        name: 'นมแพ็ค (ลด 10%)',
        unitPrice: 180,
        quantity: 1,
        discountType: 'percent',
        discountValue: 10,
        shares: [{ participantId: fBeamId, weight: 1 }],
        exemptSC: false,
        exemptVAT: false,
      },
      {
        id: createId('item'),
        name: 'กาแฟขวด + ขนมทานเล่น',
        unitPrice: 158,
        quantity: 1,
        discountType: 'none',
        discountValue: 0,
        shares: [{ participantId: ME_ID, weight: 1 }],
        exemptSC: false,
        exemptVAT: false,
      },
      {
        id: createId('item'),
        name: 'เครื่องดื่มแพ็ค (หารกับนัทและฉัน)',
        unitPrice: 220,
        quantity: 1,
        discountType: 'none',
        discountValue: 0,
        shares: [
          { participantId: ME_ID, weight: 1 },
          { participantId: fNutId, weight: 1 },
        ],
        exemptSC: false,
        exemptVAT: false,
      },
    ],
  };

  const session: DailySession = {
    id: createId('ses'),
    date: todayIsoDate(),
    title: 'มื้อกลางวัน + คาเฟ่ + ซูเปอร์ฯ (ตัวอย่าง)',
    includeMe: true,
    participantIds: [fAkeId, fBeamId, fPloyId, fNutId],
    roundingMode: 'exact',
    receipts: [restaurantReceipt, cafeReceipt, supermarketReceipt],
    paidStatus: {},
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  return { friends, session };
}

export function exportBackupJson(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function parseBackupJson(json: string): AppState {
  const parsed = JSON.parse(json) as Partial<AppState>;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('ไฟล์สำรองข้อมูลไม่ถูกต้อง');
  }
  if (!Array.isArray(parsed.friends) || !Array.isArray(parsed.sessions)) {
    throw new Error('โครงสร้างข้อมูลในไฟล์ไม่ครบถ้วน');
  }
  return normalizeAppState(parsed);
}
