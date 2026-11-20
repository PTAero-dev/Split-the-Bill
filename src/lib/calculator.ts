import {
  DailySession,
  Friend,
  LineItem,
  LineItemBreakdown,
  ME_ID,
  ParticipantInfo,
  PersonReceiptBreakdown,
  PersonSessionSummary,
  Receipt,
  ReceiptCalculation,
  RoundingMode,
  SessionCalculation,
  SettlementTransfer,
} from '../types';

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function applyRounding(amount: number, mode: RoundingMode): number {
  const safe = Math.max(0, amount);
  switch (mode) {
    case 'round_baht':
      return Math.round(safe);
    case 'ceil_baht':
      return Math.ceil(safe - 1e-9);
    case 'exact':
    default:
      return round2(safe);
  }
}

export function calculateLineItem(item: LineItem): {
  gross: number;
  itemDiscount: number;
  net: number;
} {
  const unitPrice = Math.max(0, Number.isFinite(item.unitPrice) ? item.unitPrice : 0);
  const quantity = Math.max(0, Number.isFinite(item.quantity) ? item.quantity : 0);
  const gross = unitPrice * quantity;

  let itemDiscount = 0;
  const rawDisc = Math.max(0, Number.isFinite(item.discountValue) ? item.discountValue : 0);
  if (item.discountType === 'percent') {
    const pct = Math.min(100, rawDisc);
    itemDiscount = gross * (pct / 100);
  } else if (item.discountType === 'amount') {
    itemDiscount = Math.min(gross, rawDisc);
  }

  const net = Math.max(0, gross - itemDiscount);
  return { gross, itemDiscount, net };
}

export function allocateEqualWithCap(
  totalDiscount: number,
  bases: Map<string, number>,
): Map<string, number> {
  const allocation = new Map<string, number>();
  for (const id of bases.keys()) {
    allocation.set(id, 0);
  }

  let remaining = Math.max(0, totalDiscount);
  const activeIds = Array.from(bases.entries())
    .filter(([, base]) => base > 1e-9)
    .map(([id]) => id);

  let pool = activeIds;
  while (remaining > 1e-9 && pool.length > 0) {
    const equalShare = remaining / pool.length;
    const nextPool: string[] = [];
    let distributedThisRound = 0;

    for (const id of pool) {
      const cap = (bases.get(id) ?? 0) - (allocation.get(id) ?? 0);
      if (cap <= 1e-9) continue;

      if (cap <= equalShare + 1e-9) {
        allocation.set(id, (allocation.get(id) ?? 0) + cap);
        distributedThisRound += cap;
      } else {
        allocation.set(id, (allocation.get(id) ?? 0) + equalShare);
        distributedThisRound += equalShare;
        nextPool.push(id);
      }
    }

    remaining = Math.max(0, remaining - distributedThisRound);
    if (distributedThisRound <= 1e-9) break;
    pool = nextPool;
  }

  return allocation;
}

interface PersonTaxAccumulator {
  participantId: string;
  name: string;
  grossSubtotal: number;
  itemDiscountTotal: number;
  netFoodSubtotal: number;
  scEligible: number;
  vatEligible: number;
  bothEligible: number;
  items: LineItemBreakdown[];
}

