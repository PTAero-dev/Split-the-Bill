import { describe, expect, it } from 'vitest';
import { calculateSession } from '../calculator';
import { createDemoData } from '../storage';
import {
  generateGroupSummaryText,
  generateIndividualSummaryText,
} from '../summaryExport';
import { PaymentProfile } from '../../types';

const sampleProfile: PaymentProfile = {
  promptPayId: '0812345678',
  accountName: 'สมชาย ใจดี',
  bankName: 'กสิกรไทย',
  accountNumber: '123-4-56789-0',
  customQrImageDataUrl: null,
  preferredQrMode: 'promptpay_dynamic',
};

describe('Summary text export', () => {
  it('formats group summary text with multi-shop totals, discounts, SC/VAT, transfers, and payment info', () => {
    const { friends, session } = createDemoData();
    const calc = calculateSession(session, friends, 'ฉัน');
    const text = generateGroupSummaryText(session, calc, sampleProfile, true);

    expect(text).toContain(session.title);
    expect(text).toContain('รวม 3 ร้าน');
    expect(text).toContain('ร้านอาหารไทย (มื้อเที่ยง)');
    expect(text).toContain('คาเฟ่ของหวาน (พลอยไม่ได้ไป)');
    expect(text).toContain('ซูเปอร์มาร์เก็ต (มีส่วนลด)');
    expect(text).toContain('ส่วนลดรายการ');
    expect(text).toContain('ส่วนลดท้ายบิล');
    expect(text).toContain('SC +');
    expect(text).toContain('VAT +');
    expect(text).toContain('สรุปการโอน');
    expect(text).toContain('พร้อมเพย์: 081-234-5678');
    expect(text).toContain('กสิกรไทย 123-4-56789-0');
    expect(text).toContain('ชื่อบัญชี: สมชาย ใจดี');
  });

  it('formats individual summary text accurately for a friend who skipped shop 2', () => {
    const { friends, session } = createDemoData();
    const calc = calculateSession(session, friends, 'ฉัน');
    const ploy = calc.personSummaries.find((p) => p.participant.name === 'พลอย');
    expect(ploy).toBeDefined();

    const text = generateIndividualSummaryText(ploy!, session, sampleProfile);
    expect(text).toContain('แจ้งยอดค่าใช้จ่ายของ: พลอย');
    expect(text).toContain('ร้านอาหารไทย (มื้อเที่ยง)');
    expect(text).not.toContain('คาเฟ่ของหวาน');
    expect(text).toContain('Service Charge:');
    expect(text).toContain('VAT:');
    expect(text).toContain('ยอดสุทธิที่ต้องโอน:');
    expect(text).toContain('พร้อมเพย์: 081-234-5678');
  });
});
