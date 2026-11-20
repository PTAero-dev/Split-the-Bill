import { describe, expect, it } from 'vitest';
import {
  calculateReceipt,
  calculateSession,
  round2,
} from '../calculator';
import { DailySession, Friend, ME_ID, ParticipantInfo, Receipt } from '../../types';

const friends: Friend[] = [
  { id: 'f1', name: 'เอก', color: 'sky', isDefaultGroup: true },
  { id: 'f2', name: 'บีม', color: 'indigo', isDefaultGroup: true },
  { id: 'f3', name: 'พลอย', color: 'rose', isDefaultGroup: true },
];

function makeParticipantMap(): Map<string, ParticipantInfo> {
  return new Map<string, ParticipantInfo>([
    [ME_ID, { id: ME_ID, name: 'ฉัน', color: 'teal', isMe: true }],
    ['f1', { id: 'f1', name: 'เอก', color: 'sky', isMe: false }],
    ['f2', { id: 'f2', name: 'บีม', color: 'indigo', isMe: false }],
    ['f3', { id: 'f3', name: 'พลอย', color: 'rose', isMe: false }],
  ]);
}

describe('Bill calculation engine', () => {
  it('computes proportional SC 10% + VAT 7% (++) accurately across different meal totals', () => {
    const receipt: Receipt = {
      id: 'r1',
      shopName: 'ร้านอาหารไทย',
      category: 'restaurant',
      payerId: ME_ID,
      attendeeIds: ['f1', 'f2'],
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
          id: 'i1',
          name: 'เมนูของเอก',
          unitPrice: 200,
          quantity: 1,
          discountType: 'none',
          discountValue: 0,
          shares: [{ participantId: 'f1', weight: 1 }],
          exemptSC: false,
          exemptVAT: false,
        },
        {
          id: 'i2',
          name: 'เมนูของบีม',
          unitPrice: 500,
          quantity: 1,
          discountType: 'none',
          discountValue: 0,
          shares: [{ participantId: 'f2', weight: 1 }],
          exemptSC: false,
          exemptVAT: false,
        },
        {
          id: 'i3',
          name: 'น้ำแข็ง/น้ำเปล่า (แชร์ 2 คน)',
          unitPrice: 100,
          quantity: 1,
          discountType: 'none',
          discountValue: 0,
          shares: [
            { participantId: 'f1', weight: 1 },
            { participantId: 'f2', weight: 1 },
          ],
          exemptSC: true,
          exemptVAT: false,
        },
      ],
    };

    const res = calculateReceipt(receipt, makeParticipantMap());

    // f1: food 250 (200 sc+vat, 50 vat-only). SC = 200*0.10 = 20. VAT = (250 + 20)*0.07 = 18.90 -> 288.90
    expect(round2(res.personBreakdowns['f1'].serviceCharge)).toBe(20);
    expect(round2(res.personBreakdowns['f1'].vat)).toBe(18.9);
    expect(round2(res.personBreakdowns['f1'].total)).toBe(288.9);

    // f2: food 550 (500 sc+vat, 50 vat-only). SC = 500*0.10 = 50. VAT = (550 + 50)*0.07 = 42.00 -> 642.00
    expect(round2(res.personBreakdowns['f2'].serviceCharge)).toBe(50);
    expect(round2(res.personBreakdowns['f2'].vat)).toBe(42);
    expect(round2(res.personBreakdowns['f2'].total)).toBe(642);

    expect(res.calculatedTotal).toBe(930.9);
  });

  it('handles Supermarket item-level discounts and bill-level discounts (proportional & equal with cap)', () => {
    const baseSupermarket: Receipt = {
      id: 'r_sup',
      shopName: 'ซูเปอร์มาร์เก็ต',
      category: 'supermarket',
      payerId: ME_ID,
      attendeeIds: [ME_ID, 'f1', 'f2'],
      serviceChargeRate: 0,
      vatRate: 0,
      vatOnServiceCharge: false,
      billDiscountType: 'amount',
      billDiscountValue: 60,
      billDiscountAllocation: 'proportional',
      billDiscountTiming: 'before_tax',
      actualReceiptTotal: null,
      items: [
        {
          id: 's1',
          name: 'ขนมป้ายเหลือง (ลด ฿25 เฉพาะเอก)',
          unitPrice: 125,
          quantity: 1,
          discountType: 'amount',
          discountValue: 25,
          shares: [{ participantId: 'f1', weight: 1 }],
          exemptSC: false,
          exemptVAT: false,
        },
        {
          id: 's2',
          name: 'นมแพ็ค (ลด 10% เฉพาะบีม)',
          unitPrice: 200,
          quantity: 1,
          discountType: 'percent',
          discountValue: 10,
          shares: [{ participantId: 'f2', weight: 1 }],
          exemptSC: false,
          exemptVAT: false,
        },
        {
          id: 's3',
          name: 'น้ำดื่ม (เฉพาะฉัน)',
          unitPrice: 20,
          quantity: 1,
          discountType: 'none',
          discountValue: 0,
          shares: [{ participantId: ME_ID, weight: 1 }],
          exemptSC: false,
          exemptVAT: false,
        },
      ],
    };

    // Net before bill discount: f1=100, f2=180, ME=20 => sum=300
    // Proportional bill discount 60 (20%): f1 -20 -> 80, f2 -36 -> 144, ME -4 -> 16
    const propRes = calculateReceipt(baseSupermarket, makeParticipantMap());
    expect(propRes.itemsGrossTotal).toBe(345);
    expect(propRes.itemDiscountTotal).toBe(45);
    expect(propRes.itemsNetTotal).toBe(300);
    expect(propRes.billDiscountTotal).toBe(60);
    expect(round2(propRes.personBreakdowns['f1'].total)).toBe(80);
    expect(round2(propRes.personBreakdowns['f2'].total)).toBe(144);
    expect(round2(propRes.personBreakdowns[ME_ID].total)).toBe(16);
    expect(propRes.calculatedTotal).toBe(240);

    // Equal bill discount 90 across [100, 180, 20]:
    // Equal target = 30 each, but ME only has 20! ME capped at 20 -> 0 remaining;
    // leftover 10 split equally between f1 & f2 (+5 each -> 35 each)
    const equalReceipt: Receipt = {
      ...baseSupermarket,
      billDiscountValue: 90,
      billDiscountAllocation: 'equal',
    };
    const eqRes = calculateReceipt(equalReceipt, makeParticipantMap());
    expect(round2(eqRes.personBreakdowns[ME_ID].total)).toBe(0);
    expect(round2(eqRes.personBreakdowns['f1'].total)).toBe(65);
    expect(round2(eqRes.personBreakdowns['f2'].total)).toBe(145);
    expect(eqRes.calculatedTotal).toBe(210);
  });

  it('supports before_tax vs after_tax bill discount timing', () => {
    const base: Receipt = {
      id: 'r_tax',
      shopName: 'ร้านทดสอบภาษี',
      category: 'restaurant',
      payerId: ME_ID,
      attendeeIds: ['f1'],
      serviceChargeRate: 10,
      vatRate: 7,
      vatOnServiceCharge: true,
      billDiscountType: 'amount',
      billDiscountValue: 100,
      billDiscountAllocation: 'proportional',
      billDiscountTiming: 'before_tax',
      actualReceiptTotal: null,
      items: [
        {
          id: 't1',
          name: 'อาหาร',
          unitPrice: 1000,
          quantity: 1,
          discountType: 'none',
          discountValue: 0,
          shares: [{ participantId: 'f1', weight: 1 }],
          exemptSC: false,
          exemptVAT: false,
        },
      ],
    };

    const beforeTax = calculateReceipt(base, makeParticipantMap());
    // (1000 - 100) * 1.177 = 1059.30
    expect(beforeTax.calculatedTotal).toBe(1059.3);

    const afterTax = calculateReceipt(
      { ...base, billDiscountTiming: 'after_tax' },
      makeParticipantMap(),
    );
    // 1000 * 1.177 - 100 = 1077.00
    expect(afterTax.calculatedTotal).toBe(1077);
  });

  it('aggregates multi-stop daily sessions and minimizes transfers when multiple payers exist', () => {
    const session: DailySession = {
      id: 'ses1',
      date: '2026-11-20',
      title: 'กินข้าว + คาเฟ่ + ซูเปอร์',
      includeMe: true,
      participantIds: ['f1', 'f2', 'f3'],
      roundingMode: 'exact',
      paidStatus: { f1: true },
      createdAt: '2026-11-20T12:00:00Z',
      updatedAt: '2026-11-20T12:00:00Z',
      receipts: [
        {
          id: 'r1',
          shopName: 'ร้านข้าว',
          category: 'restaurant',
          payerId: ME_ID,
          attendeeIds: [ME_ID, 'f1', 'f2', 'f3'],
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
              id: 'a1',
              name: 'ข้าวรวม',
              unitPrice: 400,
              quantity: 1,
              discountType: 'none',
              discountValue: 0,
              shares: [
                { participantId: ME_ID, weight: 1 },
                { participantId: 'f1', weight: 1 },
                { participantId: 'f2', weight: 1 },
                { participantId: 'f3', weight: 1 },
              ],
              exemptSC: false,
              exemptVAT: false,
            },
          ],
        },
        {
          id: 'r2',
          shopName: 'ซูเปอร์มาร์เก็ต',
          category: 'supermarket',
          payerId: 'f1', // เอกจ่ายร้านนี้ 200
          attendeeIds: [ME_ID, 'f1'],
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
              id: 'a2',
              name: 'ของกินเล่น',
              unitPrice: 200,
              quantity: 1,
              discountType: 'none',
              discountValue: 0,
              shares: [
                { participantId: ME_ID, weight: 1 },
                { participantId: 'f1', weight: 1 },
              ],
              exemptSC: false,
              exemptVAT: false,
            },
          ],
        },
      ],
    };

    const result = calculateSession(session, friends, 'ฉัน');
    expect(result.grandTotal).toBe(600);

    // ME share = 100 + 100 = 200, paid 400 => +200
    // f1 share = 100 + 100 = 200, paid 200 => 0
    // f2 share = 100, paid 0 => -100
    // f3 share = 100, paid 0 => -100
    expect(result.transfers).toHaveLength(2);
    expect(result.transfers.every((t) => t.toId === ME_ID && t.amount === 100)).toBe(true);
    expect(result.collectibleFromFriends).toBe(400);
    expect(result.collectedAmount).toBe(200); // f1 marked paid
    expect(result.remainingAmount).toBe(200);
    expect(result.participants.find((p) => p.id === ME_ID)?.color).toBe('teal');

    const customColorResult = calculateSession(session, friends, 'ฉัน', null, 'indigo');
    expect(customColorResult.participants.find((p) => p.id === ME_ID)?.color).toBe('indigo');
  });

  it('computes conveyor belt sushi colored plates (30/40/60/80/120) + shared items + bill discount + ++ tax', () => {
    const sushiReceipt: Receipt = {
      id: 'r_sushi',
      shopName: 'ซูชิสายพาน',
      category: 'sushi',
      payerId: ME_ID,
      attendeeIds: [ME_ID, 'f1', 'f2'],
      serviceChargeRate: 10,
      vatRate: 7,
      vatOnServiceCharge: true,
      billDiscountType: 'percent',
      billDiscountValue: 10,
      billDiscountAllocation: 'proportional',
      billDiscountTiming: 'before_tax',
      actualReceiptTotal: null,
      plateTiers: [
        { id: 'p30', label: 'จานเขียว', colorHex: '#22c55e', price: 30 },
        { id: 'p40', label: 'จานแดง', colorHex: '#ef4444', price: 40 },
        { id: 'p60', label: 'จานเงิน', colorHex: '#cbd5e1', price: 60 },
        { id: 'p80', label: 'จานทอง', colorHex: '#eab308', price: 80 },
        { id: 'p120', label: 'จานดำ', colorHex: '#334155', price: 120 },
      ],
      plateCounts: {
        f1: { p30: 2, p40: 3, p120: 1 }, // 60 + 120 + 120 = 300
        f2: { p60: 1, p80: 3 }, // 60 + 240 = 300
        [ME_ID]: { p30: 3, p40: 4 }, // 90 + 160 = 250
      },
      items: [
        {
          id: 'drink',
          name: 'ชาเขียวรีฟิล + น้ำซุป',
          unitPrice: 150,
          quantity: 1,
          discountType: 'none',
          discountValue: 0,
          shares: [
            { participantId: ME_ID, weight: 1 },
            { participantId: 'f1', weight: 1 },
            { participantId: 'f2', weight: 1 },
          ],
          exemptSC: false,
          exemptVAT: false,
        },
      ],
    };

    const res = calculateReceipt(sushiReceipt, makeParticipantMap());
    expect(res.itemsNetTotal).toBe(1000);
    expect(res.billDiscountTotal).toBe(100);
    expect(res.calculatedTotal).toBe(1059.3);

    // f1: (300 + 50) * 0.9 * 1.177 = 370.755
    expect(round2(res.personBreakdowns['f1'].total)).toBe(370.76);
    expect(res.personBreakdowns['f1'].items.length).toBe(4); // drink + 3 plate tiers
    // ME: (250 + 50) * 0.9 * 1.177 = 317.79
    expect(round2(res.personBreakdowns[ME_ID].total)).toBe(317.79);
  });
});
