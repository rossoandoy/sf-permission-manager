/**
 * Salesforce APIレスポンスとアプリ内部モデルの変換ユーティリティ
 */

import type {
  SfPermissionSet,
  SfFieldPermission,
  SfObjectPermission,
  SfFieldDefinition,
  SfEntityDefinition,
} from "../types/salesforce";
import type {
  PermissionSetInfo,
  FieldPermissionEntry,
  ObjectPermissionEntry,
  FieldInfo,
  ObjectInfo,
  BulkPermissionChange,
  DiffResult,
} from "../types/permissions";

// --- SF → 内部モデル変換 ---

export function toPermissionSetInfo(sf: SfPermissionSet): PermissionSetInfo {
  return {
    id: sf.Id,
    name: sf.Name,
    label: sf.Label,
    description: sf.Description,
    lastModified: sf.LastModifiedDate,
    isCustom: sf.IsCustom,
    namespace: sf.NamespacePrefix,
  };
}

export function toFieldPermissionEntry(sf: SfFieldPermission): FieldPermissionEntry {
  return {
    sfId: sf.Id,
    permissionSetId: sf.ParentId,
    objectApiName: sf.SobjectType,
    fieldQualifiedName: sf.Field,
    read: sf.PermissionsRead,
    edit: sf.PermissionsEdit,
  };
}

export function toObjectPermissionEntry(sf: SfObjectPermission): ObjectPermissionEntry {
  return {
    sfId: sf.Id,
    permissionSetId: sf.ParentId,
    objectApiName: sf.SobjectType,
    create: sf.PermissionsCreate,
    read: sf.PermissionsRead,
    edit: sf.PermissionsEdit,
    delete: sf.PermissionsDelete,
    viewAll: sf.PermissionsViewAllRecords,
    modifyAll: sf.PermissionsModifyAllRecords,
  };
}

export function toFieldInfo(sf: SfFieldDefinition): FieldInfo {
  return {
    qualifiedApiName: `${sf.EntityDefinition.QualifiedApiName}.${sf.QualifiedApiName}`,
    fieldApiName: sf.QualifiedApiName,
    label: sf.Label,
    dataType: sf.DataType,
    lastModified: sf.LastModifiedDate,
    isCustom: sf.IsCustom,
    namespace: sf.NamespacePrefix,
  };
}

export function toObjectInfo(sf: SfEntityDefinition): ObjectInfo {
  const ns = sf.NamespacePrefix;
  return {
    apiName: sf.QualifiedApiName,
    label: sf.Label,
    namespace: ns === "MANAERP" ? "MANAERP" : sf.IsCustom ? "Custom" : "Standard",
    lastModified: sf.LastModifiedDate,
    fieldCount: sf.FieldCount ?? 0,
    isCustom: sf.IsCustom,
  };
}

// --- 権限マトリクス構築 ---

/**
 * フィールド権限のフラットリストをマトリクス形式に変換
 * fieldQualifiedName → permissionSetId → FieldPermissionEntry
 */
export function buildFieldPermissionMatrix(
  entries: FieldPermissionEntry[],
): Record<string, Record<string, FieldPermissionEntry>> {
  const matrix: Record<string, Record<string, FieldPermissionEntry>> = {};
  for (const entry of entries) {
    if (!matrix[entry.fieldQualifiedName]) {
      matrix[entry.fieldQualifiedName] = {};
    }
    matrix[entry.fieldQualifiedName]![entry.permissionSetId] = entry;
  }
  return matrix;
}

// --- 差分比較 ---

/**
 * 2つの権限セット間のフィールド権限差分を計算
 */
export function computeDiff(
  fields: FieldInfo[],
  psA: PermissionSetInfo,
  psB: PermissionSetInfo,
  fieldPermissions: Record<string, Record<string, FieldPermissionEntry>>,
): DiffResult[] {
  const diffs: DiffResult[] = [];

  for (const field of fields) {
    const permA = fieldPermissions[field.qualifiedApiName]?.[psA.id];
    const permB = fieldPermissions[field.qualifiedApiName]?.[psB.id];

    const readA = permA?.read ?? false;
    const editA = permA?.edit ?? false;
    const readB = permB?.read ?? false;
    const editB = permB?.edit ?? false;

    if (readA !== readB || editA !== editB) {
      diffs.push({
        field,
        permissionSetA: { info: psA, read: readA, edit: editA },
        permissionSetB: { info: psB, read: readB, edit: editB },
      });
    }
  }

  return diffs;
}

// --- 一括変更リクエスト構築 ---

/**
 * 変更ペンディング（UI上の変更追跡マップ）から一括変更リクエストを構築
 *
 * pendingChanges のキー形式: "fieldQualifiedName:permissionSetId:read|edit"
 */
export function buildBulkChanges(
  pendingChanges: Record<string, boolean>,
  existingPermissions: Record<string, Record<string, FieldPermissionEntry>>,
): BulkPermissionChange[] {
  const changes: BulkPermissionChange[] = [];

  for (const [key, newValue] of Object.entries(pendingChanges)) {
    const [fieldQualifiedName, permissionSetId, permission] = key.split(":");
    if (!fieldQualifiedName || !permissionSetId || !permission) continue;

    const existing = existingPermissions[fieldQualifiedName]?.[permissionSetId];

    changes.push({
      changeKey: key,
      fieldQualifiedName,
      permissionSetId,
      permission: permission as "read" | "edit",
      newValue,
      existingRecordId: existing?.sfId ?? null,
    });
  }

  return changes;
}

/**
 * BulkPermissionChange をSF API用のレコードグループにまとめる
 * 同一フィールド×権限セットの read/edit 変更は1レコードにマージ
 */
export function groupChangesForApi(
  changes: BulkPermissionChange[],
): Map<string, { id: string | null; psId: string; field: string; obj: string; read?: boolean; edit?: boolean }> {
  const grouped = new Map<string, {
    id: string | null;
    psId: string;
    field: string;
    obj: string;
    read?: boolean;
    edit?: boolean;
  }>();

  for (const change of changes) {
    const groupKey = `${change.fieldQualifiedName}:${change.permissionSetId}`;
    const existing = grouped.get(groupKey);
    const objectApiName = change.fieldQualifiedName.split(".")[0] ?? "";

    if (existing) {
      existing[change.permission] = change.newValue;
      // 既存IDが見つかったら設定
      if (change.existingRecordId) existing.id = change.existingRecordId;
    } else {
      grouped.set(groupKey, {
        id: change.existingRecordId,
        psId: change.permissionSetId,
        field: change.fieldQualifiedName,
        obj: objectApiName,
        [change.permission]: change.newValue,
      });
    }
  }

  return grouped;
}