export function calculateReceipt(
  receipt: Receipt,
  participantMap: Map<string, ParticipantInfo>,
): ReceiptCalculation {
  const personAccMap = new Map<string, PersonTaxAccumulator>();

  const ensureAcc = (participantId: string): PersonTaxAccumulator => {
    let acc = personAccMap.get(participantId);
    if (!acc) {
      const info = participantMap.get(participantId);
      acc = {
        participantId,
        name: info?.name ?? 'เพื่อน',
        grossSubtotal: 0,
        itemDiscountTotal: 0,
        netFoodSubtotal: 0,
        scEligible: 0,
        vatEligible: 0,
        bothEligible: 0,
        items: [],
      };
      personAccMap.set(participantId, acc);
    }
    return acc;
  };

  for (const id of receipt.attendeeIds) {
    ensureAcc(id);
  }

  let itemsGrossTotal = 0;
  let itemDiscountTotal = 0;
  let itemsNetTotal = 0;
  let unassignedTotal = 0;
  const unassignedItems: LineItem[] = [];

  for (const item of receipt.items) {
    const { gross, itemDiscount, net } = calculateLineItem(item);
    itemsGrossTotal += gross;
    itemDiscountTotal += itemDiscount;
    itemsNetTotal += net;

    const validShares = item.shares.filter((s) => s.weight > 0);
    if (validShares.length === 0) {
      unassignedItems.push(item);
      unassignedTotal += net;
      continue;
    }

    const totalWeight = validShares.reduce((sum, s) => sum + s.weight, 0);
    for (const share of validShares) {
      const acc = ensureAcc(share.participantId);
      const ratio = share.weight / totalWeight;
      const shareGross = gross * ratio;
      const shareItemDiscount = itemDiscount * ratio;
      const shareNet = net * ratio;

      acc.grossSubtotal += shareGross;
      acc.itemDiscountTotal += shareItemDiscount;
      acc.netFoodSubtotal += shareNet;

      if (!item.exemptSC) {
        acc.scEligible += shareNet;
      }
      if (!item.exemptVAT) {
        acc.vatEligible += shareNet;
      }
      if (!item.exemptSC && !item.exemptVAT) {
        acc.bothEligible += shareNet;
      }

      acc.items.push({
        itemId: item.id,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        grossTotal: gross,
        itemDiscountTotal: itemDiscount,
        netTotal: net,
        shareRatio: ratio,
        shareGross,
        shareItemDiscount,
        shareNet,
        sharedCount: validShares.length,
        exemptSC: item.exemptSC,
        exemptVAT: item.exemptVAT,
      });
    }
  }

  // Conveyor belt sushi / colored plate counting
  if (receipt.plateTiers && receipt.plateCounts) {
    const tierMap = new Map(receipt.plateTiers.map((t) => [t.id, t]));
    const exemptSC = Boolean(receipt.plateExemptSC);
    const exemptVAT = Boolean(receipt.plateExemptVAT);

    for (const [participantId, countsByTier] of Object.entries(receipt.plateCounts)) {
      if (!countsByTier) continue;
      for (const [tierId, rawQty] of Object.entries(countsByTier)) {
        const qty = Math.max(0, Math.floor(Number(rawQty) || 0));
        if (qty <= 0) continue;
        const tier = tierMap.get(tierId);
        if (!tier) continue;

        const platePrice = Math.max(0, Number(tier.price) || 0);
        const gross = platePrice * qty;

        itemsGrossTotal += gross;
        itemsNetTotal += gross;

        const acc = ensureAcc(participantId);
        acc.grossSubtotal += gross;
        acc.netFoodSubtotal += gross;

        if (!exemptSC) acc.scEligible += gross;
        if (!exemptVAT) acc.vatEligible += gross;
        if (!exemptSC && !exemptVAT) acc.bothEligible += gross;

        acc.items.push({
          itemId: `plate_${participantId}_${tier.id}`,
          name: `${tier.label} (฿${platePrice}) × ${qty} จาน`,
          quantity: qty,
          unitPrice: platePrice,
          grossTotal: gross,
          itemDiscountTotal: 0,
          netTotal: gross,
          shareRatio: 1,
          shareGross: gross,
          shareItemDiscount: 0,
          shareNet: gross,
          sharedCount: 1,
          exemptSC,
          exemptVAT,
        });
      }
    }
  }

  const scRate = Math.max(0, receipt.serviceChargeRate) / 100;
  const vatRate = Math.max(0, receipt.vatRate) / 100;
  const rawBillDiscountVal = Math.max(0, receipt.billDiscountValue);

  const personBreakdowns: Record<string, PersonReceiptBreakdown> = {};
  let billDiscountTotal = 0;
  let serviceChargeTotal = 0;
  let vatTotal = 0;
  let calculatedTotal = 0;

  if (receipt.billDiscountTiming === 'after_tax') {
    const preDiscountTotalMap = new Map<string, number>();
    const preScMap = new Map<string, number>();
    const preVatMap = new Map<string, number>();

    let totalPreDiscount = 0;
    for (const [id, acc] of personAccMap.entries()) {
      const sc = acc.scEligible * scRate;
      const vatBase =
        acc.vatEligible + (receipt.vatOnServiceCharge ? acc.bothEligible * scRate : 0);
      const vat = vatBase * vatRate;
      const preTotal = acc.netFoodSubtotal + sc + vat;
      preScMap.set(id, sc);
      preVatMap.set(id, vat);
      preDiscountTotalMap.set(id, preTotal);
      totalPreDiscount += preTotal;
    }

    let targetBillDiscount = 0;
    if (receipt.billDiscountType === 'percent') {
      targetBillDiscount = totalPreDiscount * (Math.min(100, rawBillDiscountVal) / 100);
    } else if (receipt.billDiscountType === 'amount') {
      targetBillDiscount = Math.min(totalPreDiscount, rawBillDiscountVal);
    }

    const discAlloc =
      receipt.billDiscountAllocation === 'equal'
        ? allocateEqualWithCap(targetBillDiscount, preDiscountTotalMap)
        : new Map(
            Array.from(preDiscountTotalMap.entries()).map(([id, base]) => [
              id,
              totalPreDiscount > 1e-9 ? targetBillDiscount * (base / totalPreDiscount) : 0,
            ]),
          );

    for (const [id, acc] of personAccMap.entries()) {
      const preTotal = preDiscountTotalMap.get(id) ?? 0;
      const disc = discAlloc.get(id) ?? 0;
      const sc = preScMap.get(id) ?? 0;
      const vat = preVatMap.get(id) ?? 0;
      const finalTotal = Math.max(0, preTotal - disc);

      billDiscountTotal += disc;
      serviceChargeTotal += sc;
      vatTotal += vat;
      calculatedTotal += finalTotal;

      personBreakdowns[id] = {
        participantId: id,
        name: acc.name,
        grossSubtotal: acc.grossSubtotal,
        itemDiscountTotal: acc.itemDiscountTotal,
        netFoodSubtotal: acc.netFoodSubtotal,
        billDiscountShare: disc,
        foodAfterBillDiscount: Math.max(0, acc.netFoodSubtotal - disc),
        serviceCharge: sc,
        vat,
        total: finalTotal,
        items: acc.items,
      };
    }
  } else {
    // before_tax (default Thai retail & restaurant receipt behavior)
    const netFoodMap = new Map<string, number>();
    let totalAssignedNetFood = 0;

    for (const [id, acc] of personAccMap.entries()) {
      netFoodMap.set(id, acc.netFoodSubtotal);
      totalAssignedNetFood += acc.netFoodSubtotal;
    }

    let targetBillDiscount = 0;
    if (receipt.billDiscountType === 'percent') {
      targetBillDiscount = totalAssignedNetFood * (Math.min(100, rawBillDiscountVal) / 100);
    } else if (receipt.billDiscountType === 'amount') {
      targetBillDiscount = Math.min(totalAssignedNetFood, rawBillDiscountVal);
    }

    const discAlloc =
      receipt.billDiscountAllocation === 'equal'
        ? allocateEqualWithCap(targetBillDiscount, netFoodMap)
        : new Map(
            Array.from(netFoodMap.entries()).map(([id, base]) => [
              id,
              totalAssignedNetFood > 1e-9 ? targetBillDiscount * (base / totalAssignedNetFood) : 0,
            ]),
          );

    for (const [id, acc] of personAccMap.entries()) {
      const disc = discAlloc.get(id) ?? 0;
      const foodAfter = Math.max(0, acc.netFoodSubtotal - disc);
      const scale =
        acc.netFoodSubtotal > 1e-9 ? foodAfter / acc.netFoodSubtotal : 0;

      const scBase = acc.scEligible * scale;
      const vatBase = acc.vatEligible * scale;
      const bothBase = acc.bothEligible * scale;

      const sc = scBase * scRate;
      const vat = (vatBase + (receipt.vatOnServiceCharge ? bothBase * scRate : 0)) * vatRate;
      const finalTotal = foodAfter + sc + vat;

      billDiscountTotal += disc;
      serviceChargeTotal += sc;
      vatTotal += vat;
      calculatedTotal += finalTotal;

      personBreakdowns[id] = {
        participantId: id,
        name: acc.name,
        grossSubtotal: acc.grossSubtotal,
        itemDiscountTotal: acc.itemDiscountTotal,
        netFoodSubtotal: acc.netFoodSubtotal,
        billDiscountShare: disc,
        foodAfterBillDiscount: foodAfter,
        serviceCharge: sc,
        vat,
        total: finalTotal,
        items: acc.items,
      };
    }
  }

  const actualDiff =
    receipt.actualReceiptTotal !== null && Number.isFinite(receipt.actualReceiptTotal)
      ? round2(receipt.actualReceiptTotal - calculatedTotal)
      : null;

  return {
    receiptId: receipt.id,
    shopName: receipt.shopName,
    category: receipt.category,
    payerId: receipt.payerId,
    itemsGrossTotal: round2(itemsGrossTotal),
    itemDiscountTotal: round2(itemDiscountTotal),
    itemsNetTotal: round2(itemsNetTotal),
    billDiscountTotal: round2(billDiscountTotal),
    serviceChargeTotal: round2(serviceChargeTotal),
    vatTotal: round2(vatTotal),
    calculatedTotal: round2(calculatedTotal),
    unassignedTotal: round2(unassignedTotal),
    unassignedItems,
    actualDiff,
    personBreakdowns,
  };
}

