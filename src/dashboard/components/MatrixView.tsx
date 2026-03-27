/**
 * フィールド権限マトリクス表示
 * プロトタイプ準拠: 型バッジ、一括操作、フィルターバー、チェックボックス風セル
 */

import { useState, useMemo, useCallback, type FC } from "react";
import type {
  PermissionMatrix,
  PermissionChangeResult,
} from "../../types/permissions";
import { FieldTypeBadge } from "./FieldTypeBadge";
import { SaveConfirmDialog, type ChangeItem } from "./SaveConfirmDialog";

interface MatrixViewProps {
  matrix: PermissionMatrix;
  hostname: string;
  pendingChanges: Record<string, boolean>;
  pendingCrudChanges: Record<string, boolean>;
  pendingCount: number;
  saving: boolean;
  lastSaveResult: PermissionChangeResult | null;
  onTogglePermission: (
    fieldQualifiedName: string,
    permissionSetId: string,
    permission: "read" | "edit",
  ) => void;
  onToggleCrud: (permissionSetId: string, crudKey: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export const MatrixView: FC<MatrixViewProps> = ({
  matrix,
  hostname,
  pendingChanges,
  pendingCrudChanges,
  pendingCount,
  saving,
  lastSaveResult,
  onTogglePermission,
  onToggleCrud,
  onSave,
  onCancel,
}) => {
  const [fieldFilter, setFieldFilter] = useState("");
  const [showGapsOnly, setShowGapsOnly] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // 確認ダイアログ用の変更アイテム一覧を構築
  const changeItems: ChangeItem[] = useMemo(() => {
    return Object.entries(pendingChanges).map(([key, newValue]) => {
      const [fieldQualifiedName, permissionSetId, permission] = key.split(":");
      const field = matrix.fields.find(f => f.qualifiedApiName === fieldQualifiedName);
      const ps = matrix.permissionSets.find(p => p.id === permissionSetId);
      const existing = matrix.fieldPermissions[fieldQualifiedName ?? ""]?.[permissionSetId ?? ""];
      const currentValue = permission === "read" ? (existing?.read ?? false) : (existing?.edit ?? false);
      return {
        field: field?.label ?? fieldQualifiedName ?? "",
        permissionSet: ps?.label ?? permissionSetId ?? "",
        permission: permission ?? "",
        from: currentValue,
        to: newValue,
      };
    });
  }, [pendingChanges, matrix]);

  const filteredFields = useMemo(() => {
    let fields = matrix.fields.filter((f) => f.isCustom);

    if (fieldFilter) {
      const lower = fieldFilter.toLowerCase();
      fields = fields.filter(
        (f) =>
          f.label.toLowerCase().includes(lower) ||
          f.fieldApiName.toLowerCase().includes(lower),
      );
    }

    if (showGapsOnly) {
      fields = fields.filter((f) => {
        // 少なくとも1つの権限セットで権限未設定
        return matrix.permissionSets.some((ps) => {
          const perm = matrix.fieldPermissions[f.qualifiedApiName]?.[ps.id];
          return !perm || (!perm.read && !perm.edit);
        });
      });
    }

    return fields;
  }, [matrix.fields, matrix.permissionSets, matrix.fieldPermissions, fieldFilter, showGapsOnly]);

  const getCellValue = useCallback(
    (
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
    },
    [pendingChanges, matrix.fieldPermissions],
  );

  // 一括操作: 全Read ON
  const handleBulkReadOn = () => {
    for (const field of filteredFields) {
      for (const ps of matrix.permissionSets) {
        const { value } = getCellValue(field.qualifiedApiName, ps.id, "read");
        if (!value) {
          onTogglePermission(field.qualifiedApiName, ps.id, "read");
        }
      }
    }
  };

  // 一括操作: 全Read+Edit ON
  const handleBulkReadEditOn = () => {
    for (const field of filteredFields) {
      for (const ps of matrix.permissionSets) {
        const readVal = getCellValue(field.qualifiedApiName, ps.id, "read");
        const editVal = getCellValue(field.qualifiedApiName, ps.id, "edit");
        if (!readVal.value) {
          onTogglePermission(field.qualifiedApiName, ps.id, "read");
        }
        if (!editVal.value) {
          onTogglePermission(field.qualifiedApiName, ps.id, "edit");
        }
      }
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* ツールバー */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/30 border-b border-zinc-700/30">
        <input
          type="text"
          value={fieldFilter}
          onChange={(e) => setFieldFilter(e.target.value)}
          placeholder="フィールド絞り込み..."
          className="w-48 px-2 py-1 text-xs bg-zinc-800 border border-zinc-600/50 rounded text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-violet-500/50"
        />
        <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={showGapsOnly}
            onChange={(e) => setShowGapsOnly(e.target.checked)}
            className="w-3 h-3 rounded accent-violet-500"
          />
          漏れのみ表示
        </label>
        <div className="flex-1" />
        <button
          onClick={handleBulkReadOn}
          className="px-2 py-1 text-[11px] font-medium rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-200 transition-colors"
        >
          全Read ON
        </button>
        <button
          onClick={handleBulkReadEditOn}
          className="px-2 py-1 text-[11px] font-medium rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-200 transition-colors"
        >
          全Read+Edit ON
        </button>
      </div>

      {/* 保存バー（未保存変更がある場合） */}
      {pendingCount > 0 && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-amber-900/20 border-b border-amber-700/30">
          <span className="text-xs text-amber-300">
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
              className="px-2.5 py-1 text-[11px] rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300 disabled:opacity-50 transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={() => setShowSaveDialog(true)}
              disabled={saving}
              className="px-3 py-1 text-[11px] font-medium rounded bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 transition-colors"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      )}

      {/* 保存成功 */}
      {lastSaveResult?.success && pendingCount === 0 && (
        <div className="flex items-center px-3 py-1 bg-emerald-900/20 border-b border-emerald-700/30">
          <span className="text-xs text-emerald-400">
            {lastSaveResult.successCount} 件の変更を保存しました
          </span>
        </div>
      )}

      {/* フィールド数ヘッダー */}
      <div className="px-3 py-1 text-xs text-zinc-400 border-b border-zinc-700/30 bg-zinc-800/20">
        フィールド ({filteredFields.length})
      </div>

      {/* マトリクステーブル */}
      <div className="flex-1 overflow-auto">
        <table className="text-xs border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-zinc-800">
              {/* フィールド列ヘッダー */}
              <th className="sticky left-0 z-20 bg-zinc-800 min-w-[280px] px-3 py-2 text-left text-zinc-400 font-medium border-b border-zinc-700/50">
                &nbsp;
              </th>
              {/* 権限セット列ヘッダー */}
              {matrix.permissionSets.map((ps) => (
                <th
                  key={ps.id}
                  colSpan={1}
                  className="px-2 py-1 text-center border-b border-zinc-700/50 min-w-[80px]"
                >
                  <div
                    className="text-zinc-300 font-medium text-[11px] truncate max-w-[76px]"
                    title={`${ps.label} (${ps.name})`}
                  >
                    {ps.label}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">
                    R &nbsp; E
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* オブジェクト権限 (CRUD) 行 */}
            <ObjectPermissionRows
              permissionSets={matrix.permissionSets}
              objectPermissions={matrix.objectPermissions}
              pendingCrudChanges={pendingCrudChanges}
              onToggleCrud={onToggleCrud}
            />

            {filteredFields.map((field) => (
              <tr
                key={field.qualifiedApiName}
                className="hover:bg-zinc-800/40 group"
              >
                {/* フィールド情報 */}
                <td className="sticky left-0 z-[5] bg-zinc-900 group-hover:bg-zinc-800/80 px-3 py-1.5 border-b border-zinc-800/50">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-zinc-200 truncate">
                          {field.label}
                        </span>
                        {isNewField(field.lastModified) && (
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" title="最近追加されたフィールド" />
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-500 truncate">
                        {field.fieldApiName}
                      </div>
                    </div>
                    <FieldTypeBadge dataType={field.dataType} />
                  </div>
                </td>

                {/* 権限セルグループ */}
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
                      className="px-1 py-1.5 border-b border-zinc-800/50 text-center"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <PermCell
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
                        <PermCell
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

      {/* 保存確認ダイアログ */}
      {showSaveDialog && (
        <SaveConfirmDialog
          hostname={hostname}
          changes={changeItems}
          saving={saving}
          onConfirm={() => {
            onSave();
            setShowSaveDialog(false);
          }}
          onCancel={() => setShowSaveDialog(false)}
        />
      )}
    </div>
  );
};

// --- チェックボックス風セル ---

interface PermCellProps {
  value: boolean;
  isPending: boolean;
  onClick: () => void;
}

const PermCell: FC<PermCellProps> = ({ value, isPending, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`w-6 h-6 rounded flex items-center justify-center transition-all cursor-pointer ${
        value
          ? isPending
            ? "bg-sky-500 ring-2 ring-amber-400 shadow-sm"
            : "bg-sky-600 hover:bg-sky-500"
          : isPending
            ? "bg-zinc-600 ring-2 ring-amber-400"
            : "bg-zinc-700/80 hover:bg-zinc-500/80"
      }`}
    >
      {value && (
        <svg
          className="w-3.5 h-3.5 text-white"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="2,6 5,9 10,3" />
        </svg>
      )}
    </button>
  );
};

// --- オブジェクト権限 (CRUD) 行 ---

const CRUD_LABELS = [
  { key: "create" as const, label: "Create", short: "C" },
  { key: "read" as const, label: "Read", short: "R" },
  { key: "edit" as const, label: "Edit", short: "U" },
  { key: "delete" as const, label: "Delete", short: "D" },
  { key: "viewAll" as const, label: "View All", short: "VA" },
  { key: "modifyAll" as const, label: "Modify All", short: "MA" },
];

interface ObjectPermissionRowsProps {
  permissionSets: { id: string }[];
  objectPermissions: Record<string, import("../../types/permissions").ObjectPermissionEntry>;
  pendingCrudChanges: Record<string, boolean>;
  onToggleCrud: (permissionSetId: string, crudKey: string) => void;
}

const ObjectPermissionRows: FC<ObjectPermissionRowsProps> = ({
  permissionSets,
  objectPermissions,
  pendingCrudChanges,
  onToggleCrud,
}) => {
  return (
    <>
      {/* CRUD ヘッダー行 */}
      <tr className="bg-zinc-800/60">
        <td className="sticky left-0 z-[5] bg-zinc-800/60 px-3 py-1 border-b border-zinc-700/50">
          <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
            オブジェクト権限 (CRUD)
          </span>
        </td>
        {permissionSets.map((ps) => (
          <td key={ps.id} className="border-b border-zinc-700/50" />
        ))}
      </tr>
      {CRUD_LABELS.map((crud) => (
        <tr key={crud.key} className="hover:bg-zinc-800/30">
          <td className="sticky left-0 z-[5] bg-zinc-900 px-3 py-1 border-b border-zinc-800/30">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-zinc-400 w-5 text-center bg-zinc-700/50 rounded px-1">
                {crud.short}
              </span>
              <span className="text-xs text-zinc-300">{crud.label}</span>
            </div>
          </td>
          {permissionSets.map((ps) => {
            const perm = objectPermissions[ps.id];
            const pendingKey = `${ps.id}:${crud.key}`;
            const pendingValue = pendingCrudChanges[pendingKey];
            const currentValue = perm ? perm[crud.key] : false;
            const displayValue = pendingValue !== undefined ? pendingValue : currentValue;
            const isPending = pendingValue !== undefined;
            return (
              <td
                key={ps.id}
                className="px-1 py-1 border-b border-zinc-800/30 text-center"
              >
                <button
                  onClick={() => onToggleCrud(ps.id, crud.key)}
                  className={`inline-block w-6 h-5 rounded text-center leading-5 text-[10px] font-bold cursor-pointer transition-all ${
                    displayValue
                      ? isPending
                        ? "bg-emerald-600 text-white ring-2 ring-amber-400"
                        : "bg-emerald-700/60 text-emerald-200 hover:bg-emerald-600/80"
                      : isPending
                        ? "bg-zinc-600 ring-2 ring-amber-400 text-zinc-300"
                        : "bg-zinc-700/40 text-zinc-600 hover:bg-zinc-600/60"
                  }`}
                  title={`${crud.label}: ${displayValue ? "ON" : "OFF"}${isPending ? " (変更あり)" : ""}`}
                >
                  {displayValue ? "✓" : "–"}
                </button>
              </td>
            );
          })}
        </tr>
      ))}
      {/* CRUD とフィールドの区切り線 */}
      <tr>
        <td
          colSpan={permissionSets.length + 1}
          className="h-1 bg-zinc-700/30"
        />
      </tr>
    </>
  );
};

// --- ユーティリティ ---

/** 過去30日以内に変更されたフィールドを「新規」とみなす */
function isNewField(lastModified: string): boolean {
  const diff = Date.now() - new Date(lastModified).getTime();
  return diff < 30 * 24 * 60 * 60 * 1000;
}
