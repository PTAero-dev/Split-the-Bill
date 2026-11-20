import {
  DailySession,
  PaymentProfile,
  PersonSessionSummary,
  PreferredQrMode,
  SessionCalculation,
} from '../types';
import { formatBaht, formatThaiDate, getFriendColor } from './format';
import {
  formatPromptPayDisplay,
  generatePromptPayPayload,
  generateQrDataUrl,
  normalizePromptPayTarget,
} from './promptpay';

export interface ResolvedQrResult {
  dataUrl: string | null;
  caption: string;
  isAmountLocked: boolean;
}

export async function resolveQrForSummary(
  paymentProfile: PaymentProfile,
  amount?: number,
  overrideMode?: PreferredQrMode,
): Promise<ResolvedQrResult> {
  const mode = overrideMode ?? paymentProfile.preferredQrMode;
  const validPromptPay = Boolean(normalizePromptPayTarget(paymentProfile.promptPayId));
  const hasCustomQr = Boolean(paymentProfile.customQrImageDataUrl);
  const lockAmount = typeof amount === 'number' && Number.isFinite(amount) && amount > 0;

  if (mode === 'promptpay_dynamic' && validPromptPay) {
    const payload = generatePromptPayPayload(
      paymentProfile.promptPayId,
      lockAmount ? amount : undefined,
    );
    const dataUrl = await generateQrDataUrl(payload, 360);
    return {
      dataUrl,
      caption: lockAmount
        ? `พร้อมเพย์ (ล็อกยอด ${formatBaht(amount!)})`
        : `พร้อมเพย์ ${formatPromptPayDisplay(paymentProfile.promptPayId)}`,
      isAmountLocked: lockAmount,
    };
  }

  if (mode === 'custom_image' && hasCustomQr) {
    return {
      dataUrl: paymentProfile.customQrImageDataUrl,
      caption: 'QR บัญชีรับเงินที่บันทึกไว้',
      isAmountLocked: false,
    };
  }

  if (validPromptPay) {
    const payload = generatePromptPayPayload(
      paymentProfile.promptPayId,
      lockAmount ? amount : undefined,
    );
    const dataUrl = await generateQrDataUrl(payload, 360);
    return {
      dataUrl,
      caption: lockAmount
        ? `พร้อมเพย์ (ล็อกยอด ${formatBaht(amount!)})`
        : `พร้อมเพย์ ${formatPromptPayDisplay(paymentProfile.promptPayId)}`,
      isAmountLocked: lockAmount,
    };
  }

  if (hasCustomQr) {
    return {
      dataUrl: paymentProfile.customQrImageDataUrl,
      caption: 'QR บัญชีรับเงินที่บันทึกไว้',
      isAmountLocked: false,
    };
  }

  return {
    dataUrl: null,
    caption: '',
    isAmountLocked: false,
  };
}

