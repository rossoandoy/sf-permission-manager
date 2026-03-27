/**
 * サイドバー: グループ選択 → PS表示 → オブジェクト一覧
 */

import { useState, useMemo, type FC } from "react";
import type { SfPermissionSetGroup } from "../../types/salesforce";
import type { ObjectInfo, PermissionSetInfo } from "../../types/permissions";

interface ObjectSidebarProps {
  psGroups: SfPermissionSetGroup[];
  selectedGroupId: string | null;
  permissionSets: PermissionSetInfo[];
  selectedPermissionSetIds: string[];
  objects: ObjectInfo[];
  selectedObjectApiName: string | null;
  onSelectGroup: (groupId: string) => void;
  onTogglePermissionSet: (id: string) => void;
  onSelectObject: (apiName: string) => void;
}

export const ObjectSidebar: FC<ObjectSidebarProps> = ({
  psGroups,
  selectedGroupId,
  permissionSets,
  selectedPermissionSetIds,
  objects,
  selectedObjectApiName,
  onSelectGroup,
  onTogglePermissionSet,
  onSelectObject,
}) => {
  const [objectFilter, setObjectFilter] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [sortBy, setSortBy] = useState<"label" | "apiName" | "fieldCount">("label");
  const [nsFilter, setNsFilter] = useState<Record<string, boolean>>({
    MANAERP: true, Custom: true, Standard: true,
  });

  // namespace 別カウント
  const nsCounts = useMemo(() => {
    const counts: Record<string, number> = { MANAERP: 0, Custom: 0, Standard: 0 };
    for (const obj of objects) {
      const ns = obj.namespace;
      if (ns in counts) counts[ns] = (counts[ns] ?? 0) + 1;
    }
    return counts;
  }, [objects]);

  const filteredObjects = useMemo(() => {
    let result = objects;

    // namespace フィルタ
    result = result.filter((o) => nsFilter[o.namespace] !== false);

    if (objectFilter) {
      const lower = objectFilter.toLowerCase();
      result = result.filter(
        (o) =>
          o.apiName.toLowerCase().includes(lower) ||
          o.label.toLowerCase().includes(lower),
      );
    }
    // ソート
    return [...result].sort((a, b) => {
      if (sortBy === "label") return a.label.localeCompare(b.label);
      if (sortBy === "apiName") return a.apiName.localeCompare(b.apiName);
      return b.fieldCount - a.fieldCount; // フィールド数は降順
    });
  }, [objects, objectFilter, sortBy]);

  // namespace グループ化
  const groupedObjects = useMemo(() => {
    const g: Record<string, ObjectInfo[]> = { MANAERP: [], Custom: [], Standard: [] };
    for (const obj of filteredObjects) {
      const group = g[obj.namespace];
      if (group) group.push(obj);
    }
    return g;
  }, [filteredObjects]);

  if (collapsed) {
    return (
      <div className="w-10 bg-zinc-800/50 border-r border-zinc-700/50 flex flex-col items-center pt-2">
        <button
          onClick={() => setCollapsed(false)}
          className="text-zinc-400 hover:text-zinc-200 text-sm"
          title="サイドバーを展開"
        >
          »
        </button>
      </div>
    );
  }

  return (
    <div className="w-[260px] shrink-0 bg-zinc-800/30 border-r border-zinc-700/50 flex flex-col overflow-hidden">
      {/* グループ選択 */}
      <div className="p-2 border-b border-zinc-700/50">
        <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 block">
          権限セットグループ
        </label>
        <select
          value={selectedGroupId ?? ""}
          onChange={(e) => e.target.value && onSelectGroup(e.target.value)}
          className="w-full px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-600/50 rounded text-zinc-200 focus:outline-none focus:border-violet-500/50"
        >
          <option value="">グループを選択...</option>
          {psGroups.map((g) => (
            <option key={g.Id} value={g.Id}>
              {g.MasterLabel}
            </option>
          ))}
        </select>
      </div>

      {/* 含まれるPS */}
      {permissionSets.length > 0 && (
        <div className="p-2 border-b border-zinc-700/50 max-h-40 overflow-y-auto">
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 block">
            含まれるPS ({selectedPermissionSetIds.length}/{permissionSets.length})
          </label>
          {permissionSets.map((ps) => (
            <label
              key={ps.id}
              className="flex items-center gap-1.5 py-0.5 text-xs text-zinc-300 cursor-pointer hover:text-zinc-100"
            >
              <input
                type="checkbox"
                checked={selectedPermissionSetIds.includes(ps.id)}
                onChange={() => onTogglePermissionSet(ps.id)}
                className="w-3 h-3 rounded accent-violet-500"
              />
              <span className="truncate">{ps.label}</span>
            </label>
          ))}
        </div>
      )}

      {/* オブジェクト検索 */}
      {objects.length > 0 && (
        <div className="p-2 border-b border-zinc-700/50">
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={objectFilter}
              onChange={(e) => setObjectFilter(e.target.value)}
              placeholder="オブジェクト検索..."
              className="flex-1 px-2 py-1 text-xs bg-zinc-800 border border-zinc-600/50 rounded text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-violet-500/50"
            />
            <button
              onClick={() => setCollapsed(true)}
              className="px-1 py-1 text-zinc-500 hover:text-zinc-300 text-xs"
              title="折りたたむ"
            >
              «
            </button>
          </div>
          {/* Namespace フィルタ */}
          <div className="mt-1.5 flex items-center gap-2">
            {(["MANAERP", "Custom", "Standard"] as const).map((ns) => (
              <label key={ns} className="flex items-center gap-0.5 text-[10px] text-zinc-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={nsFilter[ns] !== false}
                  onChange={(e) => setNsFilter({ ...nsFilter, [ns]: e.target.checked })}
                  className="w-2.5 h-2.5 rounded accent-violet-500"
                />
                {ns === "MANAERP" ? "ERP" : ns === "Custom" ? "Custom" : "Std"}
                <span className="text-zinc-600">({nsCounts[ns]})</span>
              </label>
            ))}
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[10px] text-zinc-500">
              {filteredObjects.length} / {objects.length} objects
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "label" | "apiName" | "fieldCount")}
              className="text-[10px] bg-transparent text-zinc-500 border-none focus:outline-none cursor-pointer"
            >
              <option value="label">名前順</option>
              <option value="apiName">API名順</option>
              <option value="fieldCount">フィールド数順</option>
            </select>
          </div>
        </div>
      )}

      {/* オブジェクトリスト */}
      <div className="flex-1 overflow-y-auto">
        {(["MANAERP", "Custom", "Standard"] as const).map((ns) => {
          const group = groupedObjects[ns];
          if (!group || group.length === 0) return null;

          const nsIcon = ns === "MANAERP" ? "🟠" : ns === "Custom" ? "🔵" : "🔷";
          const nsLabel = ns === "MANAERP" ? "MANABIE ERP" : ns;

          return (
            <div key={ns}>
              <div className="px-2 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1 bg-zinc-800/40">
                <span>{nsIcon}</span>
                {nsLabel} ({group.length})
              </div>
              {group.map((obj) => {
                const isSelected = obj.apiName === selectedObjectApiName;
                return (
                  <button
                    key={obj.apiName}
                    onClick={() => onSelectObject(obj.apiName)}
                    className={`w-full text-left px-2 py-1.5 transition-colors ${
                      isSelected
                        ? "bg-violet-600/20 border-l-2 border-violet-500"
                        : "hover:bg-zinc-700/50 border-l-2 border-transparent"
                    }`}
                  >
                    <span className={`text-xs font-medium ${isSelected ? "text-violet-200" : "text-zinc-200"}`}>
                      {obj.label}
                    </span>
                    <div className="text-[10px] text-zinc-500">{obj.apiName}</div>
                    <div className="text-[10px] text-zinc-600">{obj.fieldCount} fields</div>
                  </button>
                );
              })}
            </div>
          );
        })}

        {objects.length === 0 && selectedGroupId && (
          <div className="px-3 py-6 text-xs text-zinc-500 text-center">
            グループを選択してください
          </div>
        )}
      </div>
    </div>
  );
};
