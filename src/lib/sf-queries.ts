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

/** 権限セットグループ一覧 */
export const QUERY_PERMISSION_SET_GROUPS = `
  SELECT Id, DeveloperName, MasterLabel, Description, Status
  FROM PermissionSetGroup
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

/** 指定権限セットIDで設定があるオブジェクト一覧を取得 */
export function queryDistinctObjectTypes(parentIds: string[]): string {
  const idList = parentIds.map(id => `'${escapeSoql(id)}'`).join(",");
  return `
    SELECT SobjectType
    FROM ObjectPermissions
    WHERE ParentId IN (${idList})
    GROUP BY SobjectType
    ORDER BY SobjectType
  `;
}

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

/** 指定IDの権限セット詳細を取得 */
export function queryPermissionSetsByIds(ids: string[]): string {
  const idList = ids.map(id => `'${escapeSoql(id)}'`).join(",");
  return `
    SELECT Id, Name, Label, Description, IsCustom, IsOwnedByProfile,
           LastModifiedDate, LastModifiedById, NamespacePrefix
    FROM PermissionSet
    WHERE Id IN (${idList})
    ORDER BY Label ASC
  `;
}

/** カスタムフィールドの作成日・更新日を取得（Tooling API） */
export function queryCustomFieldDates(objectApiName: string): string {
  return `
    SELECT DeveloperName, TableEnumOrId, CreatedDate, LastModifiedDate
    FROM CustomField
    WHERE TableEnumOrId = '${escapeSoql(objectApiName)}'
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