export function generateGroupSummaryText(
  session: DailySession,
  calc: SessionCalculation,
  paymentProfile: PaymentProfile,
  includeItemDetails: boolean,
): string {
  const lines: string[] = [];
  lines.push(`🧾 สรุปค่าใช้จ่าย: ${session.title}`);
  lines.push(`📅 วันที่ ${formatThaiDate(session.date)}`);
  lines.push(`🏪 รวม ${calc.receiptCalculations.length} ร้าน • ยอดรวมทั้งหมด ${formatBaht(calc.grandTotal)}`);
  lines.push('');
  lines.push('👥 ยอดสุทธิแต่ละคน');

  for (const person of calc.personSummaries) {
    const paidMark = person.participant.isMe
      ? ' (ผู้รวบรวม)'
      : person.isPaid
        ? ' ✅ โอนแล้ว'
        : '';
    lines.push(`• ${person.participant.name}: ${formatBaht(person.roundedTotal)}${paidMark}`);

    if (person.receipts.length > 1) {
      const shopParts = person.receipts
        .filter((r) => r.breakdown.total > 0.001)
        .map((r) => `${r.shopName} ${formatBaht(r.breakdown.total)}`);
      if (shopParts.length > 0) {
        lines.push(`   ↳ ${shopParts.join(' + ')}`);
      }
    }
  }

  if (calc.transfers.length > 0) {
    lines.push('');
    lines.push('💸 สรุปการโอน');
    for (const t of calc.transfers) {
      lines.push(`• ${t.fromName} ➜ ${t.toName}: ${formatBaht(t.amount)}`);
    }
  }

  if (includeItemDetails && calc.receiptCalculations.length > 0) {
    lines.push('');
    lines.push('📋 รายละเอียดแต่ละร้าน');
    for (const rc of calc.receiptCalculations) {
      lines.push(`▸ ${rc.shopName} (รวม ${formatBaht(rc.calculatedTotal)})`);
      const extras: string[] = [];
      if (rc.itemDiscountTotal > 0) extras.push(`ส่วนลดรายการ -${formatBaht(rc.itemDiscountTotal)}`);
      if (rc.billDiscountTotal > 0) extras.push(`ส่วนลดท้ายบิล -${formatBaht(rc.billDiscountTotal)}`);
      if (rc.serviceChargeTotal > 0) extras.push(`SC +${formatBaht(rc.serviceChargeTotal)}`);
      if (rc.vatTotal > 0) extras.push(`VAT +${formatBaht(rc.vatTotal)}`);
      if (extras.length > 0) {
        lines.push(`  [${extras.join(' | ')}]`);
      }

      for (const person of calc.personSummaries) {
        const b = rc.personBreakdowns[person.participant.id];
        if (!b || b.items.length === 0) continue;
        const itemStr = b.items
          .map((it) => {
            const shareTag = it.sharedCount > 1 ? ` (หาร ${it.sharedCount})` : '';
            const discTag =
              it.shareItemDiscount > 0.005 ? ` [ลด -${formatBaht(it.shareItemDiscount)}]` : '';
            return `${it.name}${shareTag}${discTag} ${formatBaht(it.shareNet)}`;
          })
          .join(', ');
        lines.push(`  - ${person.participant.name}: ${itemStr} => รวม ${formatBaht(b.total)}`);
      }
    }
  }

  const paymentLines: string[] = [];
  if (normalizePromptPayTarget(paymentProfile.promptPayId)) {
    paymentLines.push(`พร้อมเพย์: ${formatPromptPayDisplay(paymentProfile.promptPayId)}`);
  }
  if (paymentProfile.bankName || paymentProfile.accountNumber) {
    paymentLines.push(
      `บัญชี: ${[paymentProfile.bankName, paymentProfile.accountNumber].filter(Boolean).join(' ')}`,
    );
  }
  if (paymentProfile.accountName) {
    paymentLines.push(`ชื่อบัญชี: ${paymentProfile.accountName}`);
  }

  if (paymentLines.length > 0) {
    lines.push('');
    lines.push('💳 ช่องทางโอนเงิน');
    lines.push(...paymentLines);
  }

  return lines.join('\n');
}

export function generateIndividualSummaryText(
  person: PersonSessionSummary,
  session: DailySession,
  paymentProfile: PaymentProfile,
): string {
  const lines: string[] = [];
  lines.push(`🧾 แจ้งยอดค่าใช้จ่ายของ: ${person.participant.name}`);
  lines.push(`📌 ${session.title} (${formatThaiDate(session.date)})`);
  lines.push('');

  for (const r of person.receipts) {
    const b = r.breakdown;
    if (b.total <= 0.001 && b.items.length === 0) continue;
    lines.push(`🏪 ${r.shopName}: ${formatBaht(b.total)}`);
    for (const item of b.items) {
      const shareTag = item.sharedCount > 1 ? ` (หาร ${item.sharedCount})` : '';
      const discTag =
        item.shareItemDiscount > 0.005 ? ` [ลด -${formatBaht(item.shareItemDiscount)}]` : '';
      lines.push(`   • ${item.name}${shareTag}${discTag}: ${formatBaht(item.shareNet)}`);
    }
    if (b.billDiscountShare > 0.005) {
      lines.push(`   • หักส่วนลดท้ายบิล: -${formatBaht(b.billDiscountShare)}`);
    }
    if (b.serviceCharge > 0.005) {
      lines.push(`   • Service Charge: +${formatBaht(b.serviceCharge)}`);
    }
    if (b.vat > 0.005) {
      lines.push(`   • VAT: +${formatBaht(b.vat)}`);
    }
  }

  lines.push('');
  lines.push(`💰 ยอดสุทธิที่ต้องโอน: ${formatBaht(person.roundedTotal)}`);

  if (normalizePromptPayTarget(paymentProfile.promptPayId)) {
    lines.push(`📱 พร้อมเพย์: ${formatPromptPayDisplay(paymentProfile.promptPayId)}`);
  }
  if (paymentProfile.bankName || paymentProfile.accountNumber) {
    lines.push(
      `🏦 ${[paymentProfile.bankName, paymentProfile.accountNumber].filter(Boolean).join(' ')}`,
    );
  }
  if (paymentProfile.accountName) {
    lines.push(`👤 ชื่อบัญชี: ${paymentProfile.accountName}`);
  }

  return lines.join('\n');
}

const CANVAS_FONT_STACK = '"IBM Plex Sans Thai", "Plus Jakarta Sans", "Noto Sans Thai", system-ui, -apple-system, sans-serif';

