export const ME_ID = '__me__';

export type ReceiptCategory = 'restaurant' | 'cafe' | 'supermarket' | 'sushi' | 'other';
export type DiscountType = 'none' | 'percent' | 'amount';
export type BillDiscountAllocation = 'proportional' | 'equal';
export type BillDiscountTiming = 'before_tax' | 'after_tax';
export type RoundingMode = 'exact' | 'round_baht' | 'ceil_baht';
export type PreferredQrMode = 'promptpay_dynamic' | 'custom_image';

export interface PlateTier {
  id: string;
  label: string;
  colorHex: string;
  price: number;
}

export interface ShopTemplate {
  id: string;
  name: string;
  category: ReceiptCategory;
  serviceChargeRate: number;
  vatRate: number;
  vatOnServiceCharge: boolean;
  plateTiers?: PlateTier[];
  isPinned?: boolean;
  lastUsedAt: string;
}

export interface Friend {
  id: string;
  name: string;
  color: string;
  avatarDataUrl?: string | null;
  isDefaultGroup: boolean;
  note?: string;
}

export interface PaymentProfile {
  promptPayId: string;
  accountName: string;
  bankName: string;
  accountNumber: string;
  customQrImageDataUrl: string | null;
  preferredQrMode: PreferredQrMode;
}

export interface ItemShare {
  participantId: string;
  weight: number;
}

export interface LineItem {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
  discountType: DiscountType;
  discountValue: number;
  shares: ItemShare[];
  exemptSC: boolean;
  exemptVAT: boolean;
}

export interface Receipt {
  id: string;
  shopName: string;
  category: ReceiptCategory;
  payerId: string;
  attendeeIds: string[];
  serviceChargeRate: number;
  vatRate: number;
  vatOnServiceCharge: boolean;
  billDiscountType: DiscountType;
  billDiscountValue: number;
  billDiscountAllocation: BillDiscountAllocation;
  billDiscountTiming: BillDiscountTiming;
  actualReceiptTotal: number | null;
  items: LineItem[];
  plateTiers?: PlateTier[];
  plateCounts?: Record<string, Record<string, number>>;
  plateExemptSC?: boolean;
  plateExemptVAT?: boolean;
}

export interface DailySession {
  id: string;
  date: string;
  title: string;
  includeMe: boolean;
  participantIds: string[];
  roundingMode: RoundingMode;
  receipts: Receipt[];
  paidStatus: Record<string, boolean>;
  createdAt: string;
  updatedAt: string;
}

export interface AppState {
  version: number;
  myName: string;
  myAvatarDataUrl?: string | null;
  friends: Friend[];
  paymentProfile: PaymentProfile;
  sessions: DailySession[];
  activeSessionId: string | null;
  shopTemplates?: ShopTemplate[];
}

export interface ParticipantInfo {
  id: string;
  name: string;
  color: string;
  avatarDataUrl?: string | null;
  isMe: boolean;
}

export interface LineItemBreakdown {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  grossTotal: number;
  itemDiscountTotal: number;
  netTotal: number;
  shareRatio: number;
  shareGross: number;
  shareItemDiscount: number;
  shareNet: number;
  sharedCount: number;
  exemptSC: boolean;
  exemptVAT: boolean;
}

export interface PersonReceiptBreakdown {
  participantId: string;
  name: string;
  grossSubtotal: number;
  itemDiscountTotal: number;
  netFoodSubtotal: number;
  billDiscountShare: number;
  foodAfterBillDiscount: number;
  serviceCharge: number;
  vat: number;
  total: number;
  items: LineItemBreakdown[];
}

export interface ReceiptCalculation {
  receiptId: string;
  shopName: string;
  category: ReceiptCategory;
  payerId: string;
  itemsGrossTotal: number;
  itemDiscountTotal: number;
  itemsNetTotal: number;
  billDiscountTotal: number;
  serviceChargeTotal: number;
  vatTotal: number;
  calculatedTotal: number;
  unassignedTotal: number;
  unassignedItems: LineItem[];
  actualDiff: number | null;
  personBreakdowns: Record<string, PersonReceiptBreakdown>;
}

export interface PersonSessionSummary {
  participant: ParticipantInfo;
  receipts: Array<{
    receiptId: string;
    shopName: string;
    category: ReceiptCategory;
    breakdown: PersonReceiptBreakdown;
  }>;
  exactTotal: number;
  roundedTotal: number;
  totalPaidAsPayer: number;
  netBalance: number;
  isPaid: boolean;
}

export interface SettlementTransfer {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
}

export interface SessionCalculation {
  participants: ParticipantInfo[];
  receiptCalculations: ReceiptCalculation[];
  personSummaries: PersonSessionSummary[];
  transfers: SettlementTransfer[];
  grandTotal: number;
  roundedGrandTotal: number;
  myShare: number;
  collectibleFromFriends: number;
  collectedAmount: number;
  remainingAmount: number;
  unassignedItemCount: number;
}
