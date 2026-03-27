/**
 * 差分比較タブ
 * 全権限セットから2つを選んで比較
 */

import { useState, useMemo, type FC } from "react";
import { computeDiff } from "../../lib/permission-utils";
import type { PermissionMatrix, PermissionSetInfo } from "../../types/permissions";

interface DiffViewProps {
  matrix: PermissionMatrix | null;
  /** グループに含まれる全権限セット（サイドバーの選択に関係なく） */
  allPermissionSets: PermissionSetInfo[];
}

export const DiffView: FC<DiffViewProps> = ({ matrix, allPermissionSets }) => {
  const [psAId, setPsAId] = useState<string>("");
  const [psBId, setPsBId] = useState<string>("");

  const psA = allPermissionSets.find((ps) => ps.id === psAId) ?? null;
  const psB = allPermissionSets.find((ps) => ps.id === psBId) ?? null;

  const diffs = useMemo(() => {
    if (!matrix || !psA || !psB || psA.id === psB.id) return [];
    return computeDiff(matrix.fields, psA, psB, matrix.fieldPermissions);
  }, [matrix, psA, psB]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* PS選択 */}
      <div className="flex items-center gap-3 px-4 py-2 bg-zinc-800/30 border-b border-zinc-700/30">
        <label className="text-xs text-zinc-400">比較:</label>
        <select
          value={psAId}
          onChange={(e) => setPsAId(e.target.value)}
          className="px-2 py-1 text-xs bg-zinc-800 border border-zinc-600/50 rounded text-zinc-200 focus:outline-none focus:border-violet-500/50 max-w-[200px]"
        >
          <option value="">PS A を選択</option>
          {allPermissionSets.map((ps) => (
            <option key={ps.id} value={ps.id}>{ps.label}</option>
          ))}
        </select>
        <span className="text-zinc-500 text-xs">vs</span>
        <select
          value={psBId}
          onChange={(e) => setPsBId(e.target.value)}
          className="px-2 py-1 text-xs bg-zinc-800 border border-zinc-600/50 rounded text-zinc-200 focus:outline-none focus:border-violet-500/50 max-w-[200px]"
        >
          <option value="">PS B を選択</option>
          {allPermissionSets.filter((ps) => ps.id !== psAId).map((ps) => (
            <option key={ps.id} value={ps.id}>{ps.label}</option>
          ))}
        </select>
        {diffs.length > 0 && (
          <span className="text-xs text-amber-300 ml-auto">{diffs.length} 件の差分</span>
        )}
      </div>

      {!matrix && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-zinc-500">
            オブジェクトを選択すると差分比較ができます
          </p>
        </div>
      )}

      {matrix && psA && psB && psA.id !== psB.id ? (
        diffs.length > 0 ? (
          <div className="flex-1 overflow-auto">
            <table className="text-xs border-collapse w-full">
              <thead className="sticky top-0 z-10">
                <tr className="bg-zinc-800">
                  <th className="px-3 py-2 text-left text-zinc-400 font-medium border-b border-zinc-700/50">
                    フィールド
                  </th>
                  <th className="px-3 py-2 text-center text-zinc-400 font-medium border-b border-zinc-700/50" colSpan={2}>
                    {psA.label}
                  </th>
                  <th className="px-3 py-2 text-center text-zinc-400 font-medium border-b border-zinc-700/50" colSpan={2}>
                    {psB.label}
                  </th>
                </tr>
                <tr className="bg-zinc-800/80">
                  <th className="border-b border-zinc-700/50" />
                  <th className="px-2 py-1 text-[10px] text-zinc-500 border-b border-zinc-700/50">R</th>
                  <th className="px-2 py-1 text-[10px] text-zinc-500 border-b border-zinc-700/50">E</th>
                  <th className="px-2 py-1 text-[10px] text-zinc-500 border-b border-zinc-700/50">R</th>
                  <th className="px-2 py-1 text-[10px] text-zinc-500 border-b border-zinc-700/50">E</th>
                </tr>
              </thead>
              <tbody>
                {diffs.map((diff) => (
                  <tr key={diff.field.qualifiedApiName} className="hover:bg-zinc-800/40">
                    <td className="px-3 py-1.5 border-b border-zinc-800/50">
                      <div className="font-medium text-zinc-200">{diff.field.label}</div>
                      <div className="text-[10px] text-zinc-500">{diff.field.fieldApiName}</div>
                    </td>
                    <td className="px-2 py-1.5 border-b border-zinc-800/50 text-center">
                      <PermBadge value={diff.permissionSetA.read} />
                    </td>
                    <td className="px-2 py-1.5 border-b border-zinc-800/50 text-center">
                      <PermBadge value={diff.permissionSetA.edit} />
                    </td>
                    <td className="px-2 py-1.5 border-b border-zinc-800/50 text-center">
                      <PermBadge value={diff.permissionSetB.read} />
                    </td>
                    <td className="px-2 py-1.5 border-b border-zinc-800/50 text-center">
                      <PermBadge value={diff.permissionSetB.edit} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl mb-2">✅</div>
              <p className="text-sm text-emerald-400">差分はありません</p>
            </div>
          </div>
        )
      ) : matrix ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-zinc-500">
            2つの異なる権限セットを選択してください
          </p>
        </div>
      ) : null}
    </div>
  );
};

const PermBadge: FC<{ value: boolean }> = ({ value }) => (
  <span
    className={`inline-block w-5 h-5 rounded-[3px] text-center leading-5 text-[10px] font-bold ${
      value ? "bg-sky-600 text-white" : "bg-zinc-700 text-zinc-500"
    }`}
  >
    {value ? "✓" : "–"}
  </span>
);