function segmentThaiWords(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter('th', { granularity: 'word' });
    return Array.from(segmenter.segment(text), (s) => s.segment);
  }
  return text.split(/(\s+)/);
}

export function wrapThaiText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  if (!text) return [''];
  const paragraphs = text.split('\n');
  const allLines: string[] = [];

  for (const para of paragraphs) {
    if (!para) {
      allLines.push('');
      continue;
    }
    const tokens = segmentThaiWords(para);
    let currentLine = '';

    for (const token of tokens) {
      const candidate = currentLine + token;
      if (ctx.measureText(candidate).width <= maxWidth) {
        currentLine = candidate;
      } else {
        if (currentLine.trim().length > 0) {
          allLines.push(currentLine.trimEnd());
          currentLine = token.trimStart();
        } else {
          currentLine = token;
        }

        // Handle ultra-long unbroken word
        while (ctx.measureText(currentLine).width > maxWidth && currentLine.length > 1) {
          let splitAt = currentLine.length - 1;
          while (
            splitAt > 1 &&
            ctx.measureText(currentLine.slice(0, splitAt)).width > maxWidth
          ) {
            splitAt -= 1;
          }
          allLines.push(currentLine.slice(0, splitAt));
          currentLine = currentLine.slice(splitAt);
        }
      }
    }
    if (currentLine.length > 0) {
      allLines.push(currentLine.trimEnd());
    }
  }

  return allLines.length > 0 ? allLines : [''];
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load QR image'));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to generate PNG image'));
    }, 'image/png');
  });
}

export interface GroupPngOptions {
  includeItemDetails: boolean;
  qrMode?: PreferredQrMode;
}

