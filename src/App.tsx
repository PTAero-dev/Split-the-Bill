import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { CheckCircle2 } from 'lucide-react';
import { AppHeader, TopTab } from './components/AppHeader';
import {
  CloudSyncButton,
  type CloudSyncStateView,
  type CloudSyncStatus,
} from './components/CloudSyncButton';
import { FriendsManager } from './components/FriendsManager';
import { PaymentProfileView } from './components/PaymentProfileView';
import { SessionListView } from './components/SessionListView';
import { SessionWorkspace } from './components/SessionWorkspace';
import {
  buildSyncFingerprint,
  computeSyncDiff,
  fetchUserCloudSnapshot,
  hasAnySyncDiff,
  mergeCloudAndLocalState,
  pushSyncDiffToCloud,
  subscribeUserCloudState,
  type SyncFingerprint,
} from './lib/cloudSync';
import {
  auth,
  consumeRedirectSignIn,
  signInWithGoogleAccount,
  signOutFromCloud,
} from './lib/firebase';
import { createId, todayIsoDate } from './lib/format';
import { normalizePromptPayTarget } from './lib/promptpay';
import {
  createDemoData,
  createEmptyReceipt,
  loadAppState,
  normalizeAppState,
  saveAppState,
} from './lib/storage';
import {
  AppState,
  DailySession,
  Friend,
  ME_ID,
  Receipt,
  ShopTemplate,
} from './types';

