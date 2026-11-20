import { describe, expect, it } from 'vitest';
import { sortShopTemplates } from '../format';
import { createReceiptFromTemplate, normalizeAppState } from '../storage';
import { ME_ID, ShopTemplate } from '../../types';

describe('Shop templates & storage normalization', () => {
  const sushiShopA: ShopTemplate = {
    id: 'tpl_a',
    name: 'Sushiro',
    category: 'sushi',
    serviceChargeRate: 10,
    vatRate: 7,
    vatOnServiceCharge: true,
    isPinned: false,
    lastUsedAt: '2026-11-20T12:00:00Z',
    plateTiers: [
      { id: 'a1', label: 'จานแดง', colorHex: '#ef4444', price: 40 },
      { id: 'a2', label: 'จานเงิน', colorHex: '#cbd5e1', price: 60 },
      { id: 'a3', label: 'จานทอง', colorHex: '#d97706', price: 80 },
      { id: 'a4', label: 'จานดำ', colorHex: '#1e293b', price: 120 },
    ],
  };

  const sushiShopB: ShopTemplate = {
    id: 'tpl_b',
    name: 'ร้านซูชิ B (จานส้ม/ฟ้า/ม่วง)',
    category: 'sushi',
    serviceChargeRate: 0,
    vatRate: 7,
    vatOnServiceCharge: false,
    isPinned: true,
    lastUsedAt: '2026-11-18T12:00:00Z',
    plateTiers: [
      { id: 'b1', label: 'จานส้ม', colorHex: '#f97316', price: 35 },
      { id: 'b2', label: 'จานฟ้า', colorHex: '#38bdf8', price: 55 },
      { id: 'b3', label: 'จานม่วง', colorHex: '#a855f7', price: 95 },
    ],
  };

  it('creates independent deep-cloned receipts from distinct sushi shop templates', () => {
    const rA = createReceiptFromTemplate(sushiShopA, [ME_ID, 'f1'], ME_ID);
    const rB = createReceiptFromTemplate(sushiShopB, [ME_ID, 'f1'], ME_ID);

    expect(rA.shopName).toBe('Sushiro');
    expect(rA.serviceChargeRate).toBe(10);
    expect(rA.vatRate).toBe(7);
    expect(rA.vatOnServiceCharge).toBe(true);
    expect(rA.plateTiers).toHaveLength(4);
    expect(rA.plateCounts).toEqual({});

    expect(rB.shopName).toBe('ร้านซูชิ B (จานส้ม/ฟ้า/ม่วง)');
    expect(rB.serviceChargeRate).toBe(0);
    expect(rB.vatRate).toBe(7);
    expect(rB.vatOnServiceCharge).toBe(false);
    expect(rB.plateTiers).toHaveLength(3);
    expect(rB.plateTiers?.[0]).toEqual({
      id: 'b1',
      label: 'จานส้ม',
      colorHex: '#f97316',
      price: 35,
    });

    // Mutating receipt plateTiers does not mutate template
    rA.plateTiers![0].price = 999;
    expect(sushiShopA.plateTiers![0].price).toBe(40);
  });

  it('sorts pinned templates first, then by lastUsedAt descending', () => {
    const newerUnpinned: ShopTemplate = {
      ...sushiShopA,
      id: 'tpl_new',
      name: 'Newer',
      isPinned: false,
      lastUsedAt: '2026-11-20T18:00:00Z',
    };
    const olderUnpinned: ShopTemplate = {
      ...sushiShopA,
      id: 'tpl_old',
      name: 'Older',
      isPinned: false,
      lastUsedAt: '2026-11-19T09:00:00Z',
    };

    const sorted = sortShopTemplates([olderUnpinned, newerUnpinned, sushiShopB]);
    expect(sorted.map((t) => t.id)).toEqual(['tpl_b', 'tpl_new', 'tpl_old']);
  });

  it('normalizes legacy AppState without shopTemplates and preserves valid templates', () => {
    const legacy = normalizeAppState({ myName: 'ตั้ม', friends: [], sessions: [] });
    expect(legacy.shopTemplates).toEqual([]);

    const withTemplates = normalizeAppState({
      shopTemplates: [sushiShopA, sushiShopB],
    });
    expect(withTemplates.shopTemplates).toHaveLength(2);
    expect(withTemplates.shopTemplates?.[1].name).toBe('ร้านซูชิ B (จานส้ม/ฟ้า/ม่วง)');
  });
});
