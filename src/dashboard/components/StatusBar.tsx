/**
 * ステータスバー
 */

import type { FC } from "react";

interface StatusBarProps {
  objectLabel: string | null;
  fieldCount: number;
  objectCount: number;
  permissionSetCount: number;
}

export const StatusBar: FC<StatusBarProps> = ({
  objectLabel,
  fieldCount,
  objectCount,
  permissionSetCount,
}) => {
  return (
    <footer className="flex items-center justify-between px-3 py-1 bg-zinc-800/80 border-t border-zinc-700/50 text-[11px] text-zinc-500">
      <div className="flex items-center gap-3">
        {objectLabel ? (
          <span>
            選択中: <span className="text-zinc-300">{objectLabel}</span> ·{" "}
            {fieldCount} fields
          </span>
        ) : (
          <span>{objectCount} objects · {permissionSetCount} permission sets</span>
        )}
      </div>
      <span>SF Permission Manager v0.1.0</span>
    </footer>
  );
};
