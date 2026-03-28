/**
 * 差分比較タブ
 * モード1: 権限セット同士（グループ外PSも選択可）
 * モード2: 権限セットグループ同士（合算権限を比較）
 */

import { useState, useMemo, useEffect, type FC } from "react";
import { computeDiff, buildFieldPermissionMatrix } from "../../lib/permission-utils";
import {
  getPermissionSets,
  getFieldPermissions,
  getPsGroups,
  getPsGroupComponents,
} from "../../lib/messaging";
import type {
  PermissionMatrix,
  PermissionSetInfo,
  FieldPermissionEntry,
  DiffResult,
} from "../../types/permissions";
import type { SfPermissionSetGroup } from "../../types/salesforce";

type DiffMode = "ps" | "group";

interface DiffViewProps {
  matrix: PermissionMatrix | null;
  allPermissionSets: PermissionSetInfo[];
  hostname: string | null;
}

export const DiffView: FC<DiffViewProps> = ({ matrix, allPermissionSets, hostname }) => {
  const [mode, setMode] = useState<DiffMode>("ps");

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* モード切替 */}
      <div className="flex items-center gap-2 px-4 py-1.5 bg-zinc-800/50 border-b border-zinc-700/30">
        <span className="text-[10px] text-zinc-500">比較モード:</span>
        <button
          onClick={() => setMode("ps")}
          className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
            mode === "ps"
              ? "bg-violet-600 text-white"
              : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
          }`}
        >
          権限セット同士
        </button>
        <button
          onClick={() => setMode("group")}
          className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
            mode === "group"
              ? "bg-violet-600 text-white"
              : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
          }`}
        >
          グループ同士
        </button>
      </div>

      {mode === "ps" ? (
        <PsDiffView matrix={matrix} allPermissionSets={allPermissionSets} hostname={hostname} />
      ) : (
        <GroupDiffView matrix={matrix} hostname={hostname} />
      )}
    </div>
  );
};

// ===========================================
// 権限セット同士の比較
// ===========================================

const PsDiffView: FC<{
  matrix: PermissionMatrix | null;
  allPermissionSets: PermissionSetInfo[];
  hostname: string | null;
}> = ({ matrix, allPermissionSets, hostname }) => {
  const [psAId, setPsAId] = useState("");
  const [psBId, setPsBId] = useState("");
  const [allOrgPs, setAllOrgPs] = useState<PermissionSetInfo[]>([]);
  const [loadingPs, setLoadingPs] = useState(false);
  const [showAllPs, setShowAllPs] = useState(false);
  const [externalPerms, setExternalPerms] = useState<Record<string, Record<string, FieldPermissionEntry>>>({});

  useEffect(() => {
    if (!showAllPs || !hostname || allOrgPs.length > 0) return;
    setLoadingPs(true);
    getPermissionSets(hostname).then(setAllOrgPs).catch(() => {}).finally(() => setLoadingPs(false));
  }, [showAllPs, hostname, allOrgPs.length]);

  const selectablePs = useMemo(() => {
    if (showAllPs && allOrgPs.length > 0) return allOrgPs;
    return allPermissionSets;
  }, [showAllPs, allOrgPs, allPermissionSets]);

  const psA = selectablePs.find((ps) => ps.id === psAId) ?? null;
  const psB = selectablePs.find((ps) => ps.id === psBId) ?? null;

  useEffect(() => {
    if (!hostname || !matrix || !psBId) return;
    const isInGroup = allPermissionSets.some((ps) => ps.id === psBId);
    if (isInGroup) return;
    getFieldPermissions(hostname, matrix.object.apiName, [psBId])
      .then((perms) => setExternalPerms(buildFieldPermissionMatrix(perms)))
      .catch(() => {});
  }, [hostname, matrix, psBId, allPermissionSets]);

  const diffs = useMemo(() => {
    if (!matrix || !psA || !psB || psA.id === psB.id) return [];
    const isInGroup = allPermissionSets.some((ps) => ps.id === psBId);
    const merged = isInGroup ? matrix.fieldPermissions : mergePermissions(matrix.fieldPermissions, externalPerms);
    return computeDiff(matrix.fields, psA, psB, merged);
  }, [matrix, psA, psB, allPermissionSets, psBId, externalPerms]);

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-2 bg-zinc-800/30 border-b border-zinc-700/30 flex-wrap">
        <select
          value={psAId}
          onChange={(e) => setPsAId(e.target.value)}
          className="px-2 py-1 text-xs bg-zinc-800 border border-zinc-600/50 rounded text-zinc-200 max-w-[220px]"
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
          className="px-2 py-1 text-xs bg-zinc-800 border border-zinc-600/50 rounded text-zinc-200 max-w-[220px]"
        >
          <option value="">PS B を選択</option>
          {selectablePs.filter((ps) => ps.id !== psAId).map((ps) => (
            <option key={ps.id} value={ps.id}>{ps.label}</option>
          ))}
        </select>
        <div className="flex-1" />
        <label className="flex items-center gap-1.5 text-[10px] text-zinc-400 cursor-pointer">
          <input type="checkbox" checked={showAllPs} onChange={(e) => setShowAllPs(e.target.checked)} className="w-3 h-3 rounded accent-violet-500" />
          全PS表示{loadingPs && " (読込中...)"}
        </label>
        {diffs.length > 0 && <span className="text-xs text-amber-300">{diffs.length} 件の差分</span>}
      </div>
      <DiffTable matrix={matrix} diffs={diffs} labelA={psA?.label ?? ""} labelB={psB?.label ?? ""} />
    </>
  );
};

