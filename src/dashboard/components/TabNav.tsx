/**
 * タブナビゲーション
 */

import type { FC } from "react";

type TabId = "matrix" | "gaps" | "diff";

interface TabNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const TABS: { id: TabId; icon: string; label: string; enabled: boolean }[] = [
  { id: "matrix", icon: "▦", label: "マトリクス", enabled: true },
  { id: "gaps", icon: "⚡", label: "漏れ検出", enabled: false },
  { id: "diff", icon: "≡", label: "差分比較", enabled: false },
];

export const TabNav: FC<TabNavProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav className="flex items-center gap-0 bg-zinc-800/50 border-b border-zinc-700/50">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => tab.enabled && onTabChange(tab.id)}
          disabled={!tab.enabled}
          className={`px-4 py-2 text-xs font-medium transition-colors relative ${
            activeTab === tab.id
              ? "text-zinc-100 bg-zinc-900/80"
              : tab.enabled
                ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80"
                : "text-zinc-600 cursor-not-allowed"
          }`}
          title={!tab.enabled ? "Coming soon" : undefined}
        >
          <span className="mr-1.5">{tab.icon}</span>
          {tab.label}
          {activeTab === tab.id && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500" />
          )}
        </button>
      ))}
    </nav>
  );
};
