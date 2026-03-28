/**
 * 漏れ検出タブ — 強化版
 * 日付情報・型バッジ・Read+Edit付与・フィルタ・ソート
 */

import { useState, useMemo, type FC } from "react";
import type { PermissionMatrix } from "../../types/permissions";
import { FieldTypeBadge } from "./FieldTypeBadge";

interface GapItem {
  fieldQualifiedName: string;
  fieldLabel: string;
  fieldApiName: string;
  fieldType: string;
  fieldCreatedDate: string;
  fieldLastModified: string;
  /** Edit権限の設定が可能か（数式フィールド等はfalse） */
  updateable: boolean;
  permissionSetId: string;
  permissionSetLabel: string;
  permissionSetLastModified: string;
  gapType: "missing" | "no_access";
  isNewerThanPs: boolean;
  daysDiff: number;
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

type SortKey = "field" | "permissionSet" | "daysDiff" | "type";
type FilterType = "all" | "missing" | "no_access";

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

export const GapDetectionView: FC<GapDetectionViewProps> = ({
  matrix,
  onTogglePermission,
  pendingCount,
}) => {
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [sortKey, setSortKey] = useState<SortKey>("daysDiff");
  const [fieldSearch, setFieldSearch] = useState("");

  const allGaps = useMemo(() => {
    if (!matrix) return [];
    const result: GapItem[] = [];

    for (const field of matrix.fields) {
      // カスタムフィールドかつFLS設定可能なもののみ対象
      if (!field.isCustom || !field.permissionable) continue;
      for (const ps of matrix.permissionSets) {
        const perm = matrix.fieldPermissions[field.qualifiedApiName]?.[ps.id];
        const isMissing = !perm;
        const isNoAccess = perm ? !perm.read && !perm.edit : false;
        if (!isMissing && !isNoAccess) continue;

        const fieldDate = field.createdDate ? new Date(field.createdDate).getTime() : 0;
        const psDate = ps.lastModified ? new Date(ps.lastModified).getTime() : 0;
        const isNewerThanPs = fieldDate > 0 && psDate > 0 && fieldDate > psDate;
        const daysDiff = fieldDate > 0 && psDate > 0
          ? Math.floor((fieldDate - psDate) / (1000 * 60 * 60 * 24))
          : 0;

        result.push({
          fieldQualifiedName: field.qualifiedApiName,
          fieldLabel: field.label,
          fieldApiName: field.fieldApiName,
          fieldType: field.dataType,
          fieldCreatedDate: field.createdDate,
          fieldLastModified: field.lastModified,
          updateable: field.updateable,
          permissionSetId: ps.id,
          permissionSetLabel: ps.label,
          permissionSetLastModified: ps.lastModified,
          gapType: isMissing ? "missing" : "no_access",
          isNewerThanPs,
          daysDiff,
        });
      }
    }
    return result;
  }, [matrix]);

  const filteredGaps = useMemo(() => {
    let result = allGaps;
    if (filterType !== "all") {
      result = result.filter((g) => g.gapType === filterType);
    }
    if (fieldSearch) {
      const lower = fieldSearch.toLowerCase();
      result = result.filter(
        (g) =>
          g.fieldLabel.toLowerCase().includes(lower) ||
          g.fieldApiName.toLowerCase().includes(lower),
      );
    }
    result = [...result].sort((a, b) => {
      if (sortKey === "daysDiff") return b.daysDiff - a.daysDiff;
      if (sortKey === "field") return a.fieldLabel.localeCompare(b.fieldLabel);
      if (sortKey === "permissionSet") return a.permissionSetLabel.localeCompare(b.permissionSetLabel);
      return a.gapType.localeCompare(b.gapType);
    });
    return result;
  }, [allGaps, filterType, sortKey, fieldSearch]);

  const missingCount = allGaps.filter((g) => g.gapType === "missing").length;
  const noAccessCount = allGaps.filter((g) => g.gapType === "no_access").length;
  const newerCount = allGaps.filter((g) => g.isNewerThanPs).length;

  const handleBulkRead = () => {
    for (const gap of filteredGaps) {
      onTogglePermission(gap.fieldQualifiedName, gap.permissionSetId, "read");
    }
  };

  const handleBulkReadEdit = () => {
    for (const gap of filteredGaps) {
      onTogglePermission(gap.fieldQualifiedName, gap.permissionSetId, "read");
      onTogglePermission(gap.fieldQualifiedName, gap.permissionSetId, "edit");
    }
  };

  if (!matrix) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-zinc-500">オブジェクトを選択すると漏れ検出結果が表示されます</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* ロジック説明 */}
      <div className="px-4 py-2 bg-zinc-800/50 border-b border-zinc-700/30">
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          FLS設定可能なカスタムフィールド（数式・自動番号等を除く）で FLS が
          <strong className="text-red-300"> 未設定</strong> または
          <strong className="text-amber-300"> R/E共にOFF</strong> のものを検出。
          {newerCount > 0 && (
            <span className="text-sky-300"> {newerCount}件はPS更新後に作成されたフィールド。</span>
          )}
        </p>
      </div>

      {allGaps.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-sm text-emerald-400 font-medium">漏れは検出されませんでした</p>
          </div>
        </div>
      ) : (
        <>
          {/* ツールバー */}
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-900/15 border-b border-amber-700/30">
            <span className="text-xs text-amber-300 font-medium shrink-0">
              {allGaps.length}件検出
            </span>
            <span className="text-[10px] text-zinc-500 shrink-0">
              未設定:{missingCount} アクセスなし:{noAccessCount}
            </span>

            <div className="flex-1" />

            {/* フィルタ */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as FilterType)}
              className="px-1.5 py-0.5 text-[10px] bg-zinc-800 border border-zinc-600/50 rounded text-zinc-300"
            >
              <option value="all">全て</option>
              <option value="missing">未設定のみ</option>
              <option value="no_access">アクセスなしのみ</option>
            </select>

            {/* ソート */}
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="px-1.5 py-0.5 text-[10px] bg-zinc-800 border border-zinc-600/50 rounded text-zinc-300"
            >
              <option value="daysDiff">日数差順</option>
              <option value="field">フィールド名順</option>
              <option value="permissionSet">権限セット順</option>
              <option value="type">タイプ順</option>
            </select>

            {/* 検索 */}
            <input
              type="text"
              value={fieldSearch}
              onChange={(e) => setFieldSearch(e.target.value)}
              placeholder="フィールド検索..."
              className="w-28 px-1.5 py-0.5 text-[10px] bg-zinc-800 border border-zinc-600/50 rounded text-zinc-200 placeholder-zinc-500"
            />

            {/* 一括ボタン */}
            <button
              onClick={handleBulkRead}
              className="px-2 py-0.5 text-[10px] font-medium rounded bg-sky-700 hover:bg-sky-600 text-white transition-colors shrink-0"
            >
              全Read ON
            </button>
            <button
              onClick={handleBulkReadEdit}
              className="px-2 py-0.5 text-[10px] font-medium rounded bg-violet-700 hover:bg-violet-600 text-white transition-colors shrink-0"
            >
              全R+E ON
            </button>
          </div>

          {pendingCount > 0 && (
            <div className="px-4 py-1 bg-violet-900/20 border-b border-violet-700/30">
              <span className="text-[10px] text-violet-300">
                {pendingCount}件の変更あり → マトリクスタブで保存
              </span>
            </div>
          )}

          {/* テーブル */}
          <div className="flex-1 overflow-auto">
            <table className="text-xs border-collapse w-full">
              <thead className="sticky top-0 z-10">
                <tr className="bg-zinc-800">
                  <th className="px-3 py-1.5 text-left text-zinc-400 font-medium border-b border-zinc-700/50">フィールド</th>
                  <th className="px-2 py-1.5 text-center text-zinc-400 font-medium border-b border-zinc-700/50 w-16">型</th>
                  <th className="px-3 py-1.5 text-left text-zinc-400 font-medium border-b border-zinc-700/50">権限セット</th>
                  <th className="px-2 py-1.5 text-center text-zinc-400 font-medium border-b border-zinc-700/50 w-16">タイプ</th>
                  <th className="px-2 py-1.5 text-center text-zinc-400 font-medium border-b border-zinc-700/50 w-20">フィールド作成</th>
                  <th className="px-2 py-1.5 text-center text-zinc-400 font-medium border-b border-zinc-700/50 w-20">PS更新</th>
                  <th className="px-2 py-1.5 text-center text-zinc-400 font-medium border-b border-zinc-700/50 w-12">差</th>
                  <th className="px-2 py-1.5 text-center text-zinc-400 font-medium border-b border-zinc-700/50 w-28">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredGaps.map((gap, i) => (
                  <tr
                    key={i}
                    className={`hover:bg-zinc-800/40 ${gap.isNewerThanPs ? "bg-sky-900/10" : ""}`}
                  >
                    <td className="px-3 py-1.5 border-b border-zinc-800/50">
                      <div className="font-medium text-zinc-200">{gap.fieldLabel}</div>
                      <div className="text-[10px] text-zinc-500">{gap.fieldApiName}</div>
                    </td>
                    <td className="px-2 py-1.5 border-b border-zinc-800/50 text-center">
                      <FieldTypeBadge dataType={gap.fieldType} />
                    </td>
                    <td className="px-3 py-1.5 border-b border-zinc-800/50 text-zinc-300 text-[11px]">
                      {gap.permissionSetLabel}
                    </td>
                    <td className="px-2 py-1.5 border-b border-zinc-800/50 text-center">
                      <span className={`inline-block px-1 py-0.5 rounded text-[9px] font-medium ${
                        gap.gapType === "missing"
                          ? "bg-red-900/50 text-red-300"
                          : "bg-amber-900/50 text-amber-300"
                      }`}>
                        {gap.gapType === "missing" ? "未設定" : "OFF"}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 border-b border-zinc-800/50 text-center text-[10px] text-zinc-400">
                      {formatDate(gap.fieldCreatedDate)}
                    </td>
                    <td className="px-2 py-1.5 border-b border-zinc-800/50 text-center text-[10px] text-zinc-400">
                      {formatDate(gap.permissionSetLastModified)}
                    </td>
                    <td className="px-2 py-1.5 border-b border-zinc-800/50 text-center text-[10px]">
                      {gap.daysDiff > 0 ? (
                        <span className="text-sky-300 font-medium">+{gap.daysDiff}d</span>
                      ) : gap.daysDiff < 0 ? (
                        <span className="text-zinc-500">{gap.daysDiff}d</span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 border-b border-zinc-800/50 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onTogglePermission(gap.fieldQualifiedName, gap.permissionSetId, "read")}
                          className="px-1.5 py-0.5 text-[9px] rounded bg-sky-800/60 hover:bg-sky-700 text-sky-200 transition-colors"
                        >
                          +R
                        </button>
                        {gap.updateable && (
                          <button
                            onClick={() => onTogglePermission(gap.fieldQualifiedName, gap.permissionSetId, "edit")}
                            className="px-1.5 py-0.5 text-[9px] rounded bg-emerald-800/60 hover:bg-emerald-700 text-emerald-200 transition-colors"
                          >
                            +E
                          </button>
                        )}
                        {gap.updateable && (
                          <button
                            onClick={() => {
                              onTogglePermission(gap.fieldQualifiedName, gap.permissionSetId, "read");
                              onTogglePermission(gap.fieldQualifiedName, gap.permissionSetId, "edit");
                            }}
                            className="px-1.5 py-0.5 text-[9px] rounded bg-violet-800/60 hover:bg-violet-700 text-violet-200 transition-colors"
                          >
                            +R+E
                          </button>
                        )}
                      </div>
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
