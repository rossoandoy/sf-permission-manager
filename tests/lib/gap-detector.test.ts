import { describe, it, expect } from "vitest";
import { detectGaps, summarizeGaps } from "../../src/lib/gap-detector";
import type {
  FieldInfo,
  PermissionSetInfo,
  FieldPermissionEntry,
} from "../../src/types/permissions";

// テスト用データ

const makeField = (
  overrides: Partial<FieldInfo> = {},
): FieldInfo => ({
  qualifiedApiName: "Obj__c.Field__c",
  fieldApiName: "Field__c",
  label: "Field",
  dataType: "Text",
  lastModified: "2025-03-01T00:00:00.000+0000",
  isCustom: true,
  namespace: "MANAERP",
  ...overrides,
});

const makePs = (
  overrides: Partial<PermissionSetInfo> = {},
): PermissionSetInfo => ({
  id: "0PS001",
  name: "TestPS",
  label: "Test PS",
  description: null,
  lastModified: "2025-01-01T00:00:00.000+0000",
  isCustom: true,
  namespace: null,
  ...overrides,
});

describe("detectGaps", () => {
  it("権限セット変更日より新しいフィールドで権限未設定のものを検出する", () => {
    const fields = [makeField()];
    const permissionSets = [makePs()];
    // fieldPermissions は空 → missing
    const gaps = detectGaps({
      fields,
      permissionSets,
      fieldPermissions: {},
    });

    expect(gaps).toHaveLength(1);
    expect(gaps[0]?.gapType).toBe("missing");
    expect(gaps[0]?.daysDiff).toBeGreaterThan(0);
  });

  it("権限レコードはあるがread/edit共にfalseの場合no_accessを検出する", () => {
    const fields = [makeField()];
    const permissionSets = [makePs()];
    const entry: FieldPermissionEntry = {
      sfId: "01k001",
      permissionSetId: "0PS001",
      objectApiName: "Obj__c",
      fieldQualifiedName: "Obj__c.Field__c",
      read: false,
      edit: false,
    };

    const gaps = detectGaps({
      fields,
      permissionSets,
      fieldPermissions: {
        "Obj__c.Field__c": { "0PS001": entry },
      },
    });

    expect(gaps).toHaveLength(1);
    expect(gaps[0]?.gapType).toBe("no_access");
  });

  it("フィールド変更日が権限セット変更日より古ければ検出しない", () => {
    const fields = [
      makeField({ lastModified: "2024-01-01T00:00:00.000+0000" }),
    ];
    const permissionSets = [makePs()];

    const gaps = detectGaps({
      fields,
      permissionSets,
      fieldPermissions: {},
    });

    expect(gaps).toHaveLength(0);
  });

  it("権限が正しく設定されていれば検出しない", () => {
    const fields = [makeField()];
    const permissionSets = [makePs()];
    const entry: FieldPermissionEntry = {
      sfId: "01k001",
      permissionSetId: "0PS001",
      objectApiName: "Obj__c",
      fieldQualifiedName: "Obj__c.Field__c",
      read: true,
      edit: false,
    };

    const gaps = detectGaps({
      fields,
      permissionSets,
      fieldPermissions: {
        "Obj__c.Field__c": { "0PS001": entry },
      },
    });

    expect(gaps).toHaveLength(0);
  });

  it("標準フィールドはcustomFieldsOnly=trueの場合検出対象外とする", () => {
    const fields = [makeField({ isCustom: false })];
    const permissionSets = [makePs()];

    const gaps = detectGaps(
      { fields, permissionSets, fieldPermissions: {} },
      { customFieldsOnly: true },
    );

    expect(gaps).toHaveLength(0);
  });

  it("namespaceFilterで特定のnamespaceのみを対象にする", () => {
    const fields = [
      makeField({ namespace: "MANAERP" }),
      makeField({
        qualifiedApiName: "Obj__c.Other__c",
        namespace: null,
      }),
    ];
    const permissionSets = [makePs()];

    const gaps = detectGaps(
      { fields, permissionSets, fieldPermissions: {} },
      { namespaceFilter: ["MANAERP"], customFieldsOnly: false },
    );

    expect(gaps).toHaveLength(1);
    expect(gaps[0]?.field.namespace).toBe("MANAERP");
  });

  it("日数差の降順でソートされる", () => {
    const fields = [
      makeField({
        qualifiedApiName: "Obj__c.Old__c",
        lastModified: "2025-02-01T00:00:00.000+0000",
      }),
      makeField({
        qualifiedApiName: "Obj__c.New__c",
        lastModified: "2025-03-15T00:00:00.000+0000",
      }),
    ];
    const permissionSets = [makePs()];

    const gaps = detectGaps({
      fields,
      permissionSets,
      fieldPermissions: {},
    });

    expect(gaps.length).toBe(2);
    expect(gaps[0]!.daysDiff).toBeGreaterThan(gaps[1]!.daysDiff);
  });
});

describe("summarizeGaps", () => {
  it("サマリを正しく生成する", () => {
    const fields = [
      makeField({ qualifiedApiName: "Obj__c.F1__c" }),
      makeField({ qualifiedApiName: "Obj__c.F2__c" }),
    ];
    const permissionSets = [
      makePs({ id: "0PS001" }),
      makePs({ id: "0PS002" }),
    ];

    const gaps = detectGaps({
      fields,
      permissionSets,
      fieldPermissions: {},
    });

    const summary = summarizeGaps(gaps);
    expect(summary.totalGaps).toBe(4); // 2 fields × 2 PS
    expect(summary.byGapType.missing).toBe(4);
    expect(summary.maxDaysDiff).toBeGreaterThan(0);
  });

  it("空の場合のサマリ", () => {
    const summary = summarizeGaps([]);
    expect(summary.totalGaps).toBe(0);
    expect(summary.avgDaysDiff).toBe(0);
    expect(summary.maxDaysDiff).toBe(0);
  });
});
