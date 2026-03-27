/**
 * 保存確認ダイアログ
 * 権限変更はSF環境に即時反映されるため、確認を必須にする
 */

import type { FC } from "react";

interface ChangeItem {
  field: string;
  permissionSet: string;
  permission: string;
  from: boolean;
  to: boolean;
}

interface SaveConfirmDialogProps {
  hostname: string;
  changes: ChangeItem[];
  saving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const SaveConfirmDialog: FC<SaveConfirmDialogProps> = ({
  hostname,
  changes,
  saving,
  onConfirm,
  onCancel,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-zinc-800 rounded-lg shadow-2xl border border-zinc-600/50 w-[520px] max-h-[80vh] flex flex-col">
        {/* ヘッダー */}
        <div className="px-5 py-3 border-b border-zinc-700/50">
          <h2 className="text-sm font-bold text-zinc-100">権限変更の確認</h2>
        </div>

        {/* 警告 */}
        <div className="px-5 py-3 bg-red-900/20 border-b border-red-800/30">
          <p className="text-xs text-red-300 font-medium">
            この変更は即座に Salesforce 環境に反映されます
          </p>
          <p className="text-[11px] text-red-400/80 mt-1">
            対象環境: <strong className="text-red-300">{hostname}</strong>
          </p>
        </div>

        {/* 変更一覧 */}
        <div className="flex-1 overflow-y-auto px-5 py-3 min-h-0">
          <p className="text-xs text-zinc-400 mb-2">
            {changes.length} 件の変更
          </p>
          <div className="space-y-1">
            {changes.slice(0, 50).map((change, i) => (
              <div
                key={i}
                className="flex items-center gap-2 py-1 px-2 rounded bg-zinc-700/30 text-[11px]"
              >
                <span className="text-zinc-300 flex-1 truncate" title={change.field}>
                  {change.field}
                </span>
                <span className="text-zinc-500 shrink-0">{change.permissionSet}</span>
                <span className="text-zinc-500 shrink-0 w-8 text-center">
                  {change.permission === "read" ? "Read" : "Edit"}
                </span>
                <span className={`shrink-0 w-12 text-center font-medium ${
                  change.to ? "text-emerald-400" : "text-red-400"
                }`}>
                  {change.from ? "ON" : "OFF"} → {change.to ? "ON" : "OFF"}
                </span>
              </div>
            ))}
            {changes.length > 50 && (
              <p className="text-[10px] text-zinc-500 text-center py-1">
                ... 他 {changes.length - 50} 件
              </p>
            )}
          </div>
        </div>

        {/* フッター */}
        <div className="px-5 py-3 border-t border-zinc-700/50 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-1.5 text-xs rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300 disabled:opacity-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="px-4 py-1.5 text-xs font-medium rounded bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 transition-colors"
          >
            {saving ? "保存中..." : `${changes.length} 件の変更を適用`}
          </button>
        </div>
      </div>
    </div>
  );
};

export type { ChangeItem };