export function calculateSession(
  session: DailySession,
  friends: Friend[],
  myName = 'ฉัน',
  myAvatarDataUrl?: string | null,
  myColor = 'teal',
): SessionCalculation {
  const friendMap = new Map(friends.map((f) => [f.id, f]));
  const participantMap = new Map<string, ParticipantInfo>();
  const orderedIds: string[] = [];

  const registerParticipant = (id: string) => {
    if (participantMap.has(id)) return;
    if (id === ME_ID) {
      participantMap.set(ME_ID, {
        id: ME_ID,
        name: myName.trim() || 'ฉัน',
        color: myColor || 'teal',
        avatarDataUrl: myAvatarDataUrl ?? null,
        isMe: true,
      });
      orderedIds.push(ME_ID);
      return;
    }

    const friend = friendMap.get(id);
    participantMap.set(id, {
      id,
      name: friend?.name ?? 'เพื่อนที่ลบแล้ว',
      color: friend?.color ?? 'slate',
      avatarDataUrl: friend?.avatarDataUrl ?? null,
      isMe: false,
    });
    orderedIds.push(id);
  };

  if (session.includeMe) {
    registerParticipant(ME_ID);
  }
  for (const id of session.participantIds) {
    registerParticipant(id);
  }

  // Ensure anyone referenced in any receipt is also included
  for (const receipt of session.receipts) {
    if (receipt.payerId) registerParticipant(receipt.payerId);
    for (const id of receipt.attendeeIds) {
      registerParticipant(id);
    }
    for (const item of receipt.items) {
      for (const share of item.shares) {
        if (share.weight > 0) registerParticipant(share.participantId);
      }
    }
    if (receipt.plateCounts) {
      for (const [pid, counts] of Object.entries(receipt.plateCounts)) {
        if (counts && Object.values(counts).some((q) => q > 0)) {
          registerParticipant(pid);
        }
      }
    }
  }

  const receiptCalculations = session.receipts.map((receipt) =>
    calculateReceipt(receipt, participantMap),
  );

  const exactPaidMap = new Map<string, number>();
  for (const calc of receiptCalculations) {
    if (calc.payerId) {
      exactPaidMap.set(
        calc.payerId,
        (exactPaidMap.get(calc.payerId) ?? 0) + calc.calculatedTotal,
      );
    }
  }

  const personSummaries: PersonSessionSummary[] = orderedIds.map((id) => {
    const participant = participantMap.get(id)!;
    const receiptsForPerson: PersonSessionSummary['receipts'] = [];
    let exactTotal = 0;

    for (const rCalc of receiptCalculations) {
      const breakdown = rCalc.personBreakdowns[id];
      if (breakdown) {
        receiptsForPerson.push({
          receiptId: rCalc.receiptId,
          shopName: rCalc.shopName,
          category: rCalc.category,
          breakdown,
        });
        exactTotal += breakdown.total;
      }
    }

    const roundedTotal = applyRounding(exactTotal, session.roundingMode);
    const totalPaidAsPayer = round2(exactPaidMap.get(id) ?? 0);
    const netBalance = round2(totalPaidAsPayer - exactTotal);

    return {
      participant,
      receipts: receiptsForPerson,
      exactTotal: round2(exactTotal),
      roundedTotal,
      totalPaidAsPayer,
      netBalance,
      isPaid: participant.isMe ? true : Boolean(session.paidStatus[id]),
    };
  });

  // Compute debt-minimized transfers
  const activePayers = Array.from(exactPaidMap.entries()).filter(([, amt]) => amt > 1e-6);
  const transfers: SettlementTransfer[] = [];

  if (activePayers.length === 1) {
    const singlePayerId = activePayers[0][0];
    const payerInfo = participantMap.get(singlePayerId);
    for (const summary of personSummaries) {
      if (summary.participant.id !== singlePayerId && summary.roundedTotal > 0) {
        transfers.push({
          fromId: summary.participant.id,
          fromName: summary.participant.name,
          toId: singlePayerId,
          toName: payerInfo?.name ?? 'ผู้จ่าย',
          amount: summary.roundedTotal,
        });
      }
    }
  } else if (activePayers.length > 1) {
    const creditors = personSummaries
      .filter((s) => s.netBalance > 0.005)
      .map((s) => ({ id: s.participant.id, name: s.participant.name, amount: s.netBalance }))
      .sort((a, b) => b.amount - a.amount);

    const debtors = personSummaries
      .filter((s) => s.netBalance < -0.005)
      .map((s) => ({ id: s.participant.id, name: s.participant.name, amount: -s.netBalance }))
      .sort((a, b) => b.amount - a.amount);

    let ci = 0;
    let di = 0;
    while (ci < creditors.length && di < debtors.length) {
      const creditor = creditors[ci];
      const debtor = debtors[di];
      const settle = Math.min(creditor.amount, debtor.amount);
      const roundedSettle = applyRounding(settle, session.roundingMode);

      if (roundedSettle > 0) {
        transfers.push({
          fromId: debtor.id,
          fromName: debtor.name,
          toId: creditor.id,
          toName: creditor.name,
          amount: roundedSettle,
        });
      }

      creditor.amount -= settle;
      debtor.amount -= settle;
      if (creditor.amount <= 0.005) ci += 1;
      if (debtor.amount <= 0.005) di += 1;
    }
  }

  const grandTotal = round2(
    receiptCalculations.reduce((sum, r) => sum + r.calculatedTotal, 0),
  );
  const roundedGrandTotal = round2(
    personSummaries.reduce((sum, p) => sum + p.roundedTotal, 0),
  );
  const mySummary = personSummaries.find((p) => p.participant.isMe);
  const myShare = mySummary ? mySummary.roundedTotal : 0;

  const friendSummaries = personSummaries.filter((p) => !p.participant.isMe);
  const collectibleFromFriends = round2(
    friendSummaries.reduce((sum, p) => sum + p.roundedTotal, 0),
  );
  const collectedAmount = round2(
    friendSummaries.filter((p) => p.isPaid).reduce((sum, p) => sum + p.roundedTotal, 0),
  );
  const remainingAmount = round2(Math.max(0, collectibleFromFriends - collectedAmount));
  const unassignedItemCount = receiptCalculations.reduce(
    (sum, r) => sum + r.unassignedItems.length,
    0,
  );

  return {
    participants: orderedIds.map((id) => participantMap.get(id)!),
    receiptCalculations,
    personSummaries,
    transfers,
    grandTotal,
    roundedGrandTotal,
    myShare,
    collectibleFromFriends,
    collectedAmount,
    remainingAmount,
    unassignedItemCount,
  };
}
