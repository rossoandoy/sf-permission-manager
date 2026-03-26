/**
 * フィールド権限マトリクス表示コンポーネント
 * 行=フィールド、列=権限セット、セル=Read/Editトグル
 */

import { useState, useMemo, type FC } from "react";
import type {
  PermissionMatrix,
  PermissionChangeResult,
} from "../../types/permissions";

interface MatrixViewProps {
  matrix: PermissionMatrix;
  pendingChanges: Record<string, boolean>;
  pendingCount: number;
  saving: boolean;
  lastSaveResult: PermissionChangeResult | null;
  onTogglePermission: (
    fieldQualifiedName: string,
    permissionSetId: string,
    permission: "read" | "edit",
  ) => void;
  onSave: () => void;
  onCancel: () => void;
}

export const MatrixView: FC<MatrixViewProps> = ({
  matrix,
  pendingChanges,
  pendingCount,
  saving,
  lastSaveResult,
  onTogglePermission,
  onSave,
  onCancel,
}) => {
  const [customFieldsOnly, setCustomFieldsOnly] = useState(true);

  const filteredFields = useMemo(() => {
    if (customFieldsOnly) {
      return matrix.fields.filter((f) => f.isCustom);
    }
    return matrix.fields;
  }, [matrix.fields, customFieldsOnly]);

  /**
   * セルの現在値を取得（pending優先、なければ既存値）
   */
  const getCellValue = (
    fieldQualifiedName: string,
    permissionSetId: string,
    permission: "read" | "edit",
  ): { value: boolean; isPending: boolean } => {
    const changeKey = `${fieldQualifiedName}:${permissionSetId}:${permission}`;
    const pending = pendingChanges[changeKey];
    if (pending !== undefined) {
      return { value: pending, isPending: true };
    }
    const existing =
      matrix.fieldPermissions[fieldQualifiedName]?.[permissionSetId];
    const value =
      permission === "read"
        ? (existing?.read ?? false)
        : (existing?.edit ?? false);
    return { value, isPending: false };
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* ツールバー */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-zinc-800 border-b border-zinc-700">
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400">
            {matrix.object.label}
            <span className="ml-1 text-zinc-500">
              ({filteredFields.length} フィールド ×{" "}
              {matrix.permissionSets.length} 権限セット)
            </span>
          </span>
          <label className="flex items-center gap-1 text-xs text-zinc-500">
            <input
              type="checkbox"
              checked={customFieldsOnly}
              onChange={(e) => setCustomFieldsOnly(e.target.checked)}
              className="w-3 h-3 rounded"
            />
            カスタムのみ
          </label>
        </div>
        <div className="text-[10px] text-zinc-500">
          R = Read, E = Edit
        </div>
      </div>

      {/* マトリクス本体 */}
      <div className="flex-1 overflow-auto">
        <table className="text-xs border-collapse w-full">
          <thead className="sticky top-0 z-10">
            <tr className="bg-zinc-800">
              <th className="sticky left-0 z-20 bg-zinc-800 px-2 py-1.5 text-left text-zinc-400 font-medium border-b border-r border-zinc-700 min-w-[200px]">
                フィールド
              </th>
              {matrix.permissionSets.map((ps) => (
                <th
                  key={ps.id}
                  className="px-1 py-1.5 text-center text-zinc-400 font-medium border-b border-zinc-700 min-w-[60px]"
                  title={`${ps.label} (${ps.name})`}
                >
                  <div className="truncate max-w-[56px]">{ps.label}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredFields.map((field) => (
              <tr
                key={field.qualifiedApiName}
                className="hover:bg-zinc-800/50"
              >
                <td className="sticky left-0 bg-zinc-900 px-2 py-1 border-b border-r border-zinc-800 text-zinc-300">
                  <div className="truncate max-w-[196px]" title={field.qualifiedApiName}>
                    <span className="font-medium">{field.label}</span>
                    <span className="ml-1 text-zinc-500 text-[10px]">
                      {field.fieldApiName}
                    </span>
                  </div>
                </td>
                {matrix.permissionSets.map((ps) => {
                  const read = getCellValue(
                    field.qualifiedApiName,
                    ps.id,
                    "read",
                  );
                  const edit = getCellValue(
                    field.qualifiedApiName,
                    ps.id,
                    "edit",
                  );

                  return (
                    <td
                      key={ps.id}
                      className="px-0.5 py-1 border-b border-zinc-800 text-center"
                    >
                      <div className="flex items-center justify-center gap-0.5">
                        <PermissionToggle
                          label="R"
                          value={read.value}
                          isPending={read.isPending}
                          onClick={() =>
                            onTogglePermission(
                              field.qualifiedApiName,
                              ps.id,
                              "read",
                            )
                          }
                        />
                        <PermissionToggle
                          label="E"
                          value={edit.value}
                          isPending={edit.isPending}
                          onClick={() =>
                            onTogglePermission(
                              field.qualifiedApiName,
                              ps.id,
                              "edit",
                            )
                          }
                        />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {filteredFields.length === 0 && (
          <div className="flex items-center justify-center h-32 text-zinc-500 text-sm">
            表示するフィールドがありません
          </div>
        )}
      </div>

      {/* 保存バー */}
      {pendingCount > 0 && (
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-800 border-t border-zinc-700">
          <span className="text-xs text-amber-400">
            {pendingCount} 件の未保存の変更
          </span>
          <div className="flex items-center gap-2">
            {lastSaveResult && !lastSaveResult.success && (
              <span className="text-xs text-red-400">
                {lastSaveResult.failureCount} 件のエラー
              </span>
            )}
            <button
              onClick={onCancel}
              disabled={saving}
              className="px-3 py-1 text-xs rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300 disabled:opacity-50 transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="px-3 py-1 text-xs rounded bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 transition-colors"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      )}

      {/* 保存成功メッセージ */}
      {lastSaveResult?.success && pendingCount === 0 && (
        <div className="flex items-center px-4 py-1.5 bg-emerald-900/30 border-t border-emerald-800">
          <span className="text-xs text-emerald-400">
            {lastSaveResult.successCount} 件の変更を保存しました
          </span>
        </div>
      )}
    </div>
  );
};

// --- 権限トグルボタン ---

interface PermissionToggleProps {
  label: string;
  value: boolean;
  isPending: boolean;
  onClick: () => void;
}

const PermissionToggle: FC<PermissionToggleProps> = ({
  label,
  value,
  isPending,
  onClick,
}) => {
  const baseClasses =
    "w-6 h-5 text-[10px] font-bold rounded cursor-pointer transition-colors select-none";

  let colorClasses: string;
  if (value) {
    colorClasses = isPending
      ? "bg-emerald-600 text-white ring-1 ring-amber-400"
      : "bg-emerald-700 text-emerald-100";
  } else {
    colorClasses = isPending
      ? "bg-zinc-600 text-zinc-300 ring-1 ring-amber-400"
      : "bg-zinc-700 text-zinc-500 hover:bg-zinc-600";
  }

  return (
    <button onClick={onClick} className={`${baseClasses} ${colorClasses}`}>
      {label}
    </button>
  );
};
