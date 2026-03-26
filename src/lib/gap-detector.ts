/**
 * 権限設定漏れ検出ロジック
 *
 * 検出基準:
 * 権限セットの最終変更日以降に追加・変更されたフィールドで、
 * そのフィールドに対する権限エントリが存在しない、
 * または Read/Edit ともに false のもの
 */

import type {
  FieldInfo,
  PermissionSetInfo,
  FieldPermissionEntry,
  GapDetectionResult,
} from "../types/permissions";

export interface GapDetectorInput {
  fields: FieldInfo[];
  permissionSets: PermissionSetInfo[];
  /** fieldQualifiedName → permissionSetId → FieldPermissionEntry */
  fieldPermissions: Record<string, Record<string, FieldPermissionEntry>>;
}

export interface GapDetectorOptions {
  /** カスタムフィールドのみを対象にする（デフォルト: true） */
  customFieldsOnly?: boolean;
  /** 特定のnamespaceのみを対象にする（null = 全て） */
  namespaceFilter?: string[] | null;
  /** 日数差の最小閾値（デフォルト: 0 = 全て検出） */
  minDaysDiff?: number;
}

const DEFAULT_OPTIONS: Required<GapDetectorOptions> = {
  customFieldsOnly: true,
  namespaceFilter: null,
  minDaysDiff: 0,
};

/**
 * 権限設定漏れを検出する
 */
export function detectGaps(
  input: GapDetectorInput,
  options?: GapDetectorOptions,
): GapDetectionResult[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const results: GapDetectionResult[] = [];

  for (const field of input.fields) {
    // カスタムフィールドフィルター
    if (opts.customFieldsOnly && !field.isCustom) continue;

    // Namespaceフィルター
    if (opts.namespaceFilter !== null) {
      if (!opts.namespaceFilter.includes(field.namespace ?? "")) continue;
    }

    const fieldDate = new Date(field.lastModified);

    for (const ps of input.permissionSets) {
      const psDate = new Date(ps.lastModified);

      // フィールド変更日が権限セット変更日より古ければスキップ
      if (fieldDate <= psDate) continue;

      const daysDiff = Math.floor(
        (fieldDate.getTime() - psDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      // 日数差フィルター
      if (daysDiff < opts.minDaysDiff) continue;

      const permEntry = input.fieldPermissions[field.qualifiedApiName]?.[ps.id];

      let gapType: GapDetectionResult["gapType"] | null = null;

      if (!permEntry) {
        // 権限レコード自体が存在しない
        gapType = "missing";
      } else if (!permEntry.read && !permEntry.edit) {
        // レコードは存在するがアクセス権なし
        gapType = "no_access";
      }

      if (gapType !== null) {
        results.push({
          field,
          permissionSet: ps,
          fieldModifiedDate: fieldDate,
          psModifiedDate: psDate,
          daysDiff,
          gapType,
        });
      }
    }
  }

  // 日数差の降順でソート（漏れが大きいものを上に）
  return results.sort((a, b) => b.daysDiff - a.daysDiff);
}

/**
 * 漏れ検出結果のサマリを生成
 */
export function summarizeGaps(gaps: GapDetectionResult[]): {
  totalGaps: number;
  byPermissionSet: Record<string, number>;
  byGapType: Record<string, number>;
  maxDaysDiff: number;
  avgDaysDiff: number;
} {
  const byPermissionSet: Record<string, number> = {};
  const byGapType: Record<string, number> = { missing: 0, no_access: 0 };

  let totalDays = 0;
  let maxDays = 0;

  for (const gap of gaps) {
    byPermissionSet[gap.permissionSet.id] =
      (byPermissionSet[gap.permissionSet.id] ?? 0) + 1;
    byGapType[gap.gapType] = (byGapType[gap.gapType] ?? 0) + 1;
    totalDays += gap.daysDiff;
    if (gap.daysDiff > maxDays) maxDays = gap.daysDiff;
  }

  return {
    totalGaps: gaps.length,
    byPermissionSet,
    byGapType,
    maxDaysDiff: maxDays,
    avgDaysDiff: gaps.length > 0 ? Math.round(totalDays / gaps.length) : 0,
  };
}
