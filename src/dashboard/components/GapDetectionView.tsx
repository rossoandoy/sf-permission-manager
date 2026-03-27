/**
 * 漏れ検出タブ
 * 権限未設定フィールドの検出 + 一括Read付与
 */

import { useMemo, type FC } from "react";
import type { PermissionMatrix } from "../../types/permissions";

interface GapItem {
  fieldQualifiedName: string;
  fieldLabel: string;
  fieldApiName: string;
  permissionSetId: string;
  permissionSetLabel: string;
  gapType: "missing" | "no_access";
}

interface GapDetectionViewProps {
  matrix: PermissionMatrix | null;
  onTogglePermission: (
    fieldQualifiedName: string,
    permissionSetId: string,
    permission: "read" | "edit",
  ) => void;
  pendingCount: number;
}

export const GapDetectionView: FC<GapDetectionViewProps> = ({
  matrix,
  onTogglePermission,
  pendingCount,
}) => {
  const gaps = useMemo(() => {
    if (!matrix) return [];
    const result: GapItem[] = [];

    for (const field of matrix.fields) {
      if (!field.isCustom) continue;
      for (const ps of matrix.permissionSets) {
        const perm = matrix.fieldPermissions[field.qualifiedApiName]?.[ps.id];
        if (!perm) {
          result.push({
            fieldQualifiedName: field.qualifiedApiName,
            fieldLabel: field.label,
            fieldApiName: field.fieldApiName,
            permissionSetId: ps.id,
            permissionSetLabel: ps.label,
            gapType: "missing",
          });
        } else if (!perm.read && !perm.edit) {
          result.push({
            fieldQualifiedName: field.qualifiedApiName,
            fieldLabel: field.label,
            fieldApiName: field.fieldApiName,
            permissionSetId: ps.id,
            permissionSetLabel: ps.label,
            gapType: "no_access",
          });
        }
      }
    }
    return result;
  }, [matrix]);

  const missingCount = gaps.filter((g) => g.gapType === "missing").length;
  const noAccessCount = gaps.filter((g) => g.gapType === "no_access").length;

  const handleBulkReadOn = () => {
    for (const gap of gaps) {
      onTogglePermission(gap.fieldQualifiedName, gap.permissionSetId, "read");
    }
  };

  if (!matrix) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-zinc-500">
          オブジェクトを選択すると漏れ検出結果が表示されます
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* ロジック説明 */}
      <div className="px-4 py-2.5 bg-zinc-800/50 border-b border-zinc-700/30">
        <div className="text-xs text-zinc-300 font-medium mb-1">検出ロジック</div>
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          選択中の権限セットに対して、カスタムフィールドの FLS が
          <strong className="text-red-300"> 未設定（missing）</strong>または
          <strong className="text-amber-300"> Read/Edit 共に OFF（no_access）</strong>
          のものを検出します。
        </p>
      </div>

      {gaps.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-sm text-emerald-400 font-medium">漏れは検出されませんでした</p>
            <p className="text-xs text-zinc-500 mt-1">
              {matrix.fields.filter((f) => f.isCustom).length} カスタムフィールド ×{" "}
              {matrix.permissionSets.length} 権限セットをチェック済み
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-4 py-2 bg-amber-900/20 border-b border-amber-700/30">
            <div className="flex items-center gap-4">
              <span className="text-xs text-amber-300 font-medium">
                {gaps.length} 件の漏れを検出
              </span>
              <span className="text-[10px] text-zinc-400">
                未設定: {missingCount} | アクセスなし: {noAccessCount}
              </span>
            </div>
            <button
              onClick={handleBulkReadOn}
              className="px-3 py-1 text-[11px] font-medium rounded bg-sky-700 hover:bg-sky-600 text-white transition-colors"
            >
              全{gaps.length}件にRead ON
            </button>
          </div>

          {pendingCount > 0 && (
            <div className="px-4 py-1.5 bg-violet-900/20 border-b border-violet-700/30">
              <span className="text-xs text-violet-300">
                {pendingCount} 件の変更がマトリクスタブに反映されています。マトリクスタブで保存してください。
              </span>
            </div>
          )}

          <div className="flex-1 overflow-auto">
            <table className="text-xs border-collapse w-full">
              <thead className="sticky top-0 z-10">
                <tr className="bg-zinc-800">
                  <th className="px-3 py-2 text-left text-zinc-400 font-medium border-b border-zinc-700/50">
                    フィールド
                  </th>
                  <th className="px-3 py-2 text-left text-zinc-400 font-medium border-b border-zinc-700/50">
                    権限セット
                  </th>
                  <th className="px-3 py-2 text-center text-zinc-400 font-medium border-b border-zinc-700/50">
                    タイプ
                  </th>
                  <th className="px-3 py-2 text-center text-zinc-400 font-medium border-b border-zinc-700/50">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {gaps.map((gap, i) => (
                  <tr key={i} className="hover:bg-zinc-800/40">
                    <td className="px-3 py-1.5 border-b border-zinc-800/50">
                      <div className="font-medium text-zinc-200">{gap.fieldLabel}</div>
                      <div className="text-[10px] text-zinc-500">{gap.fieldApiName}</div>
                    </td>
                    <td className="px-3 py-1.5 border-b border-zinc-800/50 text-zinc-300">
                      {gap.permissionSetLabel}
                    </td>
                    <td className="px-3 py-1.5 border-b border-zinc-800/50 text-center">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          gap.gapType === "missing"
                            ? "bg-red-900/50 text-red-300"
                            : "bg-amber-900/50 text-amber-300"
                        }`}
                      >
                        {gap.gapType === "missing" ? "未設定" : "アクセスなし"}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 border-b border-zinc-800/50 text-center">
                      <button
                        onClick={() =>
                          onTogglePermission(gap.fieldQualifiedName, gap.permissionSetId, "read")
                        }
                        className="px-2 py-0.5 text-[10px] rounded bg-sky-800/60 hover:bg-sky-700 text-sky-200 transition-colors"
                      >
                        +Read
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
