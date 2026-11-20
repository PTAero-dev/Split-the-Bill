import { type ReactNode } from 'react';
import { QrCode, ReceiptText, Users } from 'lucide-react';
import { InstallAppButton } from './InstallAppButton';

export type TopTab = 'sessions' | 'friends' | 'payment';

interface AppHeaderProps {
  activeTab: TopTab;
  onSelectTab: (tab: TopTab) => void;
  friendsCount: number;
  sessionsCount: number;
  hasPaymentReady: boolean;
  cloudSyncSlot?: ReactNode;
}

export function AppHeader({
  activeTab,
  onSelectTab,
  friendsCount,
  sessionsCount,
  hasPaymentReady,
  cloudSyncSlot,
}: AppHeaderProps) {
  const navItems: Array<{
    id: TopTab;
    label: string;
    badge?: string;
    icon: typeof ReceiptText;
  }> = [
    {
      id: 'sessions',
      label: 'บิลรายวัน',
      badge: sessionsCount > 0 ? String(sessionsCount) : undefined,
      icon: ReceiptText,
    },
    {
      id: 'friends',
      label: 'กลุ่มเพื่อน',
      badge: friendsCount > 0 ? String(friendsCount) : undefined,
      icon: Users,
    },
    {
      id: 'payment',
      label: 'บัญชี & QR',
      badge: hasPaymentReady ? 'พร้อม' : undefined,
      icon: QrCode,
    },
  ];

  return (
    <header className="border-b border-slate-800/90 bg-[#0F172A]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src="/icon-192.png"
            alt="โลโก้แอปหารบิล"
            className="h-10 w-10 shrink-0 rounded-xl border border-teal-400/30 shadow-sm shadow-teal-500/20"
          />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold tracking-tight text-white">
              หารบิล
            </h1>
            <p className="truncate text-xs text-slate-400">
              ร้านอาหาร • ซูชิสายพาน • คาเฟ่ • ซูเปอร์มาร์เก็ต • พร้อมเพย์ QR
            </p>
          </div>
        </div>

        <nav
          aria-label="เมนูหลัก"
          className="flex flex-wrap items-center gap-2"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-all ${
                  isActive
                    ? 'border-teal-400 bg-teal-500 text-slate-950 shadow-sm shadow-teal-500/20'
                    : 'border-slate-800 bg-[#131C31] text-slate-300 hover:border-slate-700 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">{item.label}</span>
                {item.badge && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      isActive
                        ? 'bg-slate-950/20 text-slate-950'
                        : 'bg-[#0B1120] text-teal-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <InstallAppButton />
          {cloudSyncSlot}
        </nav>
      </div>
    </header>
  );
}
