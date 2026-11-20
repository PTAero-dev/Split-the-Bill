import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import {
  AppState,
  DailySession,
  Friend,
  PaymentProfile,
  PlateTier,
  ReceiptCategory,
  RoundingMode,
  ShopTemplate,
} from '../types';
import { db } from './firebase';
import { getDefaultPaymentProfile, normalizeAppState } from './storage';

const VALID_CATEGORIES = new Set<ReceiptCategory>([
  'restaurant',
  'cafe',
  'supermarket',
  'sushi',
  'other',
]);

const VALID_ROUNDING = new Set<RoundingMode>([
  'exact',
  'round_baht',
  'ceil_baht',
]);

export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        result[k] = stripUndefined(v);
      }
    }
    return result as T;
  }
  return value;
}

export interface FirestoreUserProfileDoc {
  version: 1;
  myName: string;
  myAvatarDataUrl: string | null;
  paymentProfile: PaymentProfile;
  seededBuiltInTemplateIds: string[];
  updatedAt: string;
}

export interface FirestoreFriendDoc {
  id: string;
  name: string;
  color: string;
  avatarDataUrl: string | null;
  isDefaultGroup: boolean;
  note: string;
  updatedAt: string;
}

export interface FirestoreShopTemplateDoc {
  id: string;
  name: string;
  category: ReceiptCategory;
  serviceChargeRate: number;
  vatRate: number;
  vatOnServiceCharge: boolean;
  plateTiers: PlateTier[];
  isPinned: boolean;
  lastUsedAt: string;
  updatedAt: string;
}

export interface FirestoreSessionDoc extends DailySession {}

function clampStr(val: unknown, fallback: string, maxLen: number): string {
  const s = typeof val === 'string' ? val : fallback;
  return s.slice(0, maxLen);
}

function clampNonEmptyStr(
  val: unknown,
  fallback: string,
  maxLen: number,
): string {
  const s = typeof val === 'string' ? val.trim() : '';
  return (s || fallback).slice(0, maxLen);
}

function clampNullableDataUrl(
  val: unknown,
  maxLen: number,
): string | null {
  if (typeof val !== 'string' || !val) return null;
  return val.length <= maxLen ? val : val.slice(0, maxLen);
}

export function toProfileDoc(
  state: AppState,
  updatedAt: string,
): FirestoreUserProfileDoc {
  const rawProfile = state.paymentProfile ?? getDefaultPaymentProfile();
  return stripUndefined({
    version: 1,
    myName: clampNonEmptyStr(state.myName, 'ฉัน', 100),
    myAvatarDataUrl: clampNullableDataUrl(state.myAvatarDataUrl, 200_000),
    paymentProfile: {
      promptPayId: clampStr(rawProfile.promptPayId, '', 120),
      accountName: clampStr(rawProfile.accountName, '', 120),
      bankName: clampStr(rawProfile.bankName, '', 120),
      accountNumber: clampStr(rawProfile.accountNumber, '', 120),
      customQrImageDataUrl: clampNullableDataUrl(
        rawProfile.customQrImageDataUrl,
        600_000,
      ),
      preferredQrMode:
        rawProfile.preferredQrMode === 'custom_image'
          ? 'custom_image'
          : 'promptpay_dynamic',
    },
    seededBuiltInTemplateIds: Array.isArray(state.seededBuiltInTemplateIds)
      ? state.seededBuiltInTemplateIds
          .filter((id): id is string => typeof id === 'string')
          .slice(0, 50)
      : [],
    updatedAt: clampStr(updatedAt, new Date().toISOString(), 64),
  });
}

export function toFriendDoc(
  friend: Friend,
  updatedAt: string,
): FirestoreFriendDoc {
  return stripUndefined({
    id: friend.id,
    name: clampNonEmptyStr(friend.name, 'เพื่อน', 100),
    color: clampStr(friend.color, 'sky', 40) || 'sky',
    avatarDataUrl: clampNullableDataUrl(friend.avatarDataUrl, 200_000),
    isDefaultGroup: Boolean(friend.isDefaultGroup),
    note: clampStr(friend.note, '', 300),
    updatedAt: clampStr(updatedAt, new Date().toISOString(), 64),
  });
}

