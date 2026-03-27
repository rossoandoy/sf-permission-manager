/**
 * ヘッダーコンポーネント
 * プロトタイプ準拠: アイコン + タイトル + 統計 + 接続状態 + バッジ
 */

import type { FC } from "react";

interface HeaderProps {
  status: "disconnected" | "connecting" | "connected" | "error";
  sfHost: string | null;
  error: string | null;
  objectCount: number;
  permissionSetCount: number;
  onReconnect: () => void;
}

export const Header: FC<HeaderProps> = ({
  status,
  sfHost,
  error,
  objectCount,
  permissionSetCount,
  onReconnect,
}) => {
  const isSandbox =
    sfHost?.includes("sandbox") || sfHost?.includes("--") || false;

  return (
    <header className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-700/50">
      {/* 左: アイコン + タイトル */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-md bg-violet-600 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
          P
        </div>
        <div className="flex items-baseline gap-1.5">
          <h1 className="text-sm font-bold text-zinc-100 tracking-tight">
            Permission Set Manager
          </h1>
          <span className="text-[11px] text-zinc-500">for Salesforce</span>
        </div>
      </div>

      {/* 中: 統計（接続時のみ） */}
      {status === "connected" && (objectCount > 0 || permissionSetCount > 0) && (
        <div className="text-[11px] text-zinc-500">
          {objectCount > 0 && <span>{objectCount} objects</span>}
          {objectCount > 0 && permissionSetCount > 0 && <span> · </span>}
          {permissionSetCount > 0 && <span>{permissionSetCount} permission sets</span>}
        </div>
      )}

      {/* 右: 接続状態 + バッジ */}
      <div className="flex items-center gap-2">
        {status === "connected" && sfHost && (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[11px] text-zinc-400 max-w-[220px] truncate">
              {sfHost}
            </span>
          </>
        )}

        {status === "connecting" && (
          <span className="text-[11px] text-yellow-400 animate-pulse">接続中...</span>
        )}

        {(status === "disconnected" || status === "error") && (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            <span className="text-[11px] text-zinc-500">
              {error ? "エラー" : "未接続"}
            </span>
            <button
              onClick={onReconnect}
              className="text-[10px] px-2 py-0.5 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors"
            >
              再接続
            </button>
          </>
        )}

        {status === "connected" && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-900/60 text-sky-300 font-medium">
            API v62.0
          </span>
        )}

        {status === "connected" && isSandbox && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/60 text-emerald-300 font-medium">
            Sandbox
          </span>
        )}
      </div>
    </header>
  );
};
