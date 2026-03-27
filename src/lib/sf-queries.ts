/**
 * SF Permission Manager で使用するSOQLクエリ定義
 * 全クエリをこのファイルに集約し、インラインSOQLを禁止する
 */

/** カスタム権限セット一覧（プロファイル由来を除外） */
export const QUERY_PERMISSION_SETS = `
  SELECT Id, Name, Label, Description, IsCustom, IsOwnedByProfile,
         LastModifiedDate, LastModifiedById, NamespacePrefix
  FROM PermissionSet
  WHERE IsCustom = true AND IsOwnedByProfile = false
  ORDER BY Label ASC
`;

/** 指定権限セットIDのフィールド権限を取得 */
export function queryFieldPermissions(parentIds: string[]): string {
  const idList = parentIds.map(id => `'${escapeSoql(id)}'`).join(",");
  return `
    SELECT Id, SobjectType, Field, PermissionsRead, PermissionsEdit, ParentId
    FROM FieldPermissions
    WHERE ParentId IN (${idList})
    ORDER BY SobjectType, Field
  `;
}

/** 特定オブジェクトのフィールド権限を取得 */
export function queryFieldPermissionsByObject(
  parentIds: string[],
  objectApiName: string,
): string {
  const idList = parentIds.map(id => `'${escapeSoql(id)}'`).join(",");
  return `
    SELECT Id, SobjectType, Field, PermissionsRead, PermissionsEdit, ParentId
    FROM FieldPermissions
    WHERE ParentId IN (${idList})
      AND SobjectType = '${escapeSoql(objectApiName)}'
    ORDER BY Field
  `;
}

/** 指定権限セットIDのオブジェクト権限を取得 */
export function queryObjectPermissions(parentIds: string[]): string {
  const idList = parentIds.map(id => `'${escapeSoql(id)}'`).join(",");
  return `
    SELECT Id, SobjectType, ParentId,
           PermissionsCreate, PermissionsRead, PermissionsEdit,
           PermissionsDelete, PermissionsViewAllRecords, PermissionsModifyAllRecords
    FROM ObjectPermissions
    WHERE ParentId IN (${idList})
    ORDER BY SobjectType
  `;
}

/** 特定オブジェクトのオブジェクト権限を取得 */
export function queryObjectPermissionsByObject(
  parentIds: string[],
  objectApiName: string,
): string {
  const idList = parentIds.map(id => `'${escapeSoql(id)}'`).join(",");
  return `
    SELECT Id, SobjectType, ParentId,
           PermissionsCreate, PermissionsRead, PermissionsEdit,
           PermissionsDelete, PermissionsViewAllRecords, PermissionsModifyAllRecords
    FROM ObjectPermissions
    WHERE ParentId IN (${idList})
      AND SobjectType = '${escapeSoql(objectApiName)}'
  `;
}

/** フィールドメタデータ取得（Tooling API経由） */
export function queryFieldDefinitions(objectApiName: string): string {
  return `
    SELECT QualifiedApiName, Label, DataType, LastModifiedDate,
           IsCustom, NamespacePrefix,
           EntityDefinition.QualifiedApiName
    FROM FieldDefinition
    WHERE EntityDefinition.QualifiedApiName = '${escapeSoql(objectApiName)}'
    ORDER BY QualifiedApiName
  `;
}

/** エンティティ（オブジェクト）一覧取得（Tooling API経由） */
export const QUERY_ENTITY_DEFINITIONS = `
  SELECT QualifiedApiName, Label, NamespacePrefix, KeyPrefix
  FROM EntityDefinition
  WHERE IsQueryable = true
  ORDER BY Label ASC
  LIMIT 2000
`;

/** 権限セットグループ一覧 */
export const QUERY_PERMISSION_SET_GROUPS = `
  SELECT Id, DeveloperName, MasterLabel, Description, Status
  FROM PermissionSetGroup
  WHERE Status = 'Updated'
  ORDER BY MasterLabel ASC
`;

/** 権限セットグループのコンポーネント（紐付け権限セット） */
export function queryPermissionSetGroupComponents(groupIds: string[]): string {
  const idList = groupIds.map(id => `'${escapeSoql(id)}'`).join(",");
  return `
    SELECT Id, PermissionSetGroupId, PermissionSetId
    FROM PermissionSetGroupComponent
    WHERE PermissionSetGroupId IN (${idList})
  `;
}

// --- ユーティリティ ---

/** SOQLインジェクション防止のためのエスケープ */
export function escapeSoql(input: string): string {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"');
}
