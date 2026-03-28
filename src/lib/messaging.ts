/**
 * Background Service Worker との型安全なメッセージング
 *
 * sf-custom-config-tool パターン:
 * - セッション取得/ホスト解決のみSW経由（chrome.cookies はSW内でのみ動作）
 * - データ取得はDashboard/拡張ページから直接Salesforce APIをfetch
 * - これによりSWのライフサイクル問題（30秒タイムアウト）を回避
 */

import type { SfPermissionSetGroup } from "../types/salesforce";
import type {
  PermissionSetInfo,
  FieldPermissionEntry,
  ObjectPermissionEntry,
  FieldInfo,
  ObjectInfo,
  BulkPermissionChange,
  PermissionChangeResult,
} from "../types/permissions";
import {
  query,
  toolingQuery,
  describeObject,
  collectionUpdate,
  collectionCreate,
} from "../background/sf-api-client";
import { buildSessionFromCookie } from "../background/sf-session";
import {
  QUERY_PERMISSION_SETS,
  QUERY_PERMISSION_SET_GROUPS,
  queryPermissionSetGroupComponents,
  queryPermissionSetsByIds,
  queryDistinctObjectTypes,
  queryFieldPermissionsByObject,
  queryObjectPermissionsByObject,
  queryCustomFieldDates,
} from "./sf-queries";
import {
  toPermissionSetInfo,
  toFieldPermissionEntry,
  toObjectPermissionEntry,
  groupChangesForApi,
} from "./permission-utils";
import {
  cacheGet,
  cacheSet,
  buildCacheKey,
  CACHE_TTL_PERMISSIONS,
  CACHE_TTL_METADATA,
  cacheDeleteByPrefix,
} from "../background/cache";
import type { SfSession, SfPermissionSet, SfPermissionSetGroupComponent, SfFieldPermission, SfObjectPermission, SfCustomField } from "../types/salesforce";

// --- SW経由メッセージング (セッション/ホスト解決のみ) ---

interface ErrorResponse {
  error: string;
  code?: string;
}

function isErrorResponse(value: unknown): value is ErrorResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as ErrorResponse).error === "string"
  );
}

function sendMessage<T>(message: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: unknown) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (isErrorResponse(response)) {
        reject(new Error(response.error));
        return;
      }
      resolve(response as T);
    });
  });
}

// --- 接続 (SW経由) ---

export function getSfHost(url: string): Promise<{ sfHost: string | null }> {
  return sendMessage<{ sfHost: string | null }>({ type: "GET_SF_HOST", url });
}

export function getStatus(): Promise<{ connected: boolean; hostname: string | null }> {
  return sendMessage<{ connected: boolean; hostname: string | null }>({ type: "GET_STATUS" });
}

export function getSession(hostname: string): Promise<{ sessionId: string; hostname: string }> {
  return sendMessage<{ sessionId: string; hostname: string }>({ type: "GET_SESSION", hostname });
}

// --- セッションヘルパー ---

async function requireSession(hostname: string): Promise<SfSession> {
  const result = await getSession(hostname);
  return buildSessionFromCookie(result.hostname, result.sessionId);
}

// --- コンテンツスクリプト通知 (SW経由) ---

export function notifySfHostDetected(
  sfHost: string,
  currentObjectApiName?: string,
): Promise<{ ok: boolean }> {
  return sendMessage<{ ok: boolean }>({
    type: "SF_HOST_DETECTED",
    sfHost,
    currentObjectApiName,
  });
}

export function getDetectedObject(): Promise<{ objectApiName: string | null }> {
  return sendMessage<{ objectApiName: string | null }>({ type: "GET_DETECTED_OBJECT" });
}

// --- 直接API呼出 (Dashboard/拡張ページから) ---

export async function getPsGroups(hostname: string): Promise<SfPermissionSetGroup[]> {
  const session = await requireSession(hostname);
  const cacheKey = buildCacheKey(hostname, "psGroups", "all");
  const cached = await cacheGet<SfPermissionSetGroup[]>(cacheKey);
  if (cached) return cached;

  const result = await query<SfPermissionSetGroup>(session, QUERY_PERMISSION_SET_GROUPS);
  await cacheSet(cacheKey, result.records, CACHE_TTL_METADATA);
  return result.records;
}

