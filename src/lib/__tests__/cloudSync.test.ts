import { describe, expect, it } from 'vitest';
import {
  buildSyncFingerprint,
  computeSyncDiff,
  hasAnySyncDiff,
  mergeCloudAndLocalState,
  stripUndefined,
  toFriendDoc,
  toProfileDoc,
  toSessionDoc,
  toTemplateDoc,
} from '../cloudSync';
import { BUILTIN_SUSHIRO_TEMPLATE_ID } from '../format';
import { createEmptyReceipt, getDefaultState } from '../storage';
import { AppState, DailySession, Friend, ME_ID, ShopTemplate } from '../../types';

function makeFriend(overrides: Partial<Friend> = {}): Friend {
  return {
    id: 'fr_ake',
    name: 'เอก',
    color: 'sky',
    isDefaultGroup: true,
    ...overrides,
  };
}

function makeSession(overrides: Partial<DailySession> = {}): DailySession {
  return {
    id: 'ses_1',
    date: '2026-11-20',
    title: 'มื้อเย็น',
    includeMe: true,
    participantIds: ['fr_ake'],
    roundingMode: 'exact',
    receipts: [createEmptyReceipt([ME_ID, 'fr_ake'], ME_ID, 1, 'sushi')],
    paidStatus: {},
    createdAt: '2026-11-20T12:00:00.000Z',
    updatedAt: '2026-11-20T12:30:00.000Z',
    ...overrides,
  };
}