export function App() {
  const [state, setState] = useState<AppState>(() => loadAppState());
  const [activeTab, setActiveTab] = useState<TopTab>('sessions');
  const [toast, setToast] = useState<string | null>(null);

  const [cloudUser, setCloudUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>(() =>
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'idle',
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const latestStateRef = useRef(state);
  latestStateRef.current = state;

  const lastSyncedFpRef = useRef<SyncFingerprint | null>(null);
  const initialSyncDoneUidRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const res = saveAppState(state);
    if (!res.ok && res.error) {
      setToast(`คำเตือนการบันทึก: ${res.error}`);
    }
  }, [state]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  // Firebase Auth listener + handle redirect sign-in result if popup was blocked
  useEffect(() => {
    consumeRedirectSignIn().catch((err: unknown) => {
      const msg =
        err instanceof Error ? err.message : 'เข้าสู่ระบบ Google ไม่สำเร็จ';
      setSyncError(msg);
      setToast(msg);
    });

    const unsub = onAuthStateChanged(auth, (user) => {
      setCloudUser(user);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  // Network connectivity listener
  useEffect(() => {
    const handleOffline = () => {
      setSyncStatus('offline');
    };
    const handleOnline = async () => {
      const uid = cloudUser?.uid;
      if (!uid || initialSyncDoneUidRef.current !== uid) {
        setSyncStatus('idle');
        return;
      }
      const current = latestStateRef.current;
      const diff = computeSyncDiff(lastSyncedFpRef.current, current);
      if (!hasAnySyncDiff(diff)) {
        setSyncStatus('synced');
        return;
      }
      try {
        setSyncStatus('syncing');
        setSyncError(null);
        await pushSyncDiffToCloud(uid, diff, current);
        lastSyncedFpRef.current = buildSyncFingerprint(current);
        setSyncStatus('synced');
        setLastSyncedAt(new Date().toISOString());
      } catch (err) {
        setSyncStatus('error');
        setSyncError(
          err instanceof Error ? err.message : 'ซิงค์ข้อมูลไม่สำเร็จ',
        );
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [cloudUser?.uid]);

  // Initial fetch/merge + real-time Firestore subscription when signed in
  useEffect(() => {
    const uid = cloudUser?.uid;
    if (!uid) {
      initialSyncDoneUidRef.current = null;
      lastSyncedFpRef.current = null;
      setSyncStatus(
        typeof navigator !== 'undefined' && !navigator.onLine
          ? 'offline'
          : 'idle',
      );
      setSyncError(null);
      return;
    }

    let cancelled = false;
    let unsubRemote: (() => void) | null = null;

    const initCloudSync = async () => {
      setSyncStatus('syncing');
      setSyncError(null);

      try {
        const cloudSnapshot = await fetchUserCloudSnapshot(uid);
        if (cancelled) return;

        const { merged, needsUpload } = mergeCloudAndLocalState(
          latestStateRef.current,
          cloudSnapshot,
        );

        if (needsUpload) {
          const baselineFp = cloudSnapshot
            ? buildSyncFingerprint(normalizeAppState(cloudSnapshot))
            : null;
          const uploadDiff = computeSyncDiff(baselineFp, merged);
          if (hasAnySyncDiff(uploadDiff)) {
            await pushSyncDiffToCloud(uid, uploadDiff, merged);
          }
        }
        if (cancelled) return;

        lastSyncedFpRef.current = buildSyncFingerprint(merged);
        initialSyncDoneUidRef.current = uid;
        setState(merged);
        setLastSyncedAt(new Date().toISOString());
        setSyncStatus(
          typeof navigator !== 'undefined' && !navigator.onLine
            ? 'offline'
            : 'synced',
        );

        unsubRemote = subscribeUserCloudState(
          uid,
          (remotePartial) => {
            if (cancelled) return;
            const currentLocal = latestStateRef.current;
            const remoteNormalized = normalizeAppState({
              ...remotePartial,
              seededBuiltInTemplateIds: Array.from(
                new Set([
                  ...(remotePartial.seededBuiltInTemplateIds ?? []),
                  ...(currentLocal.seededBuiltInTemplateIds ?? []),
                ]),
              ),
              activeSessionId: currentLocal.activeSessionId,
            });

            const remoteDiff = computeSyncDiff(
              lastSyncedFpRef.current,
              remoteNormalized,
            );
            if (!hasAnySyncDiff(remoteDiff)) {
              return;
            }

            lastSyncedFpRef.current = buildSyncFingerprint(remoteNormalized);
            setState(remoteNormalized);
            setLastSyncedAt(new Date().toISOString());
            setSyncStatus('synced');
            setSyncError(null);
          },
          (err) => {
            if (cancelled) return;
            setSyncStatus('error');
            setSyncError(err.message);
          },
        );
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof Error
            ? err.message
            : 'ไม่สามารถเชื่อมต่อฐานข้อมูล Firebase ได้';
        setSyncStatus(
          typeof navigator !== 'undefined' && !navigator.onLine
            ? 'offline'
            : 'error',
        );
        setSyncError(msg);
      }
    };

    void initCloudSync();

    return () => {
      cancelled = true;
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (unsubRemote) unsubRemote();
    };
  }, [cloudUser?.uid]);

  // Debounced auto-push on local state changes while signed in
  useEffect(() => {
    const uid = cloudUser?.uid;
    if (!uid || initialSyncDoneUidRef.current !== uid) return;

    const diff = computeSyncDiff(lastSyncedFpRef.current, state);
    if (!hasAnySyncDiff(diff)) return;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSyncStatus('offline');
      return;
    }

    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }

    const stateSnapshot = state;
    debounceTimerRef.current = window.setTimeout(async () => {
      debounceTimerRef.current = null;
      if (initialSyncDoneUidRef.current !== uid) return;
      const latestDiff = computeSyncDiff(lastSyncedFpRef.current, stateSnapshot);
      if (!hasAnySyncDiff(latestDiff)) return;

      try {
        setSyncStatus('syncing');
        setSyncError(null);
        await pushSyncDiffToCloud(uid, latestDiff, stateSnapshot);
        lastSyncedFpRef.current = buildSyncFingerprint(stateSnapshot);
        setLastSyncedAt(new Date().toISOString());
        setSyncStatus('synced');
      } catch (err) {
        setSyncStatus(
          typeof navigator !== 'undefined' && !navigator.onLine
            ? 'offline'
            : 'error',
        );
        setSyncError(
          err instanceof Error ? err.message : 'ไม่สามารถบันทึกขึ้นคลาวด์ได้',
        );
      }
    }, 700);

    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [state, cloudUser?.uid]);

  const handleCloudSignIn = useCallback(async () => {
    setSyncError(null);
    try {
      await signInWithGoogleAccount();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'เข้าสู่ระบบ Google ไม่สำเร็จ';
      setSyncError(msg);
      setToast(msg);
    }
  }, []);

  const handleCloudSyncNow = useCallback(async () => {
    const uid = cloudUser?.uid;
    if (!uid) return;
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setSyncStatus('syncing');
    setSyncError(null);
    try {
      const localSnapshot = latestStateRef.current;
      const pendingDiff = computeSyncDiff(
        lastSyncedFpRef.current,
        localSnapshot,
      );
      if (hasAnySyncDiff(pendingDiff)) {
        await pushSyncDiffToCloud(uid, pendingDiff, localSnapshot);
      }

      const cloudSnapshot = await fetchUserCloudSnapshot(uid);
      const { merged, needsUpload } = mergeCloudAndLocalState(
        latestStateRef.current,
        cloudSnapshot,
      );
      if (needsUpload) {
        const baselineFp = cloudSnapshot
          ? buildSyncFingerprint(normalizeAppState(cloudSnapshot))
          : null;
        const mergeDiff = computeSyncDiff(baselineFp, merged);
        if (hasAnySyncDiff(mergeDiff)) {
          await pushSyncDiffToCloud(uid, mergeDiff, merged);
        }
      }

      lastSyncedFpRef.current = buildSyncFingerprint(merged);
      initialSyncDoneUidRef.current = uid;
      setState(merged);
      setLastSyncedAt(new Date().toISOString());
      setSyncStatus('synced');
      setToast('ซิงค์ข้อมูลกับคลาวด์เรียบร้อยแล้ว');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'ซิงค์ข้อมูลไม่สำเร็จ';
      setSyncStatus(
        typeof navigator !== 'undefined' && !navigator.onLine
          ? 'offline'
          : 'error',
      );
      setSyncError(msg);
      setToast(msg);
    }
  }, [cloudUser?.uid]);

  const handleCloudSignOut = useCallback(async () => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const uid = cloudUser?.uid;
    if (uid && initialSyncDoneUidRef.current === uid) {
      const current = latestStateRef.current;
      const diff = computeSyncDiff(lastSyncedFpRef.current, current);
      if (hasAnySyncDiff(diff)) {
        try {
          await pushSyncDiffToCloud(uid, diff, current);
        } catch {
          // Proceed with sign-out gracefully even if offline
        }
      }
    }

    initialSyncDoneUidRef.current = null;
    lastSyncedFpRef.current = null;
    await signOutFromCloud();
    setSyncStatus(
      typeof navigator !== 'undefined' && !navigator.onLine
        ? 'offline'
        : 'idle',
    );
    setSyncError(null);
    setToast('ออกจากระบบแล้ว (ข้อมูลในเครื่องยังอยู่ครบ)');
  }, [cloudUser?.uid]);

  const cloudSyncState: CloudSyncStateView = {
    user: cloudUser,
    authLoading,
    syncStatus,
    lastSyncedAt,
    syncError,
    counts: {
      friends: state.friends.length,
      templates: (state.shopTemplates ?? []).length,
      sessions: state.sessions.length,
    },
    onSignIn: handleCloudSignIn,
    onSignOut: handleCloudSignOut,
    onSyncNow: handleCloudSyncNow,
  };

  const notify = (message: string) => setToast(message);

  const activeSession =
    state.activeSessionId
      ? state.sessions.find((s) => s.id === state.activeSessionId) ?? null
      : null;

  const hasPaymentReady =
    Boolean(normalizePromptPayTarget(state.paymentProfile.promptPayId)) ||
    Boolean(state.paymentProfile.customQrImageDataUrl);

  const handleCreateSession = () => {
    const defaultFriends = state.friends.filter((f) => f.isDefaultGroup);
    const initialParticipants = (
      defaultFriends.length > 0 ? defaultFriends : state.friends
    ).map((f) => f.id);
    const attendees = [ME_ID, ...initialParticipants];
    const nowIso = new Date().toISOString();
    const newSession: DailySession = {
      id: createId('ses'),
      date: todayIsoDate(),
      title: `มื้ออาหาร ${new Date().toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
      })}`,
      includeMe: true,
      participantIds: initialParticipants,
      roundingMode: 'exact',
      receipts: [createEmptyReceipt(attendees, ME_ID, 1)],
      paidStatus: {},
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    setState((prev) => ({
      ...prev,
      sessions: [newSession, ...prev.sessions],
      activeSessionId: newSession.id,
    }));
    setActiveTab('sessions');
  };

  const handleLoadDemo = () => {
    const demo = createDemoData();
    setState((prev) => ({
      ...prev,
      friends: [...demo.friends, ...prev.friends],
      sessions: [demo.session, ...prev.sessions],
      activeSessionId: demo.session.id,
    }));
    setActiveTab('sessions');
    notify('โหลดบิลตัวอย่าง 3 ร้าน (ร้านอาหาร + คาเฟ่ + ซูเปอร์ฯ) แล้ว');
  };

  const handleOpenSession = (sessionId: string) => {
    setState((prev) => ({ ...prev, activeSessionId: sessionId }));
    setActiveTab('sessions');
  };

  const handleDuplicateSession = (sessionId: string) => {
    const target = state.sessions.find((s) => s.id === sessionId);
    if (!target) return;
    const nowIso = new Date().toISOString();
    const copy: DailySession = {
      ...target,
      id: createId('ses'),
      date: todayIsoDate(),
      title: `${target.title} (สำเนา)`,
      paidStatus: {},
      receipts: target.receipts.map((r) => ({
        ...r,
        id: createId('rcpt'),
        items: r.items.map((it) => ({
          ...it,
          id: createId('item'),
          shares: it.shares.map((s) => ({ ...s })),
        })),
        plateTiers: r.plateTiers ? r.plateTiers.map((t) => ({ ...t })) : undefined,
        plateCounts: r.plateCounts
          ? Object.fromEntries(
              Object.entries(r.plateCounts).map(([pid, counts]) => [
                pid,
                { ...counts },
              ]),
            )
          : undefined,
      })),
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    setState((prev) => ({
      ...prev,
      sessions: [copy, ...prev.sessions],
      activeSessionId: copy.id,
    }));
    notify('สร้างสำเนาบิลเรียบร้อย');
  };

  const handleDeleteSession = (sessionId: string) => {
    setState((prev) => ({
      ...prev,
      sessions: prev.sessions.filter((s) => s.id !== sessionId),
      activeSessionId:
        prev.activeSessionId === sessionId ? null : prev.activeSessionId,
    }));
    notify('ลบบิลเรียบร้อยแล้ว');
  };

  const handleUpdateActiveSession = (
    updater: (prev: DailySession) => DailySession,
  ) => {
    setState((prev) => {
      if (!prev.activeSessionId) return prev;
      return {
        ...prev,
        sessions: prev.sessions.map((s) =>
          s.id === prev.activeSessionId
            ? { ...updater(s), updatedAt: new Date().toISOString() }
            : s,
        ),
      };
    });
  };

  const handleAddFriendAndSelect = (friend: Friend) => {
    setState((prev) => {
      const nextSessions = prev.activeSessionId
        ? prev.sessions.map((s) =>
            s.id === prev.activeSessionId
              ? {
                  ...s,
                  participantIds: [...s.participantIds, friend.id],
                  receipts: s.receipts.map((r) => ({
                    ...r,
                    attendeeIds: [...r.attendeeIds, friend.id],
                  })),
                  updatedAt: new Date().toISOString(),
                }
              : s,
          )
        : prev.sessions;
      return {
        ...prev,
        friends: [...prev.friends, friend],
        sessions: nextSessions,
      };
    });
    notify(`เพิ่ม "${friend.name}" เข้ากลุ่มเพื่อนและบิลวันนี้แล้ว`);
  };

  const handleSaveShopTemplate = (receipt: Receipt) => {
    const cleanName = receipt.shopName.trim() || 'ร้านประจำ';
    const nowIso = new Date().toISOString();
    const clonedTiers =
      receipt.category === 'sushi' && receipt.plateTiers
        ? receipt.plateTiers.map((t) => ({ ...t }))
        : undefined;

    let isUpdating = false;
    setState((prev) => {
      const existing = prev.shopTemplates ?? [];
      const matchIdx = existing.findIndex(
        (t) => t.name.trim().toLowerCase() === cleanName.toLowerCase(),
      );

      if (matchIdx >= 0) {
        isUpdating = true;
        const updated = existing.map((t, idx) =>
          idx === matchIdx
            ? {
                ...t,
                name: cleanName,
                category: receipt.category,
                serviceChargeRate: receipt.serviceChargeRate,
                vatRate: receipt.vatRate,
                vatOnServiceCharge: receipt.vatOnServiceCharge,
                plateTiers: clonedTiers,
                lastUsedAt: nowIso,
              }
            : t,
        );
        return { ...prev, shopTemplates: updated };
      }

      const newTemplate: ShopTemplate = {
        id: createId('tpl'),
        name: cleanName,
        category: receipt.category,
        serviceChargeRate: receipt.serviceChargeRate,
        vatRate: receipt.vatRate,
        vatOnServiceCharge: receipt.vatOnServiceCharge,
        plateTiers: clonedTiers,
        isPinned: false,
        lastUsedAt: nowIso,
      };
      return {
        ...prev,
        shopTemplates: [newTemplate, ...existing],
      };
    });

    notify(
      isUpdating
        ? `อัปเดตเทมเพลตร้าน "${cleanName}" แล้ว`
        : `บันทึกเทมเพลตร้าน "${cleanName}" ไว้ใช้ครั้งหน้าแล้ว`,
    );
  };

  const handleUpdateShopTemplate = (updated: ShopTemplate) => {
    setState((prev) => ({
      ...prev,
      shopTemplates: (prev.shopTemplates ?? []).map((t) =>
        t.id === updated.id ? updated : t,
      ),
    }));
  };

  const handleDeleteShopTemplate = (templateId: string) => {
    setState((prev) => ({
      ...prev,
      shopTemplates: (prev.shopTemplates ?? []).filter(
        (t) => t.id !== templateId,
      ),
    }));
    notify('ลบเทมเพลตร้านประจำแล้ว');
  };

  const handleMarkTemplateUsed = (templateId: string) => {
    const nowIso = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      shopTemplates: (prev.shopTemplates ?? []).map((t) =>
        t.id === templateId ? { ...t, lastUsedAt: nowIso } : t,
      ),
    }));
  };

  return (
    <div className="obsidian-bg min-h-dvh text-slate-100">
      <AppHeader
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        friendsCount={state.friends.length}
        sessionsCount={state.sessions.length}
        hasPaymentReady={hasPaymentReady}
        cloudSyncSlot={<CloudSyncButton {...cloudSyncState} />}
      />

      {/* Non-blocking transient toast pill at top-center (pointer-events-none) */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed top-4 left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2"
        >
          <div className="flex items-center gap-2 rounded-xl border border-teal-400/35 bg-[#131C31] px-4 py-3 text-sm font-medium text-white shadow-xl shadow-black/40">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-400" />
            <span className="min-w-0 break-words">{toast}</span>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {activeTab === 'sessions' &&
          (activeSession ? (
            <SessionWorkspace
              session={activeSession}
              friends={state.friends}
              myName={state.myName}
              myColor={state.myColor ?? 'teal'}
              myAvatarDataUrl={state.myAvatarDataUrl}
              paymentProfile={state.paymentProfile}
              shopTemplates={state.shopTemplates ?? []}
              onBackToList={() =>
                setState((prev) => ({ ...prev, activeSessionId: null }))
              }
              onUpdateSession={handleUpdateActiveSession}
              onAddFriendAndSelect={handleAddFriendAndSelect}
              onSaveShopTemplate={handleSaveShopTemplate}
              onUpdateShopTemplate={handleUpdateShopTemplate}
              onDeleteShopTemplate={handleDeleteShopTemplate}
              onMarkTemplateUsed={handleMarkTemplateUsed}
              onGoToPaymentSettings={() => setActiveTab('payment')}
              onNotify={notify}
            />
          ) : (
            <SessionListView
              sessions={state.sessions}
              friends={state.friends}
              myName={state.myName}
              myColor={state.myColor ?? 'teal'}
              myAvatarDataUrl={state.myAvatarDataUrl}
              onCreateSession={handleCreateSession}
              onLoadDemo={handleLoadDemo}
              onOpenSession={handleOpenSession}
              onDuplicateSession={handleDuplicateSession}
              onDeleteSession={handleDeleteSession}
            />
          ))}

        {activeTab === 'friends' && (
          <FriendsManager
            myName={state.myName}
            myColor={state.myColor ?? 'teal'}
            myAvatarDataUrl={state.myAvatarDataUrl}
            onChangeMyName={(myName) =>
              setState((prev) => ({ ...prev, myName }))
            }
            onChangeMyColor={(myColor) =>
              setState((prev) => ({ ...prev, myColor }))
            }
            onChangeMyAvatar={(myAvatarDataUrl) =>
              setState((prev) => ({ ...prev, myAvatarDataUrl }))
            }
            friends={state.friends}
            onAddFriend={(friend) => {
              setState((prev) => ({
                ...prev,
                friends: [...prev.friends, friend],
              }));
              notify(`เพิ่ม "${friend.name}" เข้ากลุ่มเพื่อนแล้ว`);
            }}
            onUpdateFriend={(updated) => {
              setState((prev) => ({
                ...prev,
                friends: prev.friends.map((f) =>
                  f.id === updated.id ? updated : f,
                ),
              }));
              notify('บันทึกการแก้ไขรายชื่อและรูปโปรไฟล์แล้ว');
            }}
            onDeleteFriend={(friendId) => {
              setState((prev) => ({
                ...prev,
                friends: prev.friends.filter((f) => f.id !== friendId),
              }));
              notify('ลบรายชื่อเพื่อนแล้ว');
            }}
            onNotify={notify}
          />
        )}

        {activeTab === 'payment' && (
          <PaymentProfileView
            profile={state.paymentProfile}
            onChangeProfile={(paymentProfile) =>
              setState((prev) => ({ ...prev, paymentProfile }))
            }
            appState={state}
            onRestoreBackup={(restored) => {
              setState(restored);
              setActiveTab('sessions');
            }}
            onNotify={notify}
            cloudSync={cloudSyncState}
          />
        )}
      </main>
    </div>
  );
}

export default App;
