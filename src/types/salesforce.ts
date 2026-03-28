/** Salesforce REST API レスポンスの共通型 */

// --- セッション ---
export interface SfSession {
  accessToken: string;
  instanceUrl: string;
  userId: string;
  orgId: string;
  /** セッション取得元のホスト名（例: manabie--uat.sandbox.my.salesforce.com） */
  sfHost: string;
}

// --- SOQL クエリレスポンス ---
export interface SfQueryResult<T> {
  totalSize: number;
  done: boolean;
  nextRecordsUrl?: string;
  records: T[];
}

// --- 権限セット ---
export interface SfPermissionSet {
  Id: string;
  Name: string;
  Label: string;
  Description: string | null;
  IsCustom: boolean;
  IsOwnedByProfile: boolean;
  LastModifiedDate: string;
  LastModifiedById: string;
  NamespacePrefix: string | null;
}

// --- 権限セットグループ ---
export interface SfPermissionSetGroup {
  Id: string;
  DeveloperName: string;
  MasterLabel: string;
  Description: string | null;
  Status: string;
}

export interface SfPermissionSetGroupComponent {
  Id: string;
  PermissionSetGroupId: string;
  PermissionSetId: string;
}

// --- フィールド権限 ---
export interface SfFieldPermission {
  Id: string;
  ParentId: string;
  SobjectType: string;
  /** "ObjectApiName.FieldApiName" 形式 */
  Field: string;
  PermissionsRead: boolean;
  PermissionsEdit: boolean;
}

// --- オブジェクト権限 ---
export interface SfObjectPermission {
  Id: string;
  ParentId: string;
  SobjectType: string;
  PermissionsCreate: boolean;
  PermissionsRead: boolean;
  PermissionsEdit: boolean;
  PermissionsDelete: boolean;
  PermissionsViewAllRecords: boolean;
  PermissionsModifyAllRecords: boolean;
}

// --- フィールドメタデータ（Tooling API） ---
export interface SfFieldDefinition {
  QualifiedApiName: string;
  Label: string;
  DataType: string;
  LastModifiedDate: string;
  IsCustom: boolean;
  NamespacePrefix: string | null;
  EntityDefinition: {
    QualifiedApiName: string;
  };
}

// --- エンティティ（オブジェクト）メタデータ ---
export interface SfEntityDefinition {
  QualifiedApiName: string;
  Label: string;
  NamespacePrefix: string | null;
  KeyPrefix: string | null;
}

// --- Composite API ---
export interface SfCompositeRequest {
  allOrNone: boolean;
  compositeRequest: SfCompositeSubRequest[];
}

export interface SfCompositeSubRequest {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  url: string;
  referenceId: string;
  body?: Record<string, unknown>;
}

export interface SfCompositeResponse {
  compositeResponse: {
    httpStatusCode: number;
    referenceId: string;
    body: Record<string, unknown>;
    httpHeaders: Record<string, string>;
  }[];
}

// --- SObject Collection API ---
export interface SfCollectionRequest {
  allOrNone: boolean;
  records: SfCollectionRecord[];
}

export interface SfCollectionRecord {
  attributes: { type: string };
  Id?: string;
  [key: string]: unknown;
}

export type SfCollectionResponse = {
  id: string;
  success: boolean;
  errors: { statusCode: string; message: string; fields: string[] }[];
}[]

// --- CustomField (Tooling API) ---
export interface SfCustomField {
  DeveloperName: string;
  TableEnumOrId: string;
  CreatedDate: string;
  LastModifiedDate: string;
}

// --- Describe API ---
export interface SfDescribeField {
  name: string;
  label: string;
  type: string;
  custom: boolean;
  updateable: boolean;
  nillable: boolean;
  permissionable: boolean;
  calculated: boolean;
  autoNumber: boolean;
  compoundFieldName: string | null;
}

export interface SfDescribeResult {
  name: string;
  label: string;
  custom: boolean;
  keyPrefix: string | null;
  fields: SfDescribeField[];
}

// --- エラー ---
export interface SfApiErrorResponse {
  message: string;
  errorCode: string;
  fields?: string[];
}