export async function renderGroupSummaryPng(
  session: DailySession,
  calc: SessionCalculation,
  paymentProfile: PaymentProfile,
  options: GroupPngOptions,
): Promise<{ blob: Blob; dataUrl: string }> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await document.fonts.ready;
  }

  const qrResolved = await resolveQrForSummary(paymentProfile, undefined, options.qrMode);
  const qrImg = qrResolved.dataUrl ? await loadImage(qrResolved.dataUrl).catch(() => null) : null;

  const avatarImageMap = new Map<string, HTMLImageElement>();
  await Promise.all(
    calc.personSummaries.map(async (p) => {
      if (p.participant.avatarDataUrl) {
        const img = await loadImage(p.participant.avatarDataUrl).catch(() => null);
        if (img) avatarImageMap.set(p.participant.id, img);
      }
    }),
  );

  const width = 800;
  const padX = 32;
  const innerW = width - padX * 2;
  const dpr = 2;

  const measureCanvas = document.createElement('canvas');
  const mCtx = measureCanvas.getContext('2d');
  if (!mCtx) throw new Error('Canvas 2D not supported');

  // Pre-wrap helper
  const measureWrapped = (
    text: string,
    font: string,
    maxW: number,
  ): string[] => {
    mCtx.font = font;
    return wrapThaiText(mCtx, text, maxW);
  };

  // Layout pass to calculate exact dynamic height
  let y = 0;

  // Header Banner
  const titleLines = measureWrapped(
    session.title || 'สรุปค่าใช้จ่ายวันนี้',
    `700 26px ${CANVAS_FONT_STACK}`,
    innerW - 220,
  );
  const headerH = Math.max(132, 74 + titleLines.length * 34);
  y += headerH + 24;

  // Section 1: Per-person summary cards
  y += 34; // section label
  const personRows = calc.personSummaries.map((p) => {
    const shopParts = p.receipts
      .filter((r) => r.breakdown.total > 0.001)
      .map((r) => `${r.shopName} ${formatBaht(r.breakdown.total)}`);
    const subText =
      shopParts.length > 0
        ? shopParts.join('  •  ')
        : 'ไม่มีรายการที่สั่งในบิลนี้';
    const subLines = measureWrapped(subText, `400 15px ${CANVAS_FONT_STACK}`, innerW - 230);
    const cardH = Math.max(82, 56 + subLines.length * 22 + 14);
    return { person: p, subLines, cardH };
  });

  for (const row of personRows) {
    y += row.cardH + 12;
  }

  // Optional multi-payer transfers section
  if (calc.transfers.length > 0) {
    y += 12 + 34;
    y += calc.transfers.length * 38 + 28;
  }

  // Optional Section 2: Shop-by-shop itemized details
  interface ShopLayout {
    shopNameLines: string[];
    totalText: string;
    metaLines: string[];
    peopleBlocks: Array<{
      name: string;
      totalStr: string;
      itemLines: string[][];
      billDiscountShare: number;
      serviceCharge: number;
      vat: number;
      height: number;
    }>;
    cardH: number;
  }

  const shopLayouts: ShopLayout[] = [];
  if (options.includeItemDetails && calc.receiptCalculations.length > 0) {
    y += 14 + 34;
    for (const rc of calc.receiptCalculations) {
      const shopNameLines = measureWrapped(
        rc.shopName,
        `700 18px ${CANVAS_FONT_STACK}`,
        innerW - 160,
      );
      const metaParts: string[] = [];
      if (rc.itemDiscountTotal > 0) metaParts.push(`ลดรายชิ้น -${formatBaht(rc.itemDiscountTotal)}`);
      if (rc.billDiscountTotal > 0) metaParts.push(`ลดท้ายบิล -${formatBaht(rc.billDiscountTotal)}`);
      if (rc.serviceChargeTotal > 0) metaParts.push(`SC +${formatBaht(rc.serviceChargeTotal)}`);
      if (rc.vatTotal > 0) metaParts.push(`VAT +${formatBaht(rc.vatTotal)}`);
      const metaLines =
        metaParts.length > 0
          ? measureWrapped(metaParts.join('  •  '), `500 14px ${CANVAS_FONT_STACK}`, innerW - 40)
          : [];

      const peopleBlocks: ShopLayout['peopleBlocks'] = [];
      for (const p of calc.personSummaries) {
        const b = rc.personBreakdowns[p.participant.id];
        if (!b || (b.items.length === 0 && b.total <= 0.001)) continue;

        const itemLines: string[][] = [];
        let blockH = 36;
        for (const it of b.items) {
          const shareTag = it.sharedCount > 1 ? ` (หาร ${it.sharedCount})` : '';
          const discTag =
            it.shareItemDiscount > 0.005 ? ` [ลด -${formatBaht(it.shareItemDiscount)}]` : '';
          const lineStr = `• ${it.name}${shareTag}${discTag} — ${formatBaht(it.shareNet)}`;
          const wrapped = measureWrapped(lineStr, `400 15px ${CANVAS_FONT_STACK}`, innerW - 68);
          itemLines.push(wrapped);
          blockH += wrapped.length * 22 + 2;
        }
        if (b.billDiscountShare > 0.005) blockH += 22;
        if (b.serviceCharge > 0.005) blockH += 22;
        if (b.vat > 0.005) blockH += 22;

        peopleBlocks.push({
          name: p.participant.name,
          totalStr: formatBaht(b.total),
          itemLines,
          billDiscountShare: b.billDiscountShare,
          serviceCharge: b.serviceCharge,
          vat: b.vat,
          height: blockH,
        });
      }

      const cardH =
        54 +
        shopNameLines.length * 24 +
        (metaLines.length > 0 ? metaLines.length * 20 + 4 : 0) +
        peopleBlocks.reduce((s, pb) => s + pb.height, 0) +
        24;

      shopLayouts.push({
        shopNameLines,
        totalText: formatBaht(rc.calculatedTotal),
        metaLines,
        peopleBlocks,
        cardH,
      });
      y += cardH + 14;
    }
  }

  // Payment Footer
  const hasBankInfo = Boolean(
    paymentProfile.promptPayId ||
      paymentProfile.accountName ||
      paymentProfile.bankName ||
      paymentProfile.accountNumber ||
      qrImg,
  );
  const footerCardH = hasBankInfo ? (qrImg ? 230 : 130) : 64;
  y += 14 + footerCardH + 28;

  const totalHeight = y;
  const canvas = document.createElement('canvas');
  canvas.width = width * dpr;
  canvas.height = totalHeight * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D not supported');

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Background
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, width, totalHeight);

  // Header Banner (Dark Obsidian banner + electric teal accent)
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, headerH);
  ctx.fillStyle = '#14b8a6';
  ctx.fillRect(0, headerH - 4, width, 4);

  ctx.fillStyle = '#5eead4';
  ctx.font = `600 15px ${CANVAS_FONT_STACK}`;
  ctx.fillText(
    `สรุปยอดค่าใช้จ่าย  •  ${formatThaiDate(session.date)}  •  ${calc.receiptCalculations.length} ร้าน`,
    padX,
    36,
  );

  ctx.fillStyle = '#ffffff';
  ctx.font = `700 26px ${CANVAS_FONT_STACK}`;
  titleLines.forEach((line, idx) => {
    ctx.fillText(line, padX, 74 + idx * 34);
  });

  // Grand total pill on right of header
  const totalBoxW = 196;
  const totalBoxX = width - padX - totalBoxW;
  drawRoundedRect(ctx, totalBoxX, 28, totalBoxW, 76, 14);
  ctx.fillStyle = 'rgba(20, 184, 166, 0.18)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(45, 212, 191, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#5eead4';
  ctx.font = `500 14px ${CANVAS_FONT_STACK}`;
  ctx.textAlign = 'right';
  ctx.fillText('ยอดรวมทั้งหมด', width - padX - 16, 54);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 26px ${CANVAS_FONT_STACK}`;
  ctx.fillText(formatBaht(calc.grandTotal), width - padX - 16, 88);
  ctx.textAlign = 'left';

  let curY = headerH + 24;

  // Section 1 Title
  ctx.fillStyle = '#0f172a';
  ctx.font = `700 18px ${CANVAS_FONT_STACK}`;
  ctx.fillText('ยอดสรุปรายคน', padX, curY + 20);
  curY += 34;

  for (const row of personRows) {
    const p = row.person;
    drawRoundedRect(ctx, padX, curY, innerW, row.cardH, 14);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Avatar circle (photo or colored initial)
    const color = getFriendColor(p.participant.color);
    const avatarX = padX + 28;
    const avatarY = curY + 34;
    const avatarImg = avatarImageMap.get(p.participant.id);
    if (avatarImg) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, 18, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatarImg, avatarX - 18, avatarY - 18, 36, 36);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, 18, 0, Math.PI * 2);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, 18, 0, Math.PI * 2);
      ctx.fillStyle = color.hex;
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 16px ${CANVAS_FONT_STACK}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.participant.name.slice(0, 1).toUpperCase(), avatarX, avatarY + 1);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    // Name + badge
    const textX = padX + 58;
    ctx.fillStyle = '#0f172a';
    ctx.font = `700 18px ${CANVAS_FONT_STACK}`;
    const label = p.participant.isMe
      ? `${p.participant.name} (ฉัน)`
      : p.isPaid
        ? `${p.participant.name} ✓ จ่ายแล้ว`
        : p.participant.name;
    ctx.fillText(label, textX, curY + 32);

    // Amount right
    ctx.textAlign = 'right';
    ctx.fillStyle = p.isPaid && !p.participant.isMe ? '#059669' : '#0f766e';
    ctx.font = `700 22px ${CANVAS_FONT_STACK}`;
    ctx.fillText(formatBaht(p.roundedTotal), width - padX - 20, curY + 36);
    ctx.textAlign = 'left';

    // Subtext shop breakdown
    ctx.fillStyle = '#64748b';
    ctx.font = `400 15px ${CANVAS_FONT_STACK}`;
    row.subLines.forEach((line, idx) => {
      ctx.fillText(line, textX, curY + 56 + idx * 22);
    });

    curY += row.cardH + 12;
  }

  // Transfers card
  if (calc.transfers.length > 0) {
    curY += 12;
    ctx.fillStyle = '#0f172a';
    ctx.font = `700 18px ${CANVAS_FONT_STACK}`;
    ctx.fillText('สรุปยอดโอนสุทธิ', padX, curY + 20);
    curY += 34;

    const tBoxH = calc.transfers.length * 38 + 20;
    drawRoundedRect(ctx, padX, curY, innerW, tBoxH, 14);
    ctx.fillStyle = '#f0fdfa';
    ctx.fill();
    ctx.strokeStyle = '#99f6e4';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    calc.transfers.forEach((t, idx) => {
      const ty = curY + 34 + idx * 38;
      ctx.fillStyle = '#134e4a';
      ctx.font = `600 16px ${CANVAS_FONT_STACK}`;
      ctx.fillText(`${t.fromName}  โอนให้  ${t.toName}`, padX + 20, ty);
      ctx.textAlign = 'right';
      ctx.font = `700 18px ${CANVAS_FONT_STACK}`;
      ctx.fillText(formatBaht(t.amount), width - padX - 20, ty);
      ctx.textAlign = 'left';
    });

    curY += tBoxH + 8;
  }

  // Shop-by-shop details
  if (shopLayouts.length > 0) {
    curY += 14;
    ctx.fillStyle = '#0f172a';
    ctx.font = `700 18px ${CANVAS_FONT_STACK}`;
    ctx.fillText('รายละเอียดแต่ละร้าน', padX, curY + 20);
    curY += 34;

    for (const shop of shopLayouts) {
      drawRoundedRect(ctx, padX, curY, innerW, shop.cardH, 14);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      let sy = curY + 32;
      ctx.fillStyle = '#0f172a';
      ctx.font = `700 18px ${CANVAS_FONT_STACK}`;
      shop.shopNameLines.forEach((line, idx) => {
        ctx.fillText(line, padX + 20, sy + idx * 24);
      });

      ctx.textAlign = 'right';
      ctx.fillStyle = '#0f766e';
      ctx.fillText(shop.totalText, width - padX - 20, sy);
      ctx.textAlign = 'left';
      sy += shop.shopNameLines.length * 24;

      if (shop.metaLines.length > 0) {
        ctx.fillStyle = '#b45309';
        ctx.font = `500 14px ${CANVAS_FONT_STACK}`;
        for (const ml of shop.metaLines) {
          ctx.fillText(ml, padX + 20, sy);
          sy += 20;
        }
        sy += 4;
      }

      // Divider
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padX + 20, sy);
      ctx.lineTo(width - padX - 20, sy);
      ctx.stroke();
      sy += 22;

      for (const pb of shop.peopleBlocks) {
        ctx.fillStyle = '#1e293b';
        ctx.font = `700 16px ${CANVAS_FONT_STACK}`;
        ctx.fillText(pb.name, padX + 20, sy);
        ctx.textAlign = 'right';
        ctx.fillText(pb.totalStr, width - padX - 20, sy);
        ctx.textAlign = 'left';
        sy += 24;

        ctx.fillStyle = '#475569';
        ctx.font = `400 15px ${CANVAS_FONT_STACK}`;
        for (const wrapped of pb.itemLines) {
          for (const wl of wrapped) {
            ctx.fillText(wl, padX + 34, sy);
            sy += 22;
          }
          sy += 2;
        }

        if (pb.billDiscountShare > 0.005) {
          ctx.fillStyle = '#b45309';
          ctx.fillText(`• หักส่วนลดท้ายบิล: -${formatBaht(pb.billDiscountShare)}`, padX + 34, sy);
          sy += 22;
        }
        if (pb.serviceCharge > 0.005) {
          ctx.fillStyle = '#475569';
          ctx.fillText(`• Service Charge: +${formatBaht(pb.serviceCharge)}`, padX + 34, sy);
          sy += 22;
        }
        if (pb.vat > 0.005) {
          ctx.fillStyle = '#475569';
          ctx.fillText(`• VAT: +${formatBaht(pb.vat)}`, padX + 34, sy);
          sy += 22;
        }
        sy += 12;
      }

      curY += shop.cardH + 14;
    }
  }

  // Footer Payment & QR
  curY += 14;
  drawRoundedRect(ctx, padX, curY, innerW, footerCardH, 16);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  if (hasBankInfo) {
    const qrBoxSize = 180;
    const textMaxW = qrImg ? innerW - qrBoxSize - 64 : innerW - 48;
    let fy = curY + 38;

    ctx.fillStyle = '#0f766e';
    ctx.font = `700 17px ${CANVAS_FONT_STACK}`;
    ctx.fillText('ช่องทางรับโอนเงิน', padX + 24, fy);
    fy += 30;

    ctx.fillStyle = '#0f172a';
    if (normalizePromptPayTarget(paymentProfile.promptPayId)) {
      ctx.font = `600 17px ${CANVAS_FONT_STACK}`;
      ctx.fillText(
        `พร้อมเพย์: ${formatPromptPayDisplay(paymentProfile.promptPayId)}`,
        padX + 24,
        fy,
      );
      fy += 28;
    }
    if (paymentProfile.bankName || paymentProfile.accountNumber) {
      ctx.font = `500 16px ${CANVAS_FONT_STACK}`;
      const accLines = measureWrapped(
        [paymentProfile.bankName, paymentProfile.accountNumber].filter(Boolean).join('  •  '),
        `500 16px ${CANVAS_FONT_STACK}`,
        textMaxW,
      );
      for (const al of accLines) {
        ctx.fillText(al, padX + 24, fy);
        fy += 24;
      }
    }
    if (paymentProfile.accountName) {
      ctx.fillStyle = '#475569';
      ctx.font = `500 16px ${CANVAS_FONT_STACK}`;
      ctx.fillText(`ชื่อบัญชี: ${paymentProfile.accountName}`, padX + 24, fy);
      fy += 26;
    }
    if (qrResolved.caption) {
      ctx.fillStyle = '#64748b';
      ctx.font = `400 14px ${CANVAS_FONT_STACK}`;
      ctx.fillText(qrResolved.caption, padX + 24, fy + 4);
    }

    if (qrImg) {
      const qx = width - padX - qrBoxSize - 24;
      const qy = curY + (footerCardH - qrBoxSize) / 2;
      drawRoundedRect(ctx, qx - 6, qy - 6, qrBoxSize + 12, qrBoxSize + 12, 12);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.drawImage(qrImg, qx, qy, qrBoxSize, qrBoxSize);
    }
  } else {
    ctx.fillStyle = '#64748b';
    ctx.font = `500 15px ${CANVAS_FONT_STACK}`;
    ctx.fillText('สามารถตั้งค่าพร้อมเพย์หรือรูป QR รับเงินได้ที่แท็บ "บัญชี & QR"', padX + 24, curY + 38);
  }

  const blob = await canvasToBlob(canvas);
  const dataUrl = canvas.toDataURL('image/png');
  return { blob, dataUrl };
}

export async function renderIndividualBillPng(
  person: PersonSessionSummary,
  session: DailySession,
  paymentProfile: PaymentProfile,
  qrMode?: PreferredQrMode,
): Promise<{ blob: Blob; dataUrl: string }> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await document.fonts.ready;
  }

  const qrResolved = await resolveQrForSummary(
    paymentProfile,
    person.roundedTotal,
    qrMode,
  );
  const qrImg = qrResolved.dataUrl ? await loadImage(qrResolved.dataUrl).catch(() => null) : null;
  const personAvatarImg = person.participant.avatarDataUrl
    ? await loadImage(person.participant.avatarDataUrl).catch(() => null)
    : null;

  const width = 720;
  const padX = 28;
  const innerW = width - padX * 2;
  const dpr = 2;

  const measureCanvas = document.createElement('canvas');
  const mCtx = measureCanvas.getContext('2d');
  if (!mCtx) throw new Error('Canvas 2D not supported');

  const measureWrapped = (text: string, font: string, maxW: number): string[] => {
    mCtx.font = font;
    return wrapThaiText(mCtx, text, maxW);
  };

  interface ShopSectionLayout {
    shopNameLines: string[];
    totalText: string;
    items: Array<{ lines: string[]; amountText: string }>;
    extras: Array<{ label: string; amountText: string; isDiscount: boolean }>;
    cardH: number;
  }

  const headerTextX = personAvatarImg ? padX + 70 : padX;
  const titleLines = measureWrapped(
    session.title || 'สรุปค่าใช้จ่ายวันนี้',
    `400 16px ${CANVAS_FONT_STACK}`,
    width - headerTextX - padX,
  );
  const headerH = Math.max(128, 104 + titleLines.length * 22 + 12);

  const shopLayouts: ShopSectionLayout[] = [];
  let y = headerH + 20;

  for (const r of person.receipts) {
    const b = r.breakdown;
    if (b.total <= 0.001 && b.items.length === 0) continue;

    const shopNameLines = measureWrapped(
      r.shopName,
      `700 17px ${CANVAS_FONT_STACK}`,
      innerW - 150,
    );

    const items: ShopSectionLayout['items'] = [];
    let bodyH = 48 + shopNameLines.length * 24;
    for (const it of b.items) {
      const shareTag = it.sharedCount > 1 ? ` (หาร ${it.sharedCount})` : '';
      const discTag =
        it.shareItemDiscount > 0.005 ? ` [ลด -${formatBaht(it.shareItemDiscount)}]` : '';
      const lines = measureWrapped(
        `${it.name}${shareTag}${discTag}`,
        `400 15px ${CANVAS_FONT_STACK}`,
        innerW - 150,
      );
      items.push({ lines, amountText: formatBaht(it.shareNet) });
      bodyH += lines.length * 22 + 8;
    }

    const extras: ShopSectionLayout['extras'] = [];
    if (b.billDiscountShare > 0.005) {
      extras.push({
        label: 'ส่วนลดท้ายบิลตามสัดส่วน',
        amountText: `-${formatBaht(b.billDiscountShare)}`,
        isDiscount: true,
      });
      bodyH += 26;
    }
    if (b.serviceCharge > 0.005) {
      extras.push({
        label: 'Service Charge',
        amountText: `+${formatBaht(b.serviceCharge)}`,
        isDiscount: false,
      });
      bodyH += 26;
    }
    if (b.vat > 0.005) {
      extras.push({
        label: 'VAT',
        amountText: `+${formatBaht(b.vat)}`,
        isDiscount: false,
      });
      bodyH += 26;
    }

    const cardH = bodyH + 18;
    shopLayouts.push({
      shopNameLines,
      totalText: formatBaht(b.total),
      items,
      extras,
      cardH,
    });
    y += cardH + 12;
  }

  // Total + QR card
  const qrBlockH = qrImg ? 348 : 128;
  y += qrBlockH + 28;

  const canvas = document.createElement('canvas');
  canvas.width = width * dpr;
  canvas.height = y * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D not supported');

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, width, y);

  // Header (Dark Obsidian banner + electric teal accent)
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, headerH);
  ctx.fillStyle = '#14b8a6';
  ctx.fillRect(0, headerH - 4, width, 4);

  if (personAvatarImg) {
    const ax = padX + 26;
    const ay = 64;
    ctx.save();
    ctx.beginPath();
    ctx.arc(ax, ay, 26, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(personAvatarImg, ax - 26, ay - 26, 52, 52);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(ax, ay, 26, 0, Math.PI * 2);
    ctx.strokeStyle = '#2dd4bf';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.fillStyle = '#5eead4';
  ctx.font = `600 15px ${CANVAS_FONT_STACK}`;
  ctx.fillText(`ใบแจ้งยอดรายบุคคล  •  ${formatThaiDate(session.date)}`, headerTextX, 36);

  ctx.fillStyle = '#ffffff';
  ctx.font = `700 28px ${CANVAS_FONT_STACK}`;
  ctx.fillText(`คุณ${person.participant.name}`, headerTextX, 74);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = `400 16px ${CANVAS_FONT_STACK}`;
  titleLines.forEach((line, idx) => {
    ctx.fillText(line, headerTextX, 104 + idx * 22);
  });

  let curY = headerH + 20;

  for (const shop of shopLayouts) {
    drawRoundedRect(ctx, padX, curY, innerW, shop.cardH, 14);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    let sy = curY + 32;
    ctx.fillStyle = '#0f172a';
    ctx.font = `700 17px ${CANVAS_FONT_STACK}`;
    shop.shopNameLines.forEach((line, idx) => {
      ctx.fillText(line, padX + 18, sy + idx * 24);
    });

    ctx.textAlign = 'right';
    ctx.fillStyle = '#0f766e';
    ctx.fillText(shop.totalText, width - padX - 18, sy);
    ctx.textAlign = 'left';

    sy = curY + 24 + shop.shopNameLines.length * 24;
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX + 18, sy);
    ctx.lineTo(width - padX - 18, sy);
    ctx.stroke();
    sy += 24;

    for (const item of shop.items) {
      ctx.fillStyle = '#334155';
      ctx.font = `400 15px ${CANVAS_FONT_STACK}`;
      item.lines.forEach((line, idx) => {
        ctx.fillText(line, padX + 18, sy + idx * 22);
      });
      ctx.textAlign = 'right';
      ctx.fillStyle = '#0f172a';
      ctx.font = `600 15px ${CANVAS_FONT_STACK}`;
      ctx.fillText(item.amountText, width - padX - 18, sy);
      ctx.textAlign = 'left';
      sy += item.lines.length * 22 + 8;
    }

    for (const ex of shop.extras) {
      ctx.fillStyle = ex.isDiscount ? '#b45309' : '#64748b';
      ctx.font = `500 14px ${CANVAS_FONT_STACK}`;
      ctx.fillText(ex.label, padX + 18, sy);
      ctx.textAlign = 'right';
      ctx.fillText(ex.amountText, width - padX - 18, sy);
      ctx.textAlign = 'left';
      sy += 26;
    }

    curY += shop.cardH + 12;
  }

  // Total & QR Box
  drawRoundedRect(ctx, padX, curY, innerW, qrBlockH, 16);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#99f6e4';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#0f766e';
  ctx.font = `600 16px ${CANVAS_FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.fillText('ยอดสุทธิที่ต้องโอน', width / 2, curY + 34);

  ctx.fillStyle = '#0f172a';
  ctx.font = `700 34px ${CANVAS_FONT_STACK}`;
  ctx.fillText(formatBaht(person.roundedTotal), width / 2, curY + 76);

  if (qrImg) {
    const qrSize = 180;
    const qx = (width - qrSize) / 2;
    const qy = curY + 94;
    ctx.drawImage(qrImg, qx, qy, qrSize, qrSize);

    ctx.fillStyle = '#0f766e';
    ctx.font = `600 14px ${CANVAS_FONT_STACK}`;
    ctx.fillText(qrResolved.caption, width / 2, qy + qrSize + 22);

    const accSummary = [
      paymentProfile.bankName,
      paymentProfile.accountNumber,
      paymentProfile.accountName,
    ]
      .filter(Boolean)
      .join('  •  ');
    if (accSummary) {
      ctx.fillStyle = '#475569';
      ctx.font = `400 14px ${CANVAS_FONT_STACK}`;
      ctx.fillText(accSummary, width / 2, qy + qrSize + 44);
    }
  } else {
    ctx.fillStyle = '#64748b';
    ctx.font = `400 14px ${CANVAS_FONT_STACK}`;
    ctx.fillText(
      'ยังไม่ได้ตั้งค่าพร้อมเพย์หรือรูป QR รับเงิน',
      width / 2,
      curY + 104,
    );
  }
  ctx.textAlign = 'left';

  const blob = await canvasToBlob(canvas);
  const dataUrl = canvas.toDataURL('image/png');
  return { blob, dataUrl };
}

export async function shareOrDownloadPng(
  blob: Blob,
  filename: string,
  title: string,
): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: 'image/png' });

  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    typeof navigator.share === 'function'
  ) {
    try {
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title,
          files: [file],
        });
        return 'shared';
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return 'shared';
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