export function toTemplateDoc(
  template: ShopTemplate,
  updatedAt: string,
): FirestoreShopTemplateDoc {
  const category = VALID_CATEGORIES.has(template.category)
    ? template.category
    : 'restaurant';
  const sc = Number.isFinite(template.serviceChargeRate)
    ? Math.min(100, Math.max(0, template.serviceChargeRate))
    : 0;
  const vat = Number.isFinite(template.vatRate)
    ? Math.min(100, Math.max(0, template.vatRate))
    : 0;

  return stripUndefined({
    id: template.id,
    name: clampNonEmptyStr(template.name, 'ร้านประจำ', 120),
    category,
    serviceChargeRate: sc,
    vatRate: vat,
    vatOnServiceCharge: Boolean(template.vatOnServiceCharge),
    plateTiers: Array.isArray(template.plateTiers)
      ? stripUndefined(template.plateTiers.slice(0, 30))
      : [],
    isPinned: Boolean(template.isPinned),
    lastUsedAt: clampStr(template.lastUsedAt, updatedAt, 64),
    updatedAt: clampStr(updatedAt, new Date().toISOString(), 64),
  });
}

export function toSessionDoc(session: DailySession): FirestoreSessionDoc {
  const roundingMode = VALID_ROUNDING.has(session.roundingMode)
    ? session.roundingMode
    : 'exact';
  const now = new Date().toISOString();
  return stripUndefined({
    id: session.id,
    date: clampStr(session.date, now.slice(0, 10), 32),
    title: clampStr(session.title, 'มื้ออาหาร', 200),
    includeMe: Boolean(session.includeMe),
    participantIds: Array.isArray(session.participantIds)
      ? session.participantIds.slice(0, 100)
      : [],
    roundingMode,
    receipts: Array.isArray(session.receipts)
      ? stripUndefined(session.receipts.slice(0, 50))
      : [],
    paidStatus: stripUndefined(session.paidStatus ?? {}),
    createdAt: clampStr(session.createdAt, now, 64),
    updatedAt: clampStr(session.updatedAt, now, 64),
  });
}

function stableProfileFingerprint(state: AppState): string {
  const doc = toProfileDoc(state, '');
  return JSON.stringify(doc);
}

function stableFriendFingerprint(friend: Friend): string {
  return JSON.stringify(toFriendDoc(friend, ''));
}

function stableTemplateFingerprint(template: ShopTemplate): string {
  return JSON.stringify(toTemplateDoc(template, ''));
}

function stableSessionFingerprint(session: DailySession): string {
  return JSON.stringify(toSessionDoc(session));
}

export interface SyncFingerprint {
  profile: string;
  friends: Record<string, string>;
  templates: Record<string, string>;
  sessions: Record<string, string>;
}

export interface SyncDiff {
  profileChanged: boolean;
  upsertFriends: Friend[];
  deleteFriendIds: string[];
  upsertTemplates: ShopTemplate[];
  deleteTemplateIds: string[];
  upsertSessions: DailySession[];
  deleteSessionIds: string[];
}

export function buildSyncFingerprint(state: AppState): SyncFingerprint {
  const friends: Record<string, string> = {};
  for (const f of state.friends) {
    friends[f.id] = stableFriendFingerprint(f);
  }

  const templates: Record<string, string> = {};
  for (const t of state.shopTemplates ?? []) {
    templates[t.id] = stableTemplateFingerprint(t);
  }

  const sessions: Record<string, string> = {};
  for (const s of state.sessions) {
    sessions[s.id] = stableSessionFingerprint(s);
  }

  return {
    profile: stableProfileFingerprint(state),
    friends,
    templates,
    sessions,
  };
}