describe('Firebase cloudSync helpers', () => {
  it('stripUndefined removes nested undefined keys while preserving null and arrays', () => {
    const input = {
      a: 1,
      b: undefined,
      c: null,
      nested: {
        keep: 'yes',
        drop: undefined,
        items: [{ id: '1', note: undefined }, { id: '2', note: 'ok' }],
      },
    };
    expect(stripUndefined(input)).toEqual({
      a: 1,
      c: null,
      nested: {
        keep: 'yes',
        items: [{ id: '1' }, { id: '2', note: 'ok' }],
      },
    });
  });

  it('serializes profile, friend, template, and session docs with exact Firestore rule keys and no undefined values', () => {
    const state: AppState = {
      ...getDefaultState(),
      myName: '   ',
      myAvatarDataUrl: undefined,
    };
    const pDoc = toProfileDoc(state, '2026-11-20T12:00:00.000Z');
    expect(Object.keys(pDoc).sort()).toEqual([
      'myAvatarDataUrl',
      'myColor',
      'myName',
      'paymentProfile',
      'seededBuiltInTemplateIds',
      'updatedAt',
      'version',
    ]);
    expect(pDoc.version).toBe(1);
    expect(pDoc.myName).toBe('ฉัน');
    expect(pDoc.myColor).toBe('teal');
    expect(pDoc.myAvatarDataUrl).toBeNull();
    expect(Object.keys(pDoc.paymentProfile).sort()).toEqual([
      'accountName',
      'accountNumber',
      'bankName',
      'customQrImageDataUrl',
      'preferredQrMode',
      'promptPayId',
    ]);

    const fDoc = toFriendDoc(makeFriend(), '2026-11-20T12:00:00.000Z');
    expect(Object.keys(fDoc).sort()).toEqual([
      'avatarDataUrl',
      'color',
      'id',
      'isDefaultGroup',
      'name',
      'note',
      'updatedAt',
    ]);
    expect(fDoc.note).toBe('');
    expect(fDoc.avatarDataUrl).toBeNull();

    const tpl: ShopTemplate = {
      id: 'tpl_1',
      name: 'Katsu King',
      category: 'restaurant',
      serviceChargeRate: 10,
      vatRate: 7,
      vatOnServiceCharge: true,
      lastUsedAt: '2026-11-20T12:00:00.000Z',
    };
    const tDoc = toTemplateDoc(tpl, '2026-11-20T12:00:00.000Z');
    expect(Object.keys(tDoc).sort()).toEqual([
      'category',
      'id',
      'isPinned',
      'lastUsedAt',
      'name',
      'plateTiers',
      'serviceChargeRate',
      'updatedAt',
      'vatOnServiceCharge',
      'vatRate',
    ]);
    expect(tDoc.plateTiers).toEqual([]);
    expect(tDoc.isPinned).toBe(false);

    const sDoc = toSessionDoc(makeSession());
    expect(Object.keys(sDoc).sort()).toEqual([
      'createdAt',
      'date',
      'id',
      'includeMe',
      'paidStatus',
      'participantIds',
      'receipts',
      'roundingMode',
      'title',
      'updatedAt',
    ]);
  });

  it('merges brand-new cloud accounts by marking all local data for upload', () => {
    const local: AppState = {
      ...getDefaultState(),
      myName: 'ต้อม',
      friends: [makeFriend()],
      sessions: [makeSession()],
    };
    const { merged, needsUpload } = mergeCloudAndLocalState(local, null);
    expect(needsUpload).toBe(true);
    expect(merged.myName).toBe('ต้อม');
    expect(merged.friends).toHaveLength(1);
    expect(merged.sessions).toHaveLength(1);
  });

  it('pulls existing cloud data onto a fresh device without duplicating Sushiro or needlessly uploading', () => {
    const freshLocal = getDefaultState();
    const existingCloud: Partial<AppState> = {
      version: 1,
      myName: 'ต้อม',
      myColor: 'pink',
      myAvatarDataUrl: null,
      paymentProfile: {
        promptPayId: '0812345678',
        accountName: 'ต้อม',
        bankName: 'KBank',
        accountNumber: '123-4-56789-0',
        customQrImageDataUrl: null,
        preferredQrMode: 'promptpay_dynamic',
      },
      friends: [makeFriend(), makeFriend({ id: 'fr_beam', name: 'บีม' })],
      shopTemplates: [
        {
          id: BUILTIN_SUSHIRO_TEMPLATE_ID,
          name: 'Sushiro',
          category: 'sushi',
          serviceChargeRate: 10,
          vatRate: 7,
          vatOnServiceCharge: true,
          plateTiers: freshLocal.shopTemplates?.[0].plateTiers,
          isPinned: true,
          lastUsedAt: '2026-11-20T15:00:00.000Z',
        },
      ],
      seededBuiltInTemplateIds: [BUILTIN_SUSHIRO_TEMPLATE_ID],
      sessions: [makeSession()],
    };

    const { merged, needsUpload } = mergeCloudAndLocalState(
      freshLocal,
      existingCloud,
    );
    expect(needsUpload).toBe(false);
    expect(merged.myName).toBe('ต้อม');
    expect(merged.myColor).toBe('pink');
    expect(merged.paymentProfile.promptPayId).toBe('0812345678');
    expect(merged.friends).toHaveLength(2);
    expect(
      merged.shopTemplates?.filter(
        (t) => t.name.toLowerCase() === 'sushiro',
      ),
    ).toHaveLength(1);
    expect(merged.sessions).toHaveLength(1);
  });

  it('merges concurrent local + cloud edits cleanly (newer updatedAt wins, union of friends, preserves local QR and color when cloud default)', () => {
    const local: AppState = {
      ...getDefaultState(),
      myColor: 'orange',
      friends: [makeFriend({ id: 'fr_local', name: 'นัท' })],
      paymentProfile: {
        promptPayId: '0899999999',
        accountName: 'Local Account',
        bankName: 'SCB',
        accountNumber: '999',
        customQrImageDataUrl: null,
        preferredQrMode: 'promptpay_dynamic',
      },
      sessions: [
        makeSession({
          id: 'ses_shared',
          title: 'Local newer title',
          updatedAt: '2026-11-20T18:00:00.000Z',
        }),
      ],
    };

    const cloud: Partial<AppState> = {
      version: 1,
      myName: 'ปราชญ์',
      friends: [makeFriend({ id: 'fr_cloud', name: 'พลอย' })],
      paymentProfile: {
        promptPayId: '',
        accountName: '',
        bankName: '',
        accountNumber: '',
        customQrImageDataUrl: null,
        preferredQrMode: 'promptpay_dynamic',
      },
      seededBuiltInTemplateIds: [BUILTIN_SUSHIRO_TEMPLATE_ID],
      shopTemplates: [], // Cloud deliberately deleted Sushiro
      sessions: [
        makeSession({
          id: 'ses_shared',
          title: 'Cloud older title',
          updatedAt: '2026-11-20T10:00:00.000Z',
        }),
        makeSession({
          id: 'ses_cloud_only',
          date: '2026-11-19',
          title: 'Cloud only session',
          updatedAt: '2026-11-19T20:00:00.000Z',
        }),
      ],
    };

    const { merged, needsUpload } = mergeCloudAndLocalState(local, cloud);
    expect(needsUpload).toBe(true);
    expect(merged.myName).toBe('ปราชญ์');
    expect(merged.myColor).toBe('orange');
    expect(merged.paymentProfile.promptPayId).toBe('0899999999');
    expect(merged.friends.map((f) => f.id).sort()).toEqual([
      'fr_cloud',
      'fr_local',
    ]);
    // Respects deliberate deletion of Sushiro on Cloud
    expect(merged.shopTemplates).toEqual([]);
    expect(merged.sessions).toHaveLength(2);
    expect(
      merged.sessions.find((s) => s.id === 'ses_shared')?.title,
    ).toBe('Local newer title');
  });

  it('computeSyncDiff detects granular adds, updates, and deletes with zero false positives', () => {
    const baseState: AppState = {
      ...getDefaultState(),
      friends: [makeFriend()],
      sessions: [makeSession()],
    };
    const fp = buildSyncFingerprint(baseState);

    const identicalDiff = computeSyncDiff(fp, baseState);
    expect(hasAnySyncDiff(identicalDiff)).toBe(false);

    const updatedState: AppState = {
      ...baseState,
      myName: 'ชื่อใหม่',
      friends: [makeFriend({ id: 'fr_new', name: 'ใหม่' })],
      shopTemplates: [],
      sessions: [
        makeSession({
          title: 'แก้ไขชื่อบิล',
          updatedAt: '2026-11-20T19:00:00.000Z',
        }),
      ],
    };

    const diff = computeSyncDiff(fp, updatedState);
    expect(diff.profileChanged).toBe(true);
    expect(diff.upsertFriends.map((f) => f.id)).toEqual(['fr_new']);
    expect(diff.deleteFriendIds).toEqual(['fr_ake']);
    expect(diff.deleteTemplateIds).toEqual([BUILTIN_SUSHIRO_TEMPLATE_ID]);
    expect(diff.upsertSessions.map((s) => s.id)).toEqual(['ses_1']);
    expect(diff.deleteSessionIds).toEqual([]);
  });
});