export async function getPsGroupComponents(
  hostname: string,
  groupId: string,
): Promise<{ permissionSetIds: string[] }> {
  const session = await requireSession(hostname);
  const cacheKey = buildCacheKey(hostname, "psGroupComp", groupId);
  const cached = await cacheGet<{ permissionSetIds: string[] }>(cacheKey);
  if (cached) return cached;

  const soql = queryPermissionSetGroupComponents([groupId]);
  const result = await query<SfPermissionSetGroupComponent>(session, soql);
  const ids = result.records.map((r) => r.PermissionSetId);
  const data = { permissionSetIds: ids };
  await cacheSet(cacheKey, data, CACHE_TTL_METADATA);
  return data;
}

export async function getPermissionSets(hostname: string): Promise<PermissionSetInfo[]> {
  const session = await requireSession(hostname);
  const cacheKey = buildCacheKey(hostname, "permissionSets", "all");
  const cached = await cacheGet<PermissionSetInfo[]>(cacheKey);
  if (cached) return cached;

  const result = await query<SfPermissionSet>(session, QUERY_PERMISSION_SETS);
  const mapped = result.records.map(toPermissionSetInfo);
  await cacheSet(cacheKey, mapped, CACHE_TTL_METADATA);
  return mapped;
}

export async function getPermissionSetsByIds(
  hostname: string,
  ids: string[],
): Promise<PermissionSetInfo[]> {
  if (ids.length === 0) return [];
  const session = await requireSession(hostname);
  const soql = queryPermissionSetsByIds(ids);
  const result = await query<SfPermissionSet>(session, soql);
  return result.records.map(toPermissionSetInfo);
}

export async function getObjectsWithPermissions(
  hostname: string,
  permissionSetIds: string[],
): Promise<ObjectInfo[]> {
  if (permissionSetIds.length === 0) return [];
  const session = await requireSession(hostname);
  const cacheKey = buildCacheKey(hostname, "objTypes", permissionSetIds.sort().join(","));
  const cached = await cacheGet<ObjectInfo[]>(cacheKey);
  if (cached) return cached;

  const soql = queryDistinctObjectTypes(permissionSetIds);
  const result = await query<{ SobjectType: string }>(session, soql);

  // describe は呼ばず API名からオブジェクト情報を構築（高速）
  // ラベルとフィールド数はオブジェクト選択時に describe で取得
  const objects: ObjectInfo[] = result.records.map((r) => {
    const apiName = r.SobjectType;
    const isCustom = apiName.endsWith("__c") || apiName.endsWith("__mdt") || apiName.endsWith("__e");
    const ns = apiName.includes("__") ? apiName.split("__")[0] ?? null : null;
    return {
      apiName,
      label: apiName.replace(/__c$/, "").replace(/__/g, " "),
      namespace: ns === "MANAERP" ? "MANAERP" : isCustom ? "Custom" : "Standard",
      lastModified: "",
      fieldCount: 0,
      isCustom,
    };
  });

  await cacheSet(cacheKey, objects, CACHE_TTL_METADATA);
  return objects;
}