export function computeSyncDiff(
  prev: SyncFingerprint | null,
  next: AppState,
): SyncDiff {
  const nextFp = buildSyncFingerprint(next);
  const prevFriends = prev?.friends ?? {};
  const prevTemplates = prev?.templates ?? {};
  const prevSessions = prev?.sessions ?? {};

  const upsertFriends = next.friends.filter(
    (f) => prevFriends[f.id] !== nextFp.friends[f.id],
  );
  const deleteFriendIds = Object.keys(prevFriends).filter(
    (id) => !(id in nextFp.friends),
  );

  const upsertTemplates = (next.shopTemplates ?? []).filter(
    (t) => prevTemplates[t.id] !== nextFp.templates[t.id],
  );
  const deleteTemplateIds = Object.keys(prevTemplates).filter(
    (id) => !(id in nextFp.templates),
  );

  const upsertSessions = next.sessions.filter(
    (s) => prevSessions[s.id] !== nextFp.sessions[s.id],
  );
  const deleteSessionIds = Object.keys(prevSessions).filter(
    (id) => !(id in nextFp.sessions),
  );

  return {
    profileChanged: !prev || prev.profile !== nextFp.profile,
    upsertFriends,
    deleteFriendIds,
    upsertTemplates,
    deleteTemplateIds,
    upsertSessions,
    deleteSessionIds,
  };
}

export function hasAnySyncDiff(diff: SyncDiff): boolean {
  return (
    diff.profileChanged ||
    diff.upsertFriends.length > 0 ||
    diff.deleteFriendIds.length > 0 ||
    diff.upsertTemplates.length > 0 ||
    diff.deleteTemplateIds.length > 0 ||
    diff.upsertSessions.length > 0 ||
    diff.deleteSessionIds.length > 0
  );
}

function hasPaymentCredentials(p?: PaymentProfile | null): boolean {
  if (!p) return false;
  return Boolean(
    (p.promptPayId && p.promptPayId.trim()) ||
      p.customQrImageDataUrl ||
      (p.accountNumber && p.accountNumber.trim()),
  );
}

