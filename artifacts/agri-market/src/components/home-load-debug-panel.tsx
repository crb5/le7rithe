import { useEffect, useState } from 'react';

type HomeLoadDebugEntry = { atMs: number; event: Record<string, unknown> };
type HomeLoadDebugWindow = Window & { __homeLoadDebug?: { entries: HomeLoadDebugEntry[] } };

export function HomeLoadDebugPanel() {
  const [entryCount, setEntryCount] = useState(0);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const timer = window.setInterval(() => {
      setEntryCount((window as HomeLoadDebugWindow).__homeLoadDebug?.entries.length ?? 0);
    }, 250);
    return () => window.clearInterval(timer);
  }, []);

  const copyLog = async () => {
    const entries = (window as HomeLoadDebugWindow).__homeLoadDebug?.entries ?? [];
    const text = JSON.stringify(entries, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setStatus('تم نسخ السجل');
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.readOnly = true;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand('copy');
      textarea.remove();
      setStatus(copied ? 'تم نسخ السجل' : 'تعذر النسخ');
    }
  };

  return (
    <aside
      dir="rtl"
      className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] end-3 z-[100] flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-xl border border-white/15 bg-[#15251d]/95 p-2 text-xs text-white shadow-xl"
      data-testid="home-load-debug-panel"
    >
      <span className="px-1">تشخيص الفتح: {entryCount}</span>
      <button
        type="button"
        onClick={() => void copyLog()}
        className="rounded-lg bg-[#e9b949] px-3 py-2 font-bold text-[#173d32]"
        data-testid="button-copy-home-load-debug"
      >
        نسخ السجل
      </button>
      {status ? <span role="status">{status}</span> : null}
    </aside>
  );
}
