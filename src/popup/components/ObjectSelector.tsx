/**
 * オブジェクト選択 + 権限セット選択コンポーネント
 */

import { useState, useMemo, type FC } from "react";
import type { ObjectInfo, PermissionSetInfo } from "../../types/permissions";

interface ObjectSelectorProps {
  objects: ObjectInfo[];
  permissionSets: PermissionSetInfo[];
  selectedObjectApiName: string | null;
  selectedPermissionSetIds: string[];
  onSelectObject: (apiName: string) => void;
  onSelectPermissionSets: (ids: string[]) => void;
}

export const ObjectSelector: FC<ObjectSelectorProps> = ({
  objects,
  permissionSets,
  selectedObjectApiName,
  selectedPermissionSetIds,
  onSelectObject,
  onSelectPermissionSets,
}) => {
  const [objectFilter, setObjectFilter] = useState("");
  const [customOnly, setCustomOnly] = useState(true);
  const [showPsSelector, setShowPsSelector] = useState(false);

  // オブジェクトをフィルタリング＆グループ化
  const filteredObjects = useMemo(() => {
    let filtered = objects;

    if (customOnly) {
      filtered = filtered.filter((o) => o.isCustom);
    }

    if (objectFilter) {
      const lower = objectFilter.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.apiName.toLowerCase().includes(lower) ||
          o.label.toLowerCase().includes(lower),
      );
    }

    // namespace でグループ化
    const groups: Record<string, ObjectInfo[]> = {
      MANAERP: [],
      Custom: [],
      Standard: [],
    };
    for (const obj of filtered) {
      const group = groups[obj.namespace];
      if (group) group.push(obj);
    }

    return groups;
  }, [objects, objectFilter, customOnly]);

  const handleToggleAllPs = () => {
    if (selectedPermissionSetIds.length === permissionSets.length) {
      onSelectPermissionSets([]);
    } else {
      onSelectPermissionSets(permissionSets.map((ps) => ps.id));
    }
  };

  const handleTogglePs = (id: string) => {
    if (selectedPermissionSetIds.includes(id)) {
      onSelectPermissionSets(
        selectedPermissionSetIds.filter((x) => x !== id),
      );
    } else {
      onSelectPermissionSets([...selectedPermissionSetIds, id]);
    }
  };

  return (
    <div className="flex gap-2 px-4 py-2 bg-zinc-850 border-b border-zinc-700">
      {/* オブジェクト選択 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <label className="text-xs text-zinc-400">オブジェクト</label>
          <label className="flex items-center gap-1 text-xs text-zinc-500">
            <input
              type="checkbox"
              checked={customOnly}
              onChange={(e) => setCustomOnly(e.target.checked)}
              className="w-3 h-3 rounded"
            />
            カスタムのみ
          </label>
        </div>

        <input
          type="text"
          value={objectFilter}
          onChange={(e) => setObjectFilter(e.target.value)}
          placeholder="オブジェクトを検索..."
          className="w-full px-2 py-1 text-xs bg-zinc-800 border border-zinc-600 rounded text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-violet-500"
        />

        {/* オブジェクトリスト（objectFilterがある時 or オブジェクト未選択時） */}
        {(!selectedObjectApiName || objectFilter) && (
          <div className="mt-1 max-h-40 overflow-y-auto bg-zinc-800 rounded border border-zinc-700">
            {(["MANAERP", "Custom", "Standard"] as const).map((ns) => {
              const group = filteredObjects[ns];
              if (!group || group.length === 0) return null;
              return (
                <div key={ns}>
                  <div className="px-2 py-0.5 text-[10px] font-semibold text-zinc-500 bg-zinc-750 uppercase">
                    {ns} ({group.length})
                  </div>
                  {group.map((obj) => (
                    <button
                      key={obj.apiName}
                      onClick={() => {
                        onSelectObject(obj.apiName);
                        setObjectFilter("");
                      }}
                      className={`w-full text-left px-2 py-1 text-xs hover:bg-zinc-700 transition-colors ${
                        obj.apiName === selectedObjectApiName
                          ? "bg-violet-900/30 text-violet-300"
                          : "text-zinc-300"
                      }`}
                    >
                      <span className="font-medium">{obj.label}</span>
                      <span className="ml-1 text-zinc-500">
                        {obj.apiName}
                      </span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* 選択済みオブジェクト表示 */}
        {selectedObjectApiName && !objectFilter && (
          <div className="mt-1 text-xs text-violet-300">
            {selectedObjectApiName}
          </div>
        )}
      </div>

      {/* 権限セット選択 */}
      <div className="w-48 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-zinc-400">権限セット</label>
          <button
            onClick={() => setShowPsSelector(!showPsSelector)}
            className="text-[10px] text-zinc-500 hover:text-zinc-300"
          >
            {selectedPermissionSetIds.length}/{permissionSets.length} 選択
          </button>
        </div>

        {showPsSelector && (
          <div className="max-h-48 overflow-y-auto bg-zinc-800 rounded border border-zinc-700">
            <button
              onClick={handleToggleAllPs}
              className="w-full text-left px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-700 border-b border-zinc-700"
            >
              {selectedPermissionSetIds.length === permissionSets.length
                ? "全解除"
                : "全選択"}
            </button>
            {permissionSets.map((ps) => (
              <label
                key={ps.id}
                className="flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedPermissionSetIds.includes(ps.id)}
                  onChange={() => handleTogglePs(ps.id)}
                  className="w-3 h-3 rounded"
                />
                <span className="truncate" title={ps.name}>
                  {ps.label}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
