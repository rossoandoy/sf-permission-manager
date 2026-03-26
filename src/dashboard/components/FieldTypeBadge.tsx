/**
 * フィールド型バッジ
 */

import type { FC } from "react";

const TYPE_STYLES: Record<string, string> = {
  Text: "bg-zinc-600/50 text-zinc-300",
  Lookup: "bg-sky-900/50 text-sky-300",
  Currency: "bg-emerald-900/50 text-emerald-300",
  Number: "bg-orange-900/50 text-orange-300",
  Picklist: "bg-violet-900/50 text-violet-300",
  Checkbox: "bg-amber-900/50 text-amber-300",
  DateTime: "bg-teal-900/50 text-teal-300",
  Date: "bg-teal-900/50 text-teal-300",
  Email: "bg-blue-900/50 text-blue-300",
  Phone: "bg-blue-900/50 text-blue-300",
  Url: "bg-blue-900/50 text-blue-300",
  TextArea: "bg-zinc-600/50 text-zinc-300",
  LongTextArea: "bg-zinc-600/50 text-zinc-300",
  Html: "bg-zinc-600/50 text-zinc-300",
  Percent: "bg-orange-900/50 text-orange-300",
  MasterDetail: "bg-sky-900/50 text-sky-300",
};

const DEFAULT_STYLE = "bg-zinc-600/50 text-zinc-400";

interface FieldTypeBadgeProps {
  dataType: string;
}

export const FieldTypeBadge: FC<FieldTypeBadgeProps> = ({ dataType }) => {
  // "Currency(16,2)" → "Currency" のように括弧前を取得
  const baseType = dataType.split("(")[0] ?? dataType;
  const style = TYPE_STYLES[baseType] ?? DEFAULT_STYLE;

  return (
    <span
      className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded ${style}`}
    >
      {baseType}
    </span>
  );
};
