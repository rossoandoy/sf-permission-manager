/**
 * Salesforce APIレスポンスモックデータ
 */

import type {
  SfPermissionSet,
  SfFieldPermission,
  SfObjectPermission,
  SfFieldDefinition,
  SfEntityDefinition,
  SfQueryResult,
} from "../../src/types/salesforce";

// --- 権限セット ---

export const mockPermissionSets: SfQueryResult<SfPermissionSet> = {
  totalSize: 3,
  done: true,
  records: [
    {
      Id: "0PS000000000001",
      Name: "Manabie_Admin",
      Label: "Manabie Admin",
      Description: "管理者用権限セット",
      IsCustom: true,
      IsOwnedByProfile: false,
      LastModifiedDate: "2025-01-15T10:00:00.000+0000",
      LastModifiedById: "005000000000001",
      NamespacePrefix: null,
    },
    {
      Id: "0PS000000000002",
      Name: "Manabie_ReadOnly",
      Label: "Manabie ReadOnly",
      Description: "読み取り専用",
      IsCustom: true,
      IsOwnedByProfile: false,
      LastModifiedDate: "2025-01-10T10:00:00.000+0000",
      LastModifiedById: "005000000000001",
      NamespacePrefix: null,
    },
    {
      Id: "0PS000000000003",
      Name: "Manabie_Editor",
      Label: "Manabie Editor",
      Description: "編集者用権限セット",
      IsCustom: true,
      IsOwnedByProfile: false,
      LastModifiedDate: "2025-02-01T10:00:00.000+0000",
      LastModifiedById: "005000000000001",
      NamespacePrefix: null,
    },
  ],
};

// --- フィールド権限 ---

export const mockFieldPermissions: SfQueryResult<SfFieldPermission> = {
  totalSize: 4,
  done: true,
  records: [
    {
      Id: "01k000000000001",
      ParentId: "0PS000000000001",
      SobjectType: "MANAERP__Bill_Item__c",
      Field: "MANAERP__Bill_Item__c.MANAERP__Tax_Amount__c",
      PermissionsRead: true,
      PermissionsEdit: true,
    },
    {
      Id: "01k000000000002",
      ParentId: "0PS000000000001",
      SobjectType: "MANAERP__Bill_Item__c",
      Field: "MANAERP__Bill_Item__c.MANAERP__Unit_Price__c",
      PermissionsRead: true,
      PermissionsEdit: false,
    },
    {
      Id: "01k000000000003",
      ParentId: "0PS000000000002",
      SobjectType: "MANAERP__Bill_Item__c",
      Field: "MANAERP__Bill_Item__c.MANAERP__Tax_Amount__c",
      PermissionsRead: true,
      PermissionsEdit: false,
    },
    {
      Id: "01k000000000004",
      ParentId: "0PS000000000002",
      SobjectType: "MANAERP__Bill_Item__c",
      Field: "MANAERP__Bill_Item__c.MANAERP__Unit_Price__c",
      PermissionsRead: false,
      PermissionsEdit: false,
    },
  ],
};

// --- オブジェクト権限 ---

export const mockObjectPermissions: SfQueryResult<SfObjectPermission> = {
  totalSize: 2,
  done: true,
  records: [
    {
      Id: "110000000000001",
      ParentId: "0PS000000000001",
      SobjectType: "MANAERP__Bill_Item__c",
      PermissionsCreate: true,
      PermissionsRead: true,
      PermissionsEdit: true,
      PermissionsDelete: false,
      PermissionsViewAllRecords: false,
      PermissionsModifyAllRecords: false,
    },
    {
      Id: "110000000000002",
      ParentId: "0PS000000000002",
      SobjectType: "MANAERP__Bill_Item__c",
      PermissionsCreate: false,
      PermissionsRead: true,
      PermissionsEdit: false,
      PermissionsDelete: false,
      PermissionsViewAllRecords: false,
      PermissionsModifyAllRecords: false,
    },
  ],
};

// --- フィールドメタデータ ---

export const mockFieldDefinitions: SfQueryResult<SfFieldDefinition> = {
  totalSize: 3,
  done: true,
  records: [
    {
      QualifiedApiName: "MANAERP__Tax_Amount__c",
      Label: "税額",
      DataType: "Currency",
      LastModifiedDate: "2025-01-20T10:00:00.000+0000",
      IsCustom: true,
      NamespacePrefix: "MANAERP",
      EntityDefinition: { QualifiedApiName: "MANAERP__Bill_Item__c" },
    },
    {
      QualifiedApiName: "MANAERP__Unit_Price__c",
      Label: "単価",
      DataType: "Currency",
      LastModifiedDate: "2025-01-20T10:00:00.000+0000",
      IsCustom: true,
      NamespacePrefix: "MANAERP",
      EntityDefinition: { QualifiedApiName: "MANAERP__Bill_Item__c" },
    },
    {
      QualifiedApiName: "MANAERP__New_Field__c",
      Label: "新規フィールド",
      DataType: "Text",
      LastModifiedDate: "2025-03-01T10:00:00.000+0000",
      IsCustom: true,
      NamespacePrefix: "MANAERP",
      EntityDefinition: { QualifiedApiName: "MANAERP__Bill_Item__c" },
    },
  ],
};

// --- エンティティメタデータ ---

export const mockEntityDefinitions: SfQueryResult<SfEntityDefinition> = {
  totalSize: 2,
  done: true,
  records: [
    {
      QualifiedApiName: "MANAERP__Bill_Item__c",
      Label: "請求明細",
      IsCustom: true,
      NamespacePrefix: "MANAERP",
      LastModifiedDate: "2025-01-20T10:00:00.000+0000",
    },
    {
      QualifiedApiName: "Account",
      Label: "取引先",
      IsCustom: false,
      NamespacePrefix: null,
      LastModifiedDate: "2025-01-01T10:00:00.000+0000",
    },
  ],
};