export function mergeCloudAndLocalState(
  local: AppState,
  cloud: Partial<AppState> | null,
): { merged: AppState; needsUpload: boolean } {
  if (!cloud) {
    return {
      merged: normalizeAppState(local),
      needsUpload: true,
    };
  }

  const normalizedCloud = normalizeAppState(cloud);
  const normalizedLocal = normalizeAppState(local);
  let needsUpload = false;

  // 1. Seeded built-in template IDs = union
  const seededSet = new Set<string>([
    ...(normalizedCloud.seededBuiltInTemplateIds ?? []),
    ...(normalizedLocal.seededBuiltInTemplateIds ?? []),
  ]);

  // 2. Profile + paymentProfile
  let paymentProfile = normalizedCloud.paymentProfile;
  if (
    !hasPaymentCredentials(normalizedCloud.paymentProfile) &&
    hasPaymentCredentials(normalizedLocal.paymentProfile)
  ) {
    paymentProfile = normalizedLocal.paymentProfile;
    needsUpload = true;
  }

  let myName = normalizedCloud.myName;
  if ((!myName || myName === 'ฉัน') && normalizedLocal.myName !== 'ฉัน') {
    myName = normalizedLocal.myName;
    needsUpload = true;
  }

  let myAvatarDataUrl = normalizedCloud.myAvatarDataUrl ?? null;
  if (!myAvatarDataUrl && normalizedLocal.myAvatarDataUrl) {
    myAvatarDataUrl = normalizedLocal.myAvatarDataUrl;
    needsUpload = true;
  }

  // 3. Friends union by ID (Cloud wins on existing IDs; local-only uploaded)
  const friendMap = new Map<string, Friend>();
  for (const f of normalizedCloud.friends) {
    friendMap.set(f.id, f);
  }
  for (const f of normalizedLocal.friends) {
    if (!friendMap.has(f.id)) {
      friendMap.set(f.id, f);
      needsUpload = true;
    }
  }

  // 4. Shop templates union by ID, deduplicating by case-insensitive name
  const templateById = new Map<string, ShopTemplate>();
  const seenTemplateNames = new Map<string, string>(); // lowerName -> templateId

  const addTemplateCandidate = (tpl: ShopTemplate, isFromLocal: boolean) => {
    const nameKey = tpl.name.trim().toLowerCase();
    const existingById = templateById.get(tpl.id);
    if (existingById) {
      if ((tpl.lastUsedAt || '') > (existingById.lastUsedAt || '')) {
        templateById.set(tpl.id, tpl);
        if (isFromLocal) needsUpload = true;
      }
      return;
    }

    const existingIdForName = seenTemplateNames.get(nameKey);
    if (existingIdForName) {
      const existingByName = templateById.get(existingIdForName)!;
      if ((tpl.lastUsedAt || '') > (existingByName.lastUsedAt || '')) {
        templateById.delete(existingIdForName);
        templateById.set(tpl.id, tpl);
        seenTemplateNames.set(nameKey, tpl.id);
        if (isFromLocal) needsUpload = true;
      }
      return;
    }

    // Respect Cloud deliberate deletion of built-in template if cloud had seeded it
    const cloudHadSeeded = Boolean(
      cloud.seededBuiltInTemplateIds?.includes(tpl.id),
    );
    const cloudHasTpl = Boolean(cloud.shopTemplates?.some((t) => t.id === tpl.id));
    if (isFromLocal && cloudHadSeeded && !cloudHasTpl) {
      return;
    }

    templateById.set(tpl.id, tpl);
    seenTemplateNames.set(nameKey, tpl.id);
    if (isFromLocal) {
      needsUpload = true;
    }
  };

  for (const t of normalizedCloud.shopTemplates ?? []) {
    addTemplateCandidate(t, false);
  }
  for (const t of normalizedLocal.shopTemplates ?? []) {
    addTemplateCandidate(t, true);
  }

  // 5. Sessions union by ID (newer updatedAt wins on conflict)
  const sessionMap = new Map<string, DailySession>();
  for (const s of normalizedCloud.sessions) {
    sessionMap.set(s.id, s);
  }
  for (const s of normalizedLocal.sessions) {
    const existing = sessionMap.get(s.id);
    if (!existing) {
      sessionMap.set(s.id, s);
      needsUpload = true;
    } else if ((s.updatedAt || '') > (existing.updatedAt || '')) {
      sessionMap.set(s.id, s);
      needsUpload = true;
    }
  }

  const mergedSessions = Array.from(sessionMap.values()).sort((a, b) => {
    const dateDiff = (b.date || '').localeCompare(a.date || '');
    if (dateDiff !== 0) return dateDiff;
    return (b.updatedAt || '').localeCompare(a.updatedAt || '');
  });

  const activeSessionId =
    normalizedLocal.activeSessionId &&
    mergedSessions.some((s) => s.id === normalizedLocal.activeSessionId)
      ? normalizedLocal.activeSessionId
      : null;

  return {
    merged: {
      version: 1,
      myName,
      myAvatarDataUrl,
      friends: Array.from(friendMap.values()),
      paymentProfile,
      sessions: mergedSessions,
      activeSessionId,
      shopTemplates: Array.from(templateById.values()),
      seededBuiltInTemplateIds: Array.from(seededSet),
    },
    needsUpload,
  };
}

function mapDocToFriend(data: DocumentData): Friend | null {
  if (!data || typeof data.id !== 'string' || typeof data.name !== 'string') {
    return null;
  }
  return {
    id: data.id,
    name: data.name,
    color: typeof data.color === 'string' ? data.color : 'sky',
    avatarDataUrl:
      typeof data.avatarDataUrl === 'string' ? data.avatarDataUrl : null,
    isDefaultGroup: Boolean(data.isDefaultGroup),
    note: typeof data.note === 'string' && data.note ? data.note : undefined,
  };
}

function mapDocToTemplate(data: DocumentData): ShopTemplate | null {
  if (!data || typeof data.id !== 'string' || typeof data.name !== 'string') {
    return null;
  }
  const category = VALID_CATEGORIES.has(data.category as ReceiptCategory)
    ? (data.category as ReceiptCategory)
    : 'restaurant';
  return {
    id: data.id,
    name: data.name,
    category,
    serviceChargeRate:
      typeof data.serviceChargeRate === 'number' ? data.serviceChargeRate : 0,
    vatRate: typeof data.vatRate === 'number' ? data.vatRate : 0,
    vatOnServiceCharge: Boolean(data.vatOnServiceCharge),
    plateTiers: Array.isArray(data.plateTiers) ? data.plateTiers : undefined,
    isPinned: Boolean(data.isPinned),
    lastUsedAt:
      typeof data.lastUsedAt === 'string'
        ? data.lastUsedAt
        : new Date().toISOString(),
  };
}

