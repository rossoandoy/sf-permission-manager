/** アプリ内部で使用する権限データモデル */

// --- オブジェクト ---
export interface ObjectInfo {
  apiName: string;
  label: string;
  namespace: "Standard" | "MANAERP" | "Custom";
  lastModified: string;
  fieldCount: number;
  isCustom: boolean;
}

// --- フィールド ---
export interface FieldInfo {
  /** "ObjectApiName.FieldApiName" 形式 */
  qualifiedApiName: string;
  /** フィールドのみのAPI名 */
  fieldApiName: string;
  label: string;
  dataType: string;
  lastModified: string;
  isCustom: boolean;
  namespace: string | null;
}

// --- 権限セット（内部モデル） ---
export interface PermissionSetInfo {
  id: string;
  name: string;
  label: string;
  description: string | null;
  lastModified: string;
  isCustom: boolean;
  namespace: string | null;
}

// --- フィールド権限（内部モデル） ---
export interface FieldPermissionEntry {
  /** FieldPermission レコードのSF ID（既存の場合）。新規は null */
  sfId: string | null;
  permissionSetId: string;
  objectApiName: string;
  /** "ObjectApiName.FieldApiName" 形式 */
  fieldQualifiedName: string;
  read: boolean;
  edit: boolean;
}

// --- オブジェクト権限（内部モデル） ---
export interface ObjectPermissionEntry {
  sfId: string | null;
  permissionSetId: string;
  objectApiName: string;
  create: boolean;
  read: boolean;
  edit: boolean;
  delete: boolean;
  viewAll: boolean;
  modifyAll: boolean;
}

// --- マトリクスデータ（UI表示用） ---
export interface PermissionMatrix {
  object: ObjectInfo;
  fields: FieldInfo[];
  permissionSets: PermissionSetInfo[];
  /** fieldQualifiedName → permissionSetId → FieldPermissionEntry */
  fieldPermissions: Record<string, Record<string, FieldPermissionEntry>>;
  /** permissionSetId → ObjectPermissionEntry */
  objectPermissions: Record<string, ObjectPermissionEntry>;
}

// --- 漏れ検出結果 ---
export interface GapDetectionResult {
  field: FieldInfo;
  permissionSet: PermissionSetInfo;
  /** フィールドの最終変更日 */
  fieldModifiedDate: Date;
  /** 権限セットの最終変更日 */
  psModifiedDate: Date;
  /** フィールド変更日 - 権限セット変更日の日数差 */
  daysDiff: number;
  /** "missing"=権限レコード自体が存在しない, "no_access"=存在するがread/edit共にfalse */
  gapType: "missing" | "no_access";
}

// --- 差分比較結果 ---
export interface DiffResult {
  field: FieldInfo;
  permissionSetA: {
    info: PermissionSetInfo;
    read: boolean;
    edit: boolean;
  };
  permissionSetB: {
    info: PermissionSetInfo;
    read: boolean;
    edit: boolean;
  };
}

// --- 一括変更リクエスト ---
export interface BulkPermissionChange {
  /** "fieldQualifiedName:permissionSetId:read|edit" */
  changeKey: string;
  fieldQualifiedName: string;
  permissionSetId: string;
  permission: "read" | "edit";
  newValue: boolean;
  /** 既存レコードのSF ID（あれば PATCH、なければ POST） */
  existingRecordId: string | null;
}

// --- 変更結果 ---
export interface PermissionChangeResult {
  success: boolean;
  totalChanges: number;
  successCount: number;
  failureCount: number;
  errors: {
    changeKey: string;
    errorCode: string;
    message: string;
  }[];
}
