/**
 * オブジェクト一覧サイドバー
 * プロトタイプ準拠: グループ化、フィールド数、検索、自動検出ピン
 */

import { useState, useMemo, type FC } from "react";
import type { ObjectInfo } from "../../types/permissions";

interface ObjectSidebarProps {
  objects: ObjectInfo[];
  selectedObjectApiName: string | null;
  detectedObjectApiName: string | null;
  onSelectObject: (apiName: string) => void;
}

export const ObjectSidebar: FC<ObjectSidebarProps> = ({
  objects,
  selectedObjectApiName,
  detectedObjectApiName,
  onSelectObject,
}) => {
  const [filter, setFilter] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  const { groups, totalCount, shownCount } = useMemo(() => {
    let filtered = objects;

    if (filter) {
      const lower = filter.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.apiName.toLowerCase().includes(lower) ||
          o.label.toLowerCase().includes(lower),
      );
    }

    const g: Record<string, ObjectInfo[]> = {
      MANAERP: [],
      Custom: [],
      Standard: [],
    };
    for (const obj of filtered) {
      const group = g[obj.namespace];
      if (group) group.push(obj);
    }

    return {
      groups: g,
      totalCount: objects.length,
      shownCount: filtered.length,
    };
  }, [objects, filter]);

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
    <div className="w-[220px] shrink-0 bg-zinc-800/30 border-r border-zinc-700/50 flex flex-col overflow-hidden">
      {/* 検索 */}
      <div className="p-2 border-b border-zinc-700/50">
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
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
        <div className="mt-1 text-[10px] text-zinc-500">
          {shownCount === totalCount
            ? `${totalCount} objects`
            : `${shownCount} / ${totalCount} objects`}
        </div>
      </div>

      {/* オブジェクトリスト */}
      <div className="flex-1 overflow-y-auto">
        {(["MANAERP", "Custom", "Standard"] as const).map((ns) => {
          const group = groups[ns];
          if (!group || group.length === 0) return null;

          const nsIcon = ns === "MANAERP" ? "🟠" : ns === "Custom" ? "🔵" : "🔷";
          const nsLabel =
            ns === "MANAERP" ? "MANABIE ERP" : ns === "Custom" ? "CUSTOM" : "STANDARD";

          return (
            <div key={ns}>
              <div className="px-2 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                <span>{nsIcon}</span>
                {nsLabel} ({group.length})
              </div>
              {group.map((obj) => {
                const isSelected = obj.apiName === selectedObjectApiName;
                const isDetected = obj.apiName === detectedObjectApiName;

                return (
                  <button
                    key={obj.apiName}
                    onClick={() => onSelectObject(obj.apiName)}
                    className={`w-full text-left px-2 py-1.5 transition-colors group ${
                      isSelected
                        ? "bg-violet-600/20 border-l-2 border-violet-500"
                        : "hover:bg-zinc-700/50 border-l-2 border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span
                        className={`text-xs font-medium leading-tight ${
                          isSelected ? "text-violet-200" : "text-zinc-200"
                        }`}
                      >
                        {obj.label}
                      </span>
                      {isDetected && !isSelected && (
                        <span className="text-[9px] px-1 py-0 rounded bg-violet-800/50 text-violet-300">
                          検出
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-zinc-500 leading-tight">
                      {obj.apiName}
                    </div>
                    <div className="text-[10px] text-zinc-600">
                      {obj.fieldCount} fields
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
