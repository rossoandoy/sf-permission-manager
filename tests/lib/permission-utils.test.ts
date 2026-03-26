import { describe, it, expect } from "vitest";
import {
  toPermissionSetInfo,
  toFieldPermissionEntry,
  toObjectPermissionEntry,
  toFieldInfo,
  toObjectInfo,
  buildFieldPermissionMatrix,
  computeDiff,
  buildBulkChanges,
  groupChangesForApi,
} from "../../src/lib/permission-utils";
import {
  mockPermissionSets,
  mockFieldPermissions,
  mockObjectPermissions,
  mockFieldDefinitions,
  mockEntityDefinitions,
} from "../mocks/sf-responses";

describe("toPermissionSetInfo", () => {
  it("SFレコードを内部モデルに変換する", () => {
    const sf = mockPermissionSets.records[0]!;
    const result = toPermissionSetInfo(sf);
    expect(result.id).toBe("0PS000000000001");
    expect(result.name).toBe("Manabie_Admin");
    expect(result.label).toBe("Manabie Admin");
    expect(result.isCustom).toBe(true);
  });
});

describe("toFieldPermissionEntry", () => {
  it("SFレコードを内部モデルに変換する", () => {
    const sf = mockFieldPermissions.records[0]!;
    const result = toFieldPermissionEntry(sf);
    expect(result.sfId).toBe("01k000000000001");
    expect(result.permissionSetId).toBe("0PS000000000001");
    expect(result.objectApiName).toBe("MANAERP__Bill_Item__c");
    expect(result.read).toBe(true);
    expect(result.edit).toBe(true);
  });
});

describe("toObjectPermissionEntry", () => {
  it("SFレコードを内部モデルに変換する", () => {
    const sf = mockObjectPermissions.records[0]!;
    const result = toObjectPermissionEntry(sf);
    expect(result.create).toBe(true);
    expect(result.read).toBe(true);
    expect(result.edit).toBe(true);
    expect(result.delete).toBe(false);
  });
});

describe("toFieldInfo", () => {
  it("Tooling APIレスポンスを内部モデルに変換する", () => {
    const sf = mockFieldDefinitions.records[0]!;
    const result = toFieldInfo(sf);
    expect(result.qualifiedApiName).toBe(
      "MANAERP__Bill_Item__c.MANAERP__Tax_Amount__c",
    );
    expect(result.fieldApiName).toBe("MANAERP__Tax_Amount__c");
    expect(result.label).toBe("税額");
    expect(result.isCustom).toBe(true);
  });
});

describe("toObjectInfo", () => {
  it("MANAERP namespaceを正しく識別する", () => {
    const sf = mockEntityDefinitions.records[0]!;
    const result = toObjectInfo(sf);
    expect(result.namespace).toBe("MANAERP");
    expect(result.isCustom).toBe(true);
  });

  it("標準オブジェクトを正しく識別する", () => {
    const sf = mockEntityDefinitions.records[1]!;
    const result = toObjectInfo(sf);
    expect(result.namespace).toBe("Standard");
    expect(result.isCustom).toBe(false);
  });
});

describe("buildFieldPermissionMatrix", () => {
  it("フラットリストをマトリクス形式に変換する", () => {
    const entries = mockFieldPermissions.records.map(toFieldPermissionEntry);
    const matrix = buildFieldPermissionMatrix(entries);

    const taxField =
      matrix["MANAERP__Bill_Item__c.MANAERP__Tax_Amount__c"];
    expect(taxField).toBeDefined();
    expect(taxField?.["0PS000000000001"]?.read).toBe(true);
    expect(taxField?.["0PS000000000001"]?.edit).toBe(true);
    expect(taxField?.["0PS000000000002"]?.read).toBe(true);
    expect(taxField?.["0PS000000000002"]?.edit).toBe(false);
  });
});

describe("computeDiff", () => {
  it("2つの権限セット間の差分を検出する", () => {
    const fields = mockFieldDefinitions.records.map(toFieldInfo);
    const entries = mockFieldPermissions.records.map(toFieldPermissionEntry);
    const matrix = buildFieldPermissionMatrix(entries);
    const psA = toPermissionSetInfo(mockPermissionSets.records[0]!);
    const psB = toPermissionSetInfo(mockPermissionSets.records[1]!);

    const diffs = computeDiff(fields, psA, psB, matrix);

    // Tax_Amount: A(R+E) vs B(R only) → edit が異なる
    // Unit_Price: A(R only) vs B(none) → read が異なる
    expect(diffs.length).toBeGreaterThanOrEqual(2);
  });

  it("同一権限の場合は差分なし", () => {
    const fields = mockFieldDefinitions.records.map(toFieldInfo);
    const psA = toPermissionSetInfo(mockPermissionSets.records[0]!);
    const matrix = buildFieldPermissionMatrix(
      mockFieldPermissions.records.map(toFieldPermissionEntry),
    );

    const diffs = computeDiff(fields, psA, psA, matrix);
    expect(diffs.length).toBe(0);
  });
});

describe("buildBulkChanges", () => {
  it("変更マップからBulkPermissionChangeを構築する", () => {
    const entries = mockFieldPermissions.records.map(toFieldPermissionEntry);
    const matrix = buildFieldPermissionMatrix(entries);

    const pendingChanges: Record<string, boolean> = {
      "MANAERP__Bill_Item__c.MANAERP__Tax_Amount__c:0PS000000000001:edit": false,
      "MANAERP__Bill_Item__c.MANAERP__Unit_Price__c:0PS000000000002:read": true,
    };

    const changes = buildBulkChanges(pendingChanges, matrix);
    expect(changes).toHaveLength(2);

    const editChange = changes.find((c) => c.permission === "edit");
    expect(editChange?.newValue).toBe(false);
    expect(editChange?.existingRecordId).toBe("01k000000000001");

    const readChange = changes.find((c) =>
      c.changeKey.includes("Unit_Price") && c.permission === "read",
    );
    expect(readChange?.newValue).toBe(true);
    expect(readChange?.existingRecordId).toBe("01k000000000004");
  });
});

describe("groupChangesForApi", () => {
  it("同一フィールド×権限セットのread/editをマージする", () => {
    const entries = mockFieldPermissions.records.map(toFieldPermissionEntry);
    const matrix = buildFieldPermissionMatrix(entries);

    const pendingChanges: Record<string, boolean> = {
      "MANAERP__Bill_Item__c.MANAERP__Tax_Amount__c:0PS000000000001:read": false,
      "MANAERP__Bill_Item__c.MANAERP__Tax_Amount__c:0PS000000000001:edit": false,
    };

    const changes = buildBulkChanges(pendingChanges, matrix);
    const grouped = groupChangesForApi(changes);

    // 同一フィールド×権限セットが1エントリにマージ
    expect(grouped.size).toBe(1);
    const entry = grouped.values().next().value;
    expect(entry?.read).toBe(false);
    expect(entry?.edit).toBe(false);
  });
});
