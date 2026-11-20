import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { AppHeader, TopTab } from './components/AppHeader';
import { FriendsManager } from './components/FriendsManager';
import { PaymentProfileView } from './components/PaymentProfileView';
import { SessionListView } from './components/SessionListView';
import { SessionWorkspace } from './components/SessionWorkspace';
import { createId, todayIsoDate } from './lib/format';
import { normalizePromptPayTarget } from './lib/promptpay';
import {
  createDemoData,
  createEmptyReceipt,
  loadAppState,
  saveAppState,
} from './lib/storage';
import { AppState, DailySession, Friend, ME_ID } from './types';

export function App() {
  const [state, setState] = useState<AppState>(() => loadAppState());
  const [activeTab, setActiveTab] = useState<TopTab>('sessions');
  const [toast, setToast] = useState<string | null>(null);

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

  return (
    <div className="obsidian-bg min-h-dvh text-slate-100">
      <AppHeader
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        friendsCount={state.friends.length}
        sessionsCount={state.sessions.length}
        hasPaymentReady={hasPaymentReady}
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
              myAvatarDataUrl={state.myAvatarDataUrl}
              paymentProfile={state.paymentProfile}
              onBackToList={() =>
                setState((prev) => ({ ...prev, activeSessionId: null }))
              }
              onUpdateSession={handleUpdateActiveSession}
              onAddFriendAndSelect={handleAddFriendAndSelect}
              onGoToPaymentSettings={() => setActiveTab('payment')}
              onNotify={notify}
            />
          ) : (
            <SessionListView
              sessions={state.sessions}
              friends={state.friends}
              myName={state.myName}
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
            myAvatarDataUrl={state.myAvatarDataUrl}
            onChangeMyName={(myName) =>
              setState((prev) => ({ ...prev, myName }))
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
          />
        )}
      </main>
    </div>
  );
}

export default App;