// ===========================================
// 権限セットグループ同士の比較
// ===========================================

const GroupDiffView: FC<{
  matrix: PermissionMatrix | null;
  hostname: string | null;
}> = ({ matrix, hostname }) => {
  const [groups, setGroups] = useState<SfPermissionSetGroup[]>([]);
  const [groupAId, setGroupAId] = useState("");
  const [groupBId, setGroupBId] = useState("");
  const [loading, setLoading] = useState(false);
  const [groupAPerms, setGroupAPerms] = useState<Record<string, Record<string, FieldPermissionEntry>>>({});
  const [groupBPerms, setGroupBPerms] = useState<Record<string, Record<string, FieldPermissionEntry>>>({});
  const [groupALabel, setGroupALabel] = useState("");
  const [groupBLabel, setGroupBLabel] = useState("");

  // グループ一覧取得
  useEffect(() => {
    if (!hostname) return;
    getPsGroups(hostname).then(setGroups).catch(() => {});
  }, [hostname]);

  // グループA選択 → 合算権限取得
  useEffect(() => {
    if (!hostname || !groupAId || !matrix) return;
    setLoading(true);
    const label = groups.find((g) => g.Id === groupAId)?.MasterLabel ?? "";
    setGroupALabel(label);
    fetchGroupMergedPerms(hostname, groupAId, matrix.object.apiName)
      .then(setGroupAPerms)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [hostname, groupAId, matrix, groups]);

  // グループB選択 → 合算権限取得
  useEffect(() => {
    if (!hostname || !groupBId || !matrix) return;
    setLoading(true);
    const label = groups.find((g) => g.Id === groupBId)?.MasterLabel ?? "";
    setGroupBLabel(label);
    fetchGroupMergedPerms(hostname, groupBId, matrix.object.apiName)
      .then(setGroupBPerms)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [hostname, groupBId, matrix, groups]);

  // 合算権限を仮想PS として差分計算
  const diffs = useMemo(() => {
    if (!matrix || !groupAId || !groupBId || groupAId === groupBId) return [];
    const virtualPsA: PermissionSetInfo = { id: `group:${groupAId}`, name: groupALabel, label: groupALabel, description: null, lastModified: "", isCustom: true, namespace: null };
    const virtualPsB: PermissionSetInfo = { id: `group:${groupBId}`, name: groupBLabel, label: groupBLabel, description: null, lastModified: "", isCustom: true, namespace: null };
    const merged = mergePermissions(groupAPerms, groupBPerms);
    return computeDiff(matrix.fields, virtualPsA, virtualPsB, merged);
  }, [matrix, groupAId, groupBId, groupAPerms, groupBPerms, groupALabel, groupBLabel]);

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-2 bg-zinc-800/30 border-b border-zinc-700/30 flex-wrap">
        <select
          value={groupAId}
          onChange={(e) => setGroupAId(e.target.value)}
          className="px-2 py-1 text-xs bg-zinc-800 border border-zinc-600/50 rounded text-zinc-200 max-w-[220px]"
        >
          <option value="">グループ A を選択</option>
          {groups.map((g) => (
            <option key={g.Id} value={g.Id}>{g.MasterLabel}</option>
          ))}
        </select>
        <span className="text-zinc-500 text-xs">vs</span>
        <select
          value={groupBId}
          onChange={(e) => setGroupBId(e.target.value)}
          className="px-2 py-1 text-xs bg-zinc-800 border border-zinc-600/50 rounded text-zinc-200 max-w-[220px]"
        >
          <option value="">グループ B を選択</option>
          {groups.filter((g) => g.Id !== groupAId).map((g) => (
            <option key={g.Id} value={g.Id}>{g.MasterLabel}</option>
          ))}
        </select>
        <div className="flex-1" />
        {loading && <span className="text-[10px] text-zinc-500 animate-pulse">権限データ取得中...</span>}
        {diffs.length > 0 && <span className="text-xs text-amber-300">{diffs.length} 件の差分</span>}
      </div>
      <div className="px-4 py-1 bg-zinc-800/20 border-b border-zinc-700/20">
        <span className="text-[10px] text-zinc-500">
          グループ内の全PSの権限をOR合算して比較します（いずれかのPSでR/Eが付与されていればON）
        </span>
      </div>
      <DiffTable
        matrix={matrix}
        diffs={diffs}
        labelA={groupALabel || "グループ A"}
        labelB={groupBLabel || "グループ B"}
      />
    </>
  );
};

// ===========================================
// 共通: 差分テーブル
// ===========================================

const DiffTable: FC<{
  matrix: PermissionMatrix | null;
  diffs: DiffResult[];
  labelA: string;
  labelB: string;
}> = ({ matrix, diffs, labelA, labelB }) => {
  if (!matrix) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-zinc-500">オブジェクトを選択すると差分比較ができます</p>
      </div>
    );
  }

  if (!labelA || !labelB) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-zinc-500">2つの比較対象を選択してください</p>
      </div>
    );
  }

  if (diffs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl mb-2">✅</div>
          <p className="text-sm text-emerald-400">差分はありません</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="text-xs border-collapse w-full">
        <thead className="sticky top-0 z-10">
          <tr className="bg-zinc-800">
            <th className="px-3 py-2 text-left text-zinc-400 font-medium border-b border-zinc-700/50">フィールド</th>
            <th className="px-3 py-2 text-center text-zinc-400 font-medium border-b border-zinc-700/50" colSpan={2}>{labelA}</th>
            <th className="px-3 py-2 text-center text-zinc-400 font-medium border-b border-zinc-700/50" colSpan={2}>{labelB}</th>
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
              <td className="px-2 py-1.5 border-b border-zinc-800/50 text-center"><PermBadge value={diff.permissionSetA.read} /></td>
              <td className="px-2 py-1.5 border-b border-zinc-800/50 text-center"><PermBadge value={diff.permissionSetA.edit} /></td>
              <td className="px-2 py-1.5 border-b border-zinc-800/50 text-center"><PermBadge value={diff.permissionSetB.read} /></td>
              <td className="px-2 py-1.5 border-b border-zinc-800/50 text-center"><PermBadge value={diff.permissionSetB.edit} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ===========================================
// ヘルパー
// ===========================================

const PermBadge: FC<{ value: boolean }> = ({ value }) => (
  <span className={`inline-block w-5 h-5 rounded-[3px] text-center leading-5 text-[10px] font-bold ${value ? "bg-sky-600 text-white" : "bg-zinc-700 text-zinc-500"}`}>
    {value ? "✓" : "–"}
  </span>
);

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

/**
 * グループの全PSの権限をOR合算して仮想的な1つのPS権限として返す
 */
async function fetchGroupMergedPerms(
  hostname: string,
  groupId: string,
  objectApiName: string,
): Promise<Record<string, Record<string, FieldPermissionEntry>>> {
  const { permissionSetIds } = await getPsGroupComponents(hostname, groupId);
  if (permissionSetIds.length === 0) return {};

  const perms = await getFieldPermissions(hostname, objectApiName, permissionSetIds);
  const matrix = buildFieldPermissionMatrix(perms);

  // OR合算: いずれかのPSでR/EがONならONとする仮想PS
  const virtualPsId = `group:${groupId}`;
  const merged: Record<string, Record<string, FieldPermissionEntry>> = {};

  for (const [fieldKey, psMap] of Object.entries(matrix)) {
    let read = false;
    let edit = false;
    for (const entry of Object.values(psMap)) {
      if (entry.read) read = true;
      if (entry.edit) edit = true;
    }
    merged[fieldKey] = {
      [virtualPsId]: {
        sfId: null,
        permissionSetId: virtualPsId,
        objectApiName,
        fieldQualifiedName: fieldKey,
        read,
        edit,
      },
    };
  }

  return merged;
}
