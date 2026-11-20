import { describe, expect, it } from 'vitest';
import {
  crc16CcittFalse,
  formatPromptPayDisplay,
  generatePromptPayPayload,
  normalizePromptPayTarget,
  validatePromptPayId,
} from '../promptpay';

describe('PromptPay EMVCo QR generation', () => {
  it('computes standard CRC16-CCITT-FALSE check value', () => {
    expect(crc16CcittFalse('123456789')).toBe('29B1');
  });

  it('normalizes 10-digit mobile, 13-digit national ID, and 15-digit e-wallet', () => {
    const mobile = normalizePromptPayTarget('081-234-5678');
    expect(mobile).toEqual({
      subTag: '01',
      value: '0066812345678',
      type: 'mobile',
      digitsOnly: '0812345678',
    });

    const national = normalizePromptPayTarget('1-2345-67890-12-3');
    expect(national).toEqual({
      subTag: '02',
      value: '1234567890123',
      type: 'national_id',
      digitsOnly: '1234567890123',
    });

    const ewallet = normalizePromptPayTarget('123456789012345');
    expect(ewallet).toEqual({
      subTag: '03',
      value: '123456789012345',
      type: 'ewallet',
      digitsOnly: '123456789012345',
    });
  });

  it('generates valid static and amount-locked dynamic PromptPay payloads', () => {
    const staticPayload = generatePromptPayPayload('0812345678');
    expect(staticPayload.startsWith('000201010211')).toBe(true);
    expect(staticPayload).toContain('0016A00000067701011101130066812345678');
    expect(staticPayload).toContain('5802TH5303764');
    expect(staticPayload).not.toContain('540');

    // Verify trailing CRC
    const withoutCrc = staticPayload.slice(0, -4);
    const actualCrc = staticPayload.slice(-4);
    expect(crc16CcittFalse(withoutCrc)).toBe(actualCrc);

    const dynamicPayload = generatePromptPayPayload('081-234-5678', 350.5);
    expect(dynamicPayload.startsWith('000201010212')).toBe(true);
    expect(dynamicPayload).toContain('5406350.50');
    const dynWithoutCrc = dynamicPayload.slice(0, -4);
    expect(crc16CcittFalse(dynWithoutCrc)).toBe(dynamicPayload.slice(-4));
  });

  it('validates and formats PromptPay IDs cleanly', () => {
    expect(validatePromptPayId('0891234567').valid).toBe(true);
    expect(validatePromptPayId('12345').valid).toBe(false);
    expect(validatePromptPayId('').valid).toBe(false);
    expect(formatPromptPayDisplay('0891234567')).toBe('089-123-4567');
  });
});
