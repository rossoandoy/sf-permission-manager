/**
 * 差分比較タブ
 * モード1: 権限セット同士（グループ外PSも選択可）
 * モード2: 権限セットグループ同士（将来）
 */

import { useState, useMemo, useEffect, type FC } from "react";
import { computeDiff } from "../../lib/permission-utils";
import { getPermissionSets, getFieldPermissions } from "../../lib/messaging";
import { buildFieldPermissionMatrix } from "../../lib/permission-utils";
import type { PermissionMatrix, PermissionSetInfo, FieldPermissionEntry } from "../../types/permissions";

interface DiffViewProps {
  matrix: PermissionMatrix | null;
  allPermissionSets: PermissionSetInfo[];
  hostname: string | null;
}

export const DiffView: FC<DiffViewProps> = ({ matrix, allPermissionSets, hostname }) => {
  const [psAId, setPsAId] = useState<string>("");
  const [psBId, setPsBId] = useState<string>("");
  const [allOrgPs, setAllOrgPs] = useState<PermissionSetInfo[]>([]);
  const [loadingPs, setLoadingPs] = useState(false);
  const [showAllPs, setShowAllPs] = useState(false);
  // PS B 用の追加権限データ（グループ外PSの場合）
  const [externalPerms, setExternalPerms] = useState<Record<string, Record<string, FieldPermissionEntry>>>({});

  // 全org PS を取得（「全PS表示」トグル時）
  useEffect(() => {
    if (!showAllPs || !hostname || allOrgPs.length > 0) return;
    setLoadingPs(true);
    getPermissionSets(hostname)
      .then((ps) => setAllOrgPs(ps))
      .catch(() => {})
      .finally(() => setLoadingPs(false));
  }, [showAllPs, hostname, allOrgPs.length]);

  // 選択可能なPS一覧
  const selectablePs = useMemo(() => {
    if (showAllPs && allOrgPs.length > 0) return allOrgPs;
    return allPermissionSets;
  }, [showAllPs, allOrgPs, allPermissionSets]);

  const psA = selectablePs.find((ps) => ps.id === psAId) ?? null;
  const psB = selectablePs.find((ps) => ps.id === psBId) ?? null;

  // グループ外PSが選ばれた場合、そのPSの権限データを取得
  useEffect(() => {
    if (!hostname || !matrix || !psBId) return;
    const isInGroup = allPermissionSets.some((ps) => ps.id === psBId);
    if (isInGroup) return; // グループ内なら matrix に含まれている

    const objectApiName = matrix.object.apiName;
    getFieldPermissions(hostname, objectApiName, [psBId])
      .then((perms) => {
        const permMap = buildFieldPermissionMatrix(perms);
        setExternalPerms(permMap);
      })
      .catch(() => {});
  }, [hostname, matrix, psBId, allPermissionSets]);

  // 差分計算（グループ外PSの権限データをマージ）
  const diffs = useMemo(() => {
    if (!matrix || !psA || !psB || psA.id === psB.id) return [];

    // PS B がグループ外の場合、externalPerms をマージ
    const isInGroup = allPermissionSets.some((ps) => ps.id === psBId);
    const mergedPerms = isInGroup
      ? matrix.fieldPermissions
      : mergePermissions(matrix.fieldPermissions, externalPerms);

    return computeDiff(matrix.fields, psA, psB, mergedPerms);
  }, [matrix, psA, psB, allPermissionSets, psBId, externalPerms]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* ツールバー */}
      <div className="flex items-center gap-3 px-4 py-2 bg-zinc-800/30 border-b border-zinc-700/30 flex-wrap">
        <label className="text-xs text-zinc-400">比較:</label>
        <select
          value={psAId}
          onChange={(e) => setPsAId(e.target.value)}
          className="px-2 py-1 text-xs bg-zinc-800 border border-zinc-600/50 rounded text-zinc-200 focus:outline-none focus:border-violet-500/50 max-w-[220px]"
        >
          <option value="">PS A を選択</option>
          {selectablePs.map((ps) => (
            <option key={ps.id} value={ps.id}>{ps.label}</option>
          ))}
        </select>
        <span className="text-zinc-500 text-xs">vs</span>
        <select
          value={psBId}
          onChange={(e) => setPsBId(e.target.value)}
          className="px-2 py-1 text-xs bg-zinc-800 border border-zinc-600/50 rounded text-zinc-200 focus:outline-none focus:border-violet-500/50 max-w-[220px]"
        >
          <option value="">PS B を選択</option>
          {selectablePs.filter((ps) => ps.id !== psAId).map((ps) => (
            <option key={ps.id} value={ps.id}>{ps.label}</option>
          ))}
        </select>

        <div className="flex-1" />

        {/* 全PS表示トグル */}
        <label className="flex items-center gap-1.5 text-[10px] text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={showAllPs}
            onChange={(e) => setShowAllPs(e.target.checked)}
            className="w-3 h-3 rounded accent-violet-500"
          />
          全PS表示
          {loadingPs && <span className="text-zinc-500">(読込中...)</span>}
        </label>

        {diffs.length > 0 && (
          <span className="text-xs text-amber-300">{diffs.length} 件の差分</span>
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

// --- ヘルパー ---

const PermBadge: FC<{ value: boolean }> = ({ value }) => (
  <span
    className={`inline-block w-5 h-5 rounded-[3px] text-center leading-5 text-[10px] font-bold ${
      value ? "bg-sky-600 text-white" : "bg-zinc-700 text-zinc-500"
    }`}
  >
    {value ? "✓" : "–"}
  </span>
);

/** 2つの権限マップをマージ */
function mergePermissions(
  base: Record<string, Record<string, FieldPermissionEntry>>,
  additional: Record<string, Record<string, FieldPermissionEntry>>,
): Record<string, Record<string, FieldPermissionEntry>> {
  const merged = { ...base };
  for (const [field, psMap] of Object.entries(additional)) {
    if (!merged[field]) merged[field] = {};
    merged[field] = { ...merged[field], ...psMap };
  }
  return merged;
}
