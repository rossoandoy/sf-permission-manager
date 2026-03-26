import { describe, it, expect } from "vitest";
import {
  escapeSoql,
  queryFieldPermissionsByObject,
  queryObjectPermissionsByObject,
  queryFieldDefinitions,
  queryPermissionSetGroupComponents,
} from "../../src/lib/sf-queries";

describe("escapeSoql", () => {
  it("シングルクォートをエスケープする", () => {
    expect(escapeSoql("it's")).toBe("it\\'s");
  });

  it("バックスラッシュをエスケープする", () => {
    expect(escapeSoql("path\\to")).toBe("path\\\\to");
  });

  it("ダブルクォートをエスケープする", () => {
    expect(escapeSoql('say "hello"')).toBe('say \\"hello\\"');
  });

  it("複合エスケープを処理する", () => {
    expect(escapeSoql("it's a \\test\"")).toBe("it\\'s a \\\\test\\\"");
  });

  it("エスケープ不要な文字列はそのまま返す", () => {
    expect(escapeSoql("Account")).toBe("Account");
  });
});

describe("queryFieldPermissionsByObject", () => {
  it("正しいSOQLを生成する", () => {
    const soql = queryFieldPermissionsByObject(
      ["0PS001", "0PS002"],
      "Account",
    );
    expect(soql).toContain("FROM FieldPermissions");
    expect(soql).toContain("'0PS001'");
    expect(soql).toContain("'0PS002'");
    expect(soql).toContain("SobjectType = 'Account'");
  });

  it("IDにSOQLインジェクションを防止する", () => {
    const soql = queryFieldPermissionsByObject(
      ["0PS001' OR 1=1 --"],
      "Account",
    );
    expect(soql).toContain("'0PS001\\' OR 1=1 --'");
  });
});

describe("queryObjectPermissionsByObject", () => {
  it("正しいSOQLを生成する", () => {
    const soql = queryObjectPermissionsByObject(["0PS001"], "MANAERP__Bill_Item__c");
    expect(soql).toContain("FROM ObjectPermissions");
    expect(soql).toContain("SobjectType = 'MANAERP__Bill_Item__c'");
  });
});

describe("queryFieldDefinitions", () => {
  it("Tooling API用のSOQLを生成する", () => {
    const soql = queryFieldDefinitions("MANAERP__Bill_Item__c");
    expect(soql).toContain("FROM FieldDefinition");
    expect(soql).toContain("EntityDefinition.QualifiedApiName = 'MANAERP__Bill_Item__c'");
  });
});

describe("queryPermissionSetGroupComponents", () => {
  it("正しいSOQLを生成する", () => {
    const soql = queryPermissionSetGroupComponents(["0PG001", "0PG002"]);
    expect(soql).toContain("FROM PermissionSetGroupComponent");
    expect(soql).toContain("'0PG001'");
    expect(soql).toContain("'0PG002'");
  });
});