export async function describeObjectFields(
  hostname: string,
  objectApiName: string,
): Promise<{ fields: FieldInfo[]; objectLabel: string; fieldCount: number }> {
  const session = await requireSession(hostname);
  const cacheKey = buildCacheKey(hostname, "describe", objectApiName);
  const cached = await cacheGet<{ fields: FieldInfo[]; objectLabel: string; fieldCount: number }>(cacheKey);
  if (cached) return cached;

  const desc = await describeObject(session, objectApiName);

  // CustomField から日付情報を取得（エラー時はスキップ）
  // キー: DeveloperName（namespace なし、__c なし）
  const dateMap = new Map<string, { createdDate: string; lastModified: string }>();
  try {
    const cfSoql = queryCustomFieldDates(objectApiName);
    const cfResult = await toolingQuery<SfCustomField>(session, cfSoql);
    for (const cf of cfResult.records) {
      dateMap.set(cf.DeveloperName, {
        createdDate: cf.CreatedDate,
        lastModified: cf.LastModifiedDate,
      });
    }
  } catch {
    // Tooling API エラーは無視（日付情報なしで続行）
  }

  const fields: FieldInfo[] = desc.fields.map((f) => {
    // CustomField の DeveloperName と照合
    // フィールド名: MANAERP__Application__c → namespace除去 → Application__c → __c除去 → Application
    // フィールド名: MyField__c → MyField
    let devName = f.name;
    // namespace prefix を除去（例: MANAERP__Foo__c → Foo__c）
    const nsParts = devName.match(/^[A-Za-z0-9]+__(.+)$/);
    if (nsParts?.[1] && f.custom) devName = nsParts[1];
    // __c サフィックスを除去
    devName = devName.replace(/__c$/, "");
    const dates = dateMap.get(devName);
    return {
      qualifiedApiName: `${objectApiName}.${f.name}`,
      fieldApiName: f.name,
      label: f.label,
      dataType: f.type,
      lastModified: dates?.lastModified ?? "",
      createdDate: dates?.createdDate ?? "",
      isCustom: f.custom,
      permissionable: f.permissionable,
      updateable: f.updateable,
      namespace: f.name.includes("__") ? (f.name.split("__")[0] ?? null) : null,
    };
  });

  const data = { fields, objectLabel: desc.label, fieldCount: desc.fields.length };
  await cacheSet(cacheKey, data, CACHE_TTL_METADATA);
  return data;
}

export async function getFieldPermissions(
  hostname: string,
  objectApiName: string,
  permissionSetIds: string[],
): Promise<FieldPermissionEntry[]> {
  const session = await requireSession(hostname);
  const cacheKey = buildCacheKey(
    hostname,
    "fieldPerms",
    `${objectApiName}:${permissionSetIds.sort().join(",")}`,
  );
  const cached = await cacheGet<FieldPermissionEntry[]>(cacheKey);
  if (cached) return cached;

  const soql = queryFieldPermissionsByObject(permissionSetIds, objectApiName);
  const result = await query<SfFieldPermission>(session, soql);
  const mapped = result.records.map(toFieldPermissionEntry);
  await cacheSet(cacheKey, mapped, CACHE_TTL_PERMISSIONS);
  return mapped;
}

export async function getObjectPermissions(
  hostname: string,
  objectApiName: string,
  permissionSetIds: string[],
): Promise<ObjectPermissionEntry[]> {
  const session = await requireSession(hostname);
  const cacheKey = buildCacheKey(
    hostname,
    "objPerms",
    `${objectApiName}:${permissionSetIds.sort().join(",")}`,
  );
  const cached = await cacheGet<ObjectPermissionEntry[]>(cacheKey);
  if (cached) return cached;

  const soql = queryObjectPermissionsByObject(permissionSetIds, objectApiName);
  const result = await query<SfObjectPermission>(session, soql);
  const mapped = result.records.map(toObjectPermissionEntry);
  await cacheSet(cacheKey, mapped, CACHE_TTL_PERMISSIONS);
  return mapped;
}

