import QRCode from 'qrcode';

export interface NormalizedPromptPayTarget {
  subTag: '01' | '02' | '03';
  value: string;
  type: 'mobile' | 'national_id' | 'ewallet';
  digitsOnly: string;
}

export function crc16CcittFalse(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j += 1) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function tlv(tag: string, value: string): string {
  const length = value.length.toString().padStart(2, '0');
  return `${tag}${length}${value}`;
}

export function normalizePromptPayTarget(raw: string): NormalizedPromptPayTarget | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  // Thai mobile: 0XXXXXXXXX (10 digits starting with 0)
  if (digits.length === 10 && digits.startsWith('0')) {
    return {
      subTag: '01',
      value: `0066${digits.slice(1)}`,
      type: 'mobile',
      digitsOnly: digits,
    };
  }

  // International format 66XXXXXXXXX (11 digits starting with 66)
  if (digits.length === 11 && digits.startsWith('66')) {
    return {
      subTag: '01',
      value: `00${digits}`,
      type: 'mobile',
      digitsOnly: `0${digits.slice(2)}`,
    };
  }

  // Already normalized 0066XXXXXXXXX (13 digits starting with 0066)
  if (digits.length === 13 && digits.startsWith('0066')) {
    return {
      subTag: '01',
      value: digits,
      type: 'mobile',
      digitsOnly: `0${digits.slice(4)}`,
    };
  }

  // 13-digit Thai National ID or Tax ID
  if (digits.length === 13) {
    return {
      subTag: '02',
      value: digits,
      type: 'national_id',
      digitsOnly: digits,
    };
  }

  // 15-digit e-Wallet ID
  if (digits.length === 15) {
    return {
      subTag: '03',
      value: digits,
      type: 'ewallet',
      digitsOnly: digits,
    };
  }

  return null;
}

export function validatePromptPayId(raw: string): {
  valid: boolean;
  label: string;
  error?: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: false, label: '', error: 'กรุณากรอกเบอร์พร้อมเพย์หรือเลขบัตรประชาชน' };
  }

  const target = normalizePromptPayTarget(trimmed);
  if (!target) {
    return {
      valid: false,
      label: '',
      error: 'กรุณากรอกเบอร์มือถือ 10 หลัก, เลขบัตรประชาชน 13 หลัก หรือ e-Wallet 15 หลัก',
    };
  }

  const labelMap: Record<NormalizedPromptPayTarget['type'], string> = {
    mobile: 'เบอร์มือถือพร้อมเพย์',
    national_id: 'เลขบัตรประชาชน / นิติบุคคล 13 หลัก',
    ewallet: 'หมายเลข e-Wallet 15 หลัก',
  };

  return {
    valid: true,
    label: labelMap[target.type],
  };
}

export function formatPromptPayDisplay(raw: string): string {
  const target = normalizePromptPayTarget(raw);
  if (!target) return raw.trim();

  const d = target.digitsOnly;
  if (target.type === 'mobile' && d.length === 10) {
    return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  }
  if (target.type === 'national_id' && d.length === 13) {
    return `${d.slice(0, 1)}-${d.slice(1, 5)}-${d.slice(5, 10)}-${d.slice(10, 12)}-${d.slice(12)}`;
  }
  if (target.type === 'ewallet' && d.length === 15) {
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 11)}-${d.slice(11)}`;
  }
  return d;
}

export function generatePromptPayPayload(promptPayId: string, amount?: number): string {
  const target = normalizePromptPayTarget(promptPayId);
  if (!target) {
    throw new Error('Invalid PromptPay ID');
  }

  const hasAmount = typeof amount === 'number' && Number.isFinite(amount) && amount > 0;
  const merchantInfo = tlv('00', 'A000000677010111') + tlv(target.subTag, target.value);

  const chunks: string[] = [
    tlv('00', '01'),
    tlv('01', hasAmount ? '12' : '11'),
    tlv('29', merchantInfo),
    tlv('58', 'TH'),
    tlv('53', '764'),
  ];

  if (hasAmount) {
    chunks.push(tlv('54', amount.toFixed(2)));
  }

  const payloadWithoutCrc = `${chunks.join('')}6304`;
  const crc = crc16CcittFalse(payloadWithoutCrc);
  return `${payloadWithoutCrc}${crc}`;
}

export async function generateQrDataUrl(payload: string, width = 320): Promise<string> {
  return QRCode.toDataURL(payload, {
    width,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
}
