import { useEffect, useState } from 'react';
import { Download, MoreVertical, PlusSquare, Share, Smartphone, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    nav.standalone === true
  );
}

export function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() =>
    isStandaloneMode(),
  );
  const [showGuideModal, setShowGuideModal] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowGuideModal(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  if (isInstalled) return null;

  const handleClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
        }
        setDeferredPrompt(null);
        return;
      } catch {
        // Fallback to manual install guide modal
      }
    }
    setShowGuideModal(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-teal-400/40 bg-teal-500/15 px-3.5 py-2 text-sm font-semibold text-teal-200 transition-colors hover:bg-teal-500/25"
      >
        <Download className="h-4 w-4 shrink-0" />
        <span className="whitespace-nowrap">ติดตั้งแอป</span>
      </button>

      {showGuideModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-pwa-title"
          onClick={() => setShowGuideModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-5"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#131C31] shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <img
                  src="/icon-192.png"
                  alt="ไอคอนแอปหารบิล"
                  className="h-11 w-11 shrink-0 rounded-2xl border border-teal-400/30 shadow-md"
                />
                <div className="min-w-0">
                  <h2
                    id="install-pwa-title"
                    className="truncate text-lg font-bold text-white"
                  >
                    ติดตั้งแอป &ldquo;หารบิล&rdquo; ลงหน้าจอมือถือ
                  </h2>
                  <p className="text-xs text-slate-400">
                    เปิดใช้งานเต็มจอเหมือนแอปแท้ พร้อมไอคอนบนหน้า Home
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="ปิดหน้าต่าง"
                className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-[#0D1526] text-slate-300 hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5 text-sm">
              {/* iOS Safari */}
              <div className="rounded-xl border border-slate-700 bg-[#0D1526] p-4">
                <div className="flex items-center gap-2 font-bold text-teal-300">
                  <Smartphone className="h-4 w-4" />
                  <span>iPhone / iPad (เปิดด้วย Safari)</span>
                </div>
                <ol className="mt-2.5 space-y-2 text-xs text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-500/20 font-bold text-teal-300">
                      1
                    </span>
                    <span className="flex flex-wrap items-center gap-1">
                      แตะปุ่ม <strong className="text-white">แชร์ (Share)</strong>{' '}
                      <Share className="inline h-3.5 w-3.5 text-teal-300" /> ที่แถบด้านล่างหรือมุมขวาบนของ Safari
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-500/20 font-bold text-teal-300">
                      2
                    </span>
                    <span className="flex flex-wrap items-center gap-1">
                      เลื่อนลงแล้วเลือก <strong className="text-white">เพิ่มไปยังหน้าจอโฮม (Add to Home Screen)</strong>{' '}
                      <PlusSquare className="inline h-3.5 w-3.5 text-teal-300" />
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-500/20 font-bold text-teal-300">
                      3
                    </span>
                    <span>
                      กด <strong className="text-white">เพิ่ม (Add)</strong> มุมขวาบน ไอคอนแอปจะปรากฏบนหน้าจอทันที
                    </span>
                  </li>
                </ol>
              </div>

              {/* Android Chrome */}
              <div className="rounded-xl border border-slate-700 bg-[#0D1526] p-4">
                <div className="flex items-center gap-2 font-bold text-emerald-300">
                  <Smartphone className="h-4 w-4" />
                  <span>Android (เปิดด้วย Google Chrome)</span>
                </div>
                <ol className="mt-2.5 space-y-2 text-xs text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 font-bold text-emerald-300">
                      1
                    </span>
                    <span className="flex flex-wrap items-center gap-1">
                      แตะปุ่มเมนู <MoreVertical className="inline h-3.5 w-3.5 text-emerald-300" /> มุมขวาบนของ Chrome
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 font-bold text-emerald-300">
                      2
                    </span>
                    <span>
                      เลือก <strong className="text-white">ติดตั้งแอป (Install app)</strong> หรือ <strong className="text-white">เพิ่มลงหน้าจอหลัก</strong>
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 font-bold text-emerald-300">
                      3
                    </span>
                    <span>
                      กด <strong className="text-white">ติดตั้ง</strong> เพื่อสร้างไอคอนแอปบนมือถือ (ต้องเปิดผ่าน HTTPS เช่นบน Cloudflare)
                    </span>
                  </li>
                </ol>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-800 bg-[#131C31] px-5 py-3.5">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="min-h-[44px] rounded-xl bg-teal-500 px-5 py-2 text-sm font-bold text-slate-950 hover:bg-teal-400"
              >
                เข้าใจแล้ว
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