export async function updateFieldPermissions(
  hostname: string,
  changes: BulkPermissionChange[],
): Promise<PermissionChangeResult> {
  const session = await requireSession(hostname);
  const grouped = groupChangesForApi(changes);

  const updates: { Id: string; PermissionsRead?: boolean; PermissionsEdit?: boolean }[] = [];
  const creates: Record<string, unknown>[] = [];

  for (const entry of grouped.values()) {
    if (entry.id) {
      const rec: { Id: string; PermissionsRead?: boolean; PermissionsEdit?: boolean } = { Id: entry.id };
      if (entry.read !== undefined) rec.PermissionsRead = entry.read;
      if (entry.edit !== undefined) rec.PermissionsEdit = entry.edit;
      updates.push(rec);
    } else {
      creates.push({
        ParentId: entry.psId,
        SobjectType: entry.obj,
        Field: entry.field,
        PermissionsRead: entry.read ?? false,
        PermissionsEdit: entry.edit ?? false,
      });
    }
  }

  const errors: PermissionChangeResult["errors"] = [];
  let successCount = 0;

  if (updates.length > 0) {
    const results = await collectionUpdate(session, "FieldPermissions", updates);
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r?.success) successCount++;
      else if (r) {
        errors.push({
          changeKey: updates[i]?.Id ?? `update-${i}`,
          errorCode: r.errors[0]?.statusCode ?? "UNKNOWN",
          message: r.errors[0]?.message ?? "不明なエラー",
        });
      }
    }
  }

  if (creates.length > 0) {
    const results = await collectionCreate(session, "FieldPermissions", creates);
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r?.success) successCount++;
      else if (r) {
        errors.push({
          changeKey: `create-${i}`,
          errorCode: r.errors[0]?.statusCode ?? "UNKNOWN",
          message: r.errors[0]?.message ?? "不明なエラー",
        });
      }
    }
  }

  await cacheDeleteByPrefix(`sf:${hostname}:fieldPerms:`);
  await cacheDeleteByPrefix(`sf:${hostname}:objPerms:`);

  return {
    success: errors.length === 0,
    totalChanges: updates.length + creates.length,
    successCount,
    failureCount: errors.length,
    errors,
  };
}

/**
 * オブジェクト権限(CRUD)の更新
 */
export async function updateObjectPermissions(
  hostname: string,
  _objectApiName: string,
  pendingCrudChanges: Record<string, boolean>,
  currentPermissions: Record<string, import("../types/permissions").ObjectPermissionEntry>,
): Promise<PermissionChangeResult> {
  const session = await requireSession(hostname);
  const updates: { Id: string; [key: string]: unknown }[] = [];

  // CRUD フィールド名のマッピング
  const fieldMap: Record<string, string> = {
    create: "PermissionsCreate",
    read: "PermissionsRead",
    edit: "PermissionsEdit",
    delete: "PermissionsDelete",
    viewAll: "PermissionsViewAllRecords",
    modifyAll: "PermissionsModifyAllRecords",
  };

  // 変更をPSごとにグループ化
  const byPs = new Map<string, Record<string, boolean>>();
  for (const [key, value] of Object.entries(pendingCrudChanges)) {
    const [psId, crudKey] = key.split(":");
    if (!psId || !crudKey) continue;
    if (!byPs.has(psId)) byPs.set(psId, {});
    byPs.get(psId)![crudKey] = value;
  }

  for (const [psId, changes] of byPs) {
    const existing = currentPermissions[psId];
    if (!existing?.sfId) continue;
    const rec: { Id: string; [key: string]: unknown } = { Id: existing.sfId };
    for (const [crudKey, newValue] of Object.entries(changes)) {
      const sfField = fieldMap[crudKey];
      if (sfField) rec[sfField] = newValue;
    }
    updates.push(rec);
  }

  if (updates.length === 0) {
    return { success: true, totalChanges: 0, successCount: 0, failureCount: 0, errors: [] };
  }

  const errors: PermissionChangeResult["errors"] = [];
  let successCount = 0;

  const results = await collectionUpdate(session, "ObjectPermissions", updates as { Id: string }[]);
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r?.success) successCount++;
    else if (r) {
      errors.push({
        changeKey: updates[i]?.Id ?? `crud-${i}`,
        errorCode: r.errors[0]?.statusCode ?? "UNKNOWN",
        message: r.errors[0]?.message ?? "不明なエラー",
      });
    }
  }

  await cacheDeleteByPrefix(`sf:${hostname}:objPerms:`);

  return {
    success: errors.length === 0,
    totalChanges: updates.length,
    successCount,
    failureCount: errors.length,
    errors,
  };
}

export async function clearCache(prefix?: string): Promise<{ cleared: boolean }> {
  await cacheDeleteByPrefix(prefix ?? "sf:");
  return { cleared: true };
}
