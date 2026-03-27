/**
 * 漏れ検出タブ
 * 検出ロジック説明 + gap-detector.ts の detectGaps / summarizeGaps
 */

import { useMemo, type FC } from "react";
import { detectGaps, summarizeGaps } from "../../lib/gap-detector";
import type { PermissionMatrix } from "../../types/permissions";

interface GapDetectionViewProps {
  matrix: PermissionMatrix | null;
}

export const GapDetectionView: FC<GapDetectionViewProps> = ({ matrix }) => {
  const { gaps, summary } = useMemo(() => {
    if (!matrix) return { gaps: [], summary: null };
    const g = detectGaps({
      fields: matrix.fields,
      permissionSets: matrix.permissionSets,
      fieldPermissions: matrix.fieldPermissions,
    });
    return { gaps: g, summary: summarizeGaps(g) };
  }, [matrix]);

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
      {/* ロジック説明バナー */}
      <div className="px-4 py-2 bg-zinc-800/50 border-b border-zinc-700/30">
        <div className="text-xs text-zinc-300 font-medium mb-1">検出ロジック</div>
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          権限セットの最終更新日より<strong className="text-zinc-200">後に</strong>追加・変更されたカスタムフィールドで、
          権限エントリが<strong className="text-amber-300">未設定(missing)</strong>または
          <strong className="text-amber-300">Read/Edit共にOFF(no_access)</strong>のものを検出します。
        </p>
        <p className="text-[10px] text-zinc-500 mt-1">
          目的: View All Fields 後に追加された新規フィールドへの権限付与漏れを防止
        </p>
      </div>

      {/* サマリ or 漏れなし */}
      {gaps.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-3xl mb-2">✅</div>
            <p className="text-sm text-emerald-400">漏れは検出されませんでした</p>
            <p className="text-xs text-zinc-500 mt-1">
              {matrix.fields.filter(f => f.isCustom).length} カスタムフィールド ×{" "}
              {matrix.permissionSets.length} 権限セットをチェック済み
            </p>
          </div>
        </div>
      ) : (
        <>
          {summary && (
            <div className="flex items-center gap-4 px-4 py-2 bg-amber-900/20 border-b border-amber-700/30">
              <span className="text-xs text-amber-300 font-medium">
                {summary.totalGaps} 件の漏れを検出
              </span>
              <span className="text-[10px] text-zinc-400">
                未設定: {summary.byGapType.missing} | アクセスなし: {summary.byGapType.no_access}
              </span>
              <span className="text-[10px] text-zinc-500">
                最大 {summary.maxDaysDiff} 日 | 平均 {summary.avgDaysDiff} 日
              </span>
            </div>
          )}

          <div className="flex-1 overflow-auto">
            <table className="text-xs border-collapse w-full">
              <thead className="sticky top-0 z-10">
                <tr className="bg-zinc-800">
                  <th className="px-3 py-2 text-left text-zinc-400 font-medium border-b border-zinc-700/50">フィールド</th>
                  <th className="px-3 py-2 text-left text-zinc-400 font-medium border-b border-zinc-700/50">権限セット</th>
                  <th className="px-3 py-2 text-center text-zinc-400 font-medium border-b border-zinc-700/50">タイプ</th>
                  <th className="px-3 py-2 text-right text-zinc-400 font-medium border-b border-zinc-700/50">日数差</th>
                </tr>
              </thead>
              <tbody>
                {gaps.map((gap, i) => (
                  <tr key={i} className="hover:bg-zinc-800/40">
                    <td className="px-3 py-1.5 border-b border-zinc-800/50">
                      <div className="font-medium text-zinc-200">{gap.field.label}</div>
                      <div className="text-[10px] text-zinc-500">{gap.field.fieldApiName}</div>
                    </td>
                    <td className="px-3 py-1.5 border-b border-zinc-800/50 text-zinc-300">
                      {gap.permissionSet.label}
                    </td>
                    <td className="px-3 py-1.5 border-b border-zinc-800/50 text-center">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        gap.gapType === "missing"
                          ? "bg-red-900/50 text-red-300"
                          : "bg-amber-900/50 text-amber-300"
                      }`}>
                        {gap.gapType === "missing" ? "未設定" : "アクセスなし"}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 border-b border-zinc-800/50 text-right text-zinc-400">
                      {gap.daysDiff} 日
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
