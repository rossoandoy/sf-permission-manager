/**
 * ヘッダーコンポーネント
 * 拡張名、接続状態、org情報を表示
 */

import type { FC } from "react";

interface HeaderProps {
  status: "disconnected" | "connecting" | "connected" | "error";
  sfHost: string | null;
  error: string | null;
  onReconnect: () => void;
}

const statusColors = {
  disconnected: "bg-zinc-500",
  connecting: "bg-yellow-500 animate-pulse",
  connected: "bg-emerald-500",
  error: "bg-red-500",
} as const;

const statusLabels = {
  disconnected: "未接続",
  connecting: "接続中...",
  connected: "接続済み",
  error: "エラー",
} as const;

export const Header: FC<HeaderProps> = ({
  status,
  sfHost,
  error,
  onReconnect,
}) => {
  return (
    <header className="flex items-center justify-between px-4 py-2 bg-zinc-800 border-b border-zinc-700">
      <div className="flex items-center gap-2">
        <h1 className="text-sm font-bold text-zinc-100">
          SF Permission Manager
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {/* 接続状態 */}
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-block w-2 h-2 rounded-full ${statusColors[status]}`}
          />
          <span className="text-xs text-zinc-400">
            {status === "connected" && sfHost ? sfHost : statusLabels[status]}
          </span>
        </div>

        {/* エラーメッセージ */}
        {error && (
          <span className="text-xs text-red-400 max-w-[200px] truncate" title={error}>
            {error}
          </span>
        )}

        {/* 再接続ボタン */}
        {(status === "disconnected" || status === "error") && (
          <button
            onClick={onReconnect}
            className="text-xs px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors"
          >
            再接続
          </button>
        )}
      </div>
    </header>
  );
};
