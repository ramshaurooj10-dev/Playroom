import React, { useState } from 'react';
import { useDeveloperMode } from '../../utils/devMode';
import { ShieldAlert, ShieldCheck, RefreshCw } from 'lucide-react';
import { soundManager } from '../../utils/audio';

export const DeveloperModeToggle: React.FC = () => {
  const { isDeveloperMode: isDev, toggleDeveloperMode } = useDeveloperMode();
  const [minimized, setMinimized] = useState(false);

  const handleToggle = () => {
    soundManager.playPop();
    const next = toggleDeveloperMode();
  };

  return (
    <aside
      id="dev-mode-indicator"
      aria-label="Development Mode Switcher"
      className="fixed bottom-3 left-3 z-40 print:hidden select-none font-sans"
    >
      {isDev ? (
        // DEVELOPER MODE ACTIVE UI (Discreet floating pill)
        <div className="flex items-center gap-2 bg-slate-900/95 text-white p-1.5 pl-3 pr-2 rounded-full border-2 border-indigo-500 shadow-2xl backdrop-blur-md transition-all hover:scale-105">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping inline-block" />
            <span className="text-[11px] font-black tracking-wide text-indigo-200 uppercase">
              Dev Mode (Full Access)
            </span>
          </div>

          <button
            type="button"
            onClick={handleToggle}
            title="Switch to Public User Mode to test public locks (Shortcut: Ctrl+Shift+D)"
            className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-[10px] font-black px-2.5 py-1 rounded-full cursor-pointer transition shadow-xs"
          >
            <RefreshCw className="w-3 h-3 stroke-[2.5]" />
            <span>Test User Mode</span>
          </button>
        </div>
      ) : (
        // PUBLIC USER MODE ACTIVE UI (Unobtrusive subtle toggle)
        <div className="flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-900 text-slate-300 hover:text-white p-1 px-2.5 rounded-full border border-slate-700 shadow-lg backdrop-blur-sm transition-all text-[10px] font-bold">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
          <span className="text-slate-300">User Mode</span>
          <button
            type="button"
            onClick={handleToggle}
            title="Switch to Developer Mode for full access (Shortcut: Ctrl+Shift+D)"
            className="text-indigo-300 hover:text-indigo-200 underline font-black ml-1 cursor-pointer"
          >
            Enable Dev Mode
          </button>
        </div>
      )}
    </aside>
  );
};
