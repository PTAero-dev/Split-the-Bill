import { useEffect, useState } from 'react';
import {
  Bookmark,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { CATEGORY_LABELS, sortShopTemplates } from '../lib/format';
import { ShopTemplate } from '../types';

interface ShopTemplatesModalProps {
  templates: ShopTemplate[];
  onClose: () => void;
  onAddNewShopFromTemplate: (template: ShopTemplate) => void;
  onApplyToCurrentShop: (template: ShopTemplate) => void;
  onTogglePin: (template: ShopTemplate) => void;
  onDeleteTemplate: (templateId: string) => void;
}

export function ShopTemplatesModal({
  templates,
  onClose,
  onAddNewShopFromTemplate,
  onApplyToCurrentShop,
  onTogglePin,
  onDeleteTemplate,
}: ShopTemplatesModalProps) {
  const [query, setQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sorted = sortShopTemplates(templates);
  const filtered = query.trim()
    ? sorted.filter((t) =>
        t.name.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : sorted;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shop-templates-modal-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-5"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#131C31] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/30">
              <Bookmark className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="shop-templates-modal-title"
                className="truncate text-lg font-bold text-white"
              >
                ร้านประจำ / เทมเพลตร้านอาหาร ({templates.length})
              </h2>
              <p className="text-xs text-slate-400">
                ปักหมุดร้านที่ใช้บ่อยเพื่อเรียกใช้ใน 1 คลิก แยกสีจานและเรต SC/VAT ของแต่ละร้านไว้ครบ
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-[#0D1526] text-slate-300 hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        {templates.length > 0 && (
          <div className="border-b border-slate-800 bg-[#0D1526] px-5 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ค้นหาชื่อร้านประจำ เช่น Sushiro, Katsu, Tops..."
                aria-label="ค้นหาเทมเพลตร้าน"
                className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-[#131C31] py-2 pr-3.5 pl-10 text-base text-white outline-none focus:border-teal-400"
              />
            </div>
          </div>
        )}

        {/* List */}
        <div className="flex-1 space-y-3 overflow-y-auto bg-[#0B1120] p-4 sm:p-5">
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 bg-[#131C31] p-8 text-center">
              <Bookmark className="mx-auto h-8 w-8 text-slate-500" />
              <p className="mt-2 text-sm font-semibold text-slate-200">
                {templates.length === 0
                  ? 'ยังไม่มีเทมเพลตร้านประจำ'
                  : 'ไม่พบร้านที่ค้นหา'}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                ตั้งชื่อร้าน ตั้งเรต SC/VAT หรือสีจานซูชิให้เรียบร้อย แล้วกดปุ่ม &ldquo;บันทึกเป็นร้านประจำ&rdquo; เพื่อเก็บไว้ใช้ครั้งต่อไป
              </p>
            </div>
          ) : (
            filtered.map((tpl) => {
              const isConfirming = confirmDeleteId === tpl.id;
              return (
                <div
                  key={tpl.id}
                  className="rounded-xl border border-slate-800 bg-[#131C31] p-4 transition-colors hover:border-slate-700"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-bold text-white">
                          {tpl.category === 'sushi' ? '🍣 ' : ''}
                          {tpl.name}
                        </span>
                        <span className="rounded-md border border-slate-700 bg-[#0D1526] px-2 py-0.5 text-[11px] font-medium text-slate-300">
                          {CATEGORY_LABELS[tpl.category]}
                        </span>
                      </div>

                      <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-slate-400 tabular-nums">
                        <span>SC {tpl.serviceChargeRate}%</span>
                        <span>•</span>
                        <span>
                          VAT {tpl.vatRate}%
                          {tpl.vatOnServiceCharge ? ' (++)' : ''}
                        </span>
                      </div>

                      {/* Mini Sushi Plate Chips */}
                      {tpl.category === 'sushi' &&
                        tpl.plateTiers &&
                        tpl.plateTiers.length > 0 && (
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {tpl.plateTiers.map((pt) => (
                              <span
                                key={pt.id}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#0D1526] px-2 py-1 text-xs text-slate-200 tabular-nums"
                              >
                                <span
                                  className="h-3 w-3 rounded-full border border-white/70"
                                  style={{ backgroundColor: pt.colorHex }}
                                />
                                <span>฿{pt.price}</span>
                              </span>
                            ))}
                          </div>
                        )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onTogglePin(tpl)}
                        title={
                          tpl.isPinned
                            ? 'เอาหมุดออก'
                            : 'ปักหมุดไว้หน้าสุด'
                        }
                        aria-label="ปักหมุดร้านประจำ"
                        className={`inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border ${
                          tpl.isPinned
                            ? 'border-amber-400/40 bg-amber-500/15 text-amber-300'
                            : 'border-slate-700 bg-[#0D1526] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Star
                          className={`h-4 w-4 ${tpl.isPinned ? 'fill-amber-300' : ''}`}
                        />
                      </button>

                      {isConfirming ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteTemplate(tpl.id);
                              setConfirmDeleteId(null);
                            }}
                            className="min-h-[40px] rounded-xl bg-rose-600 px-3 text-xs font-semibold text-white"
                          >
                            ยืนยันลบ
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="min-h-[40px] rounded-xl border border-slate-700 px-2.5 text-xs text-slate-300"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(tpl.id)}
                          aria-label={`ลบเทมเพลต ${tpl.name}`}
                          className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-slate-700 bg-[#0D1526] text-rose-400 hover:bg-rose-500/15"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Quick Apply Actions */}
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-800 pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        onAddNewShopFromTemplate(tpl);
                        onClose();
                      }}
                      className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-teal-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-teal-400"
                    >
                      <Plus className="h-4 w-4" />
                      <span>เพิ่มเป็นร้านใหม่ในบิลนี้</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onApplyToCurrentShop(tpl);
                        onClose();
                      }}
                      className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-slate-700 bg-[#0D1526] px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                    >
                      ใช้ค่ากับร้านปัจจุบัน
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