function mapDocToSession(data: DocumentData): DailySession | null {
  if (
    !data ||
    typeof data.id !== 'string' ||
    !Array.isArray(data.receipts)
  ) {
    return null;
  }
  return {
    id: data.id,
    date: typeof data.date === 'string' ? data.date : '',
    title: typeof data.title === 'string' ? data.title : 'มื้ออาหาร',
    includeMe: Boolean(data.includeMe),
    participantIds: Array.isArray(data.participantIds)
      ? data.participantIds
      : [],
    roundingMode: VALID_ROUNDING.has(data.roundingMode as RoundingMode)
      ? (data.roundingMode as RoundingMode)
      : 'exact',
    receipts: data.receipts,
    paidStatus:
      data.paidStatus && typeof data.paidStatus === 'object'
        ? data.paidStatus
        : {},
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
  };
}

export async function fetchUserCloudSnapshot(
  uid: string,
): Promise<Partial<AppState> | null> {
  const userRef = doc(db, 'users', uid);
  const [profileSnap, friendsSnap, templatesSnap, sessionsSnap] =
    await Promise.all([
      getDoc(userRef),
      getDocs(collection(db, 'users', uid, 'friends')),
      getDocs(collection(db, 'users', uid, 'shopTemplates')),
      getDocs(collection(db, 'users', uid, 'sessions')),
    ]);

  if (
    !profileSnap.exists() &&
    friendsSnap.empty &&
    templatesSnap.empty &&
    sessionsSnap.empty
  ) {
    return null;
  }

  const profileData = profileSnap.exists() ? profileSnap.data() : {};
  const friends = friendsSnap.docs
    .map((d) => mapDocToFriend(d.data()))
    .filter((f): f is Friend => f !== null);
  const shopTemplates = templatesSnap.docs
    .map((d) => mapDocToTemplate(d.data()))
    .filter((t): t is ShopTemplate => t !== null);
  const sessions = sessionsSnap.docs
    .map((d) => mapDocToSession(d.data()))
    .filter((s): s is DailySession => s !== null);

  return {
    version: 1,
    myName: typeof profileData.myName === 'string' ? profileData.myName : 'ฉัน',
    myAvatarDataUrl:
      typeof profileData.myAvatarDataUrl === 'string'
        ? profileData.myAvatarDataUrl
        : null,
    paymentProfile:
      profileData.paymentProfile &&
      typeof profileData.paymentProfile === 'object'
        ? {
            ...getDefaultPaymentProfile(),
            ...profileData.paymentProfile,
          }
        : getDefaultPaymentProfile(),
    seededBuiltInTemplateIds: Array.isArray(
      profileData.seededBuiltInTemplateIds,
    )
      ? profileData.seededBuiltInTemplateIds
      : [],
    friends,
    shopTemplates,
    sessions,
  };
}

type BatchOp = (batch: ReturnType<typeof writeBatch>) => void;

export async function pushSyncDiffToCloud(
  uid: string,
  diff: SyncDiff,
  state: AppState,
): Promise<void> {
  const nowIso = new Date().toISOString();
  const ops: BatchOp[] = [];

  if (diff.profileChanged) {
    const profileRef = doc(db, 'users', uid);
    const payload = toProfileDoc(state, nowIso);
    ops.push((batch) => batch.set(profileRef, payload));
  }

  for (const friend of diff.upsertFriends) {
    const ref = doc(db, 'users', uid, 'friends', friend.id);
    const payload = toFriendDoc(friend, nowIso);
    ops.push((batch) => batch.set(ref, payload));
  }
  for (const id of diff.deleteFriendIds) {
    const ref = doc(db, 'users', uid, 'friends', id);
    ops.push((batch) => batch.delete(ref));
  }

  for (const tpl of diff.upsertTemplates) {
    const ref = doc(db, 'users', uid, 'shopTemplates', tpl.id);
    const payload = toTemplateDoc(tpl, nowIso);
    ops.push((batch) => batch.set(ref, payload));
  }
  for (const id of diff.deleteTemplateIds) {
    const ref = doc(db, 'users', uid, 'shopTemplates', id);
    ops.push((batch) => batch.delete(ref));
  }

  for (const session of diff.upsertSessions) {
    const ref = doc(db, 'users', uid, 'sessions', session.id);
    const payload = toSessionDoc(session);
    ops.push((batch) => batch.set(ref, payload));
  }
  for (const id of diff.deleteSessionIds) {
    const ref = doc(db, 'users', uid, 'sessions', id);
    ops.push((batch) => batch.delete(ref));
  }

  const CHUNK_SIZE = 400;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    const chunk = ops.slice(i, i + CHUNK_SIZE);
    for (const op of chunk) {
      op(batch);
    }
    await batch.commit();
  }
}

export function subscribeUserCloudState(
  uid: string,
  onRemoteData: (cloudData: Partial<AppState>) => void,
  onError: (err: Error) => void,
): () => void {
  let readyProfile = false;
  let readyFriends = false;
  let readyTemplates = false;
  let readySessions = false;

  let latestProfile: DocumentData | null = null;
  let latestFriends: Friend[] = [];
  let latestTemplates: ShopTemplate[] = [];
  let latestSessions: DailySession[] = [];

  const emitIfReady = (fromServerOnly: boolean) => {
    if (
      !readyProfile ||
      !readyFriends ||
      !readyTemplates ||
      !readySessions
    ) {
      return;
    }
    if (!fromServerOnly) return;

    const pData = latestProfile ?? {};
    onRemoteData({
      version: 1,
      myName: typeof pData.myName === 'string' ? pData.myName : 'ฉัน',
      myAvatarDataUrl:
        typeof pData.myAvatarDataUrl === 'string'
          ? pData.myAvatarDataUrl
          : null,
      paymentProfile:
        pData.paymentProfile && typeof pData.paymentProfile === 'object'
          ? {
              ...getDefaultPaymentProfile(),
              ...pData.paymentProfile,
            }
          : getDefaultPaymentProfile(),
      seededBuiltInTemplateIds: Array.isArray(pData.seededBuiltInTemplateIds)
        ? pData.seededBuiltInTemplateIds
        : [],
      friends: latestFriends,
      shopTemplates: latestTemplates,
      sessions: latestSessions,
    });
  };

  const unsubProfile = onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      readyProfile = true;
      latestProfile = snap.exists() ? snap.data() : null;
      emitIfReady(!snap.metadata.hasPendingWrites);
    },
    (err) => onError(err),
  );

  const unsubFriends = onSnapshot(
    collection(db, 'users', uid, 'friends'),
    (snap) => {
      readyFriends = true;
      latestFriends = snap.docs
        .map((d) => mapDocToFriend(d.data()))
        .filter((f): f is Friend => f !== null);
      emitIfReady(!snap.metadata.hasPendingWrites);
    },
    (err) => onError(err),
  );

  const unsubTemplates = onSnapshot(
    collection(db, 'users', uid, 'shopTemplates'),
    (snap) => {
      readyTemplates = true;
      latestTemplates = snap.docs
        .map((d) => mapDocToTemplate(d.data()))
        .filter((t): t is ShopTemplate => t !== null);
      emitIfReady(!snap.metadata.hasPendingWrites);
    },
    (err) => onError(err),
  );

  const unsubSessions = onSnapshot(
    collection(db, 'users', uid, 'sessions'),
    (snap) => {
      readySessions = true;
      latestSessions = snap.docs
        .map((d) => mapDocToSession(d.data()))
        .filter((s): s is DailySession => s !== null);
      emitIfReady(!snap.metadata.hasPendingWrites);
    },
    (err) => onError(err),
  );

  return () => {
    unsubProfile();
    unsubFriends();
    unsubTemplates();
    unsubSessions();
  };
}
