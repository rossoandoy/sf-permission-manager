/**
 * Service Worker エントリポイント
 * グループ → PS → オブジェクト フロー対応
 */

import {
  getSfHostFromUrl,
  getSessionCookie,
  checkConnectionStatus,
  buildSessionFromCookie,
  toApiHostname,
} from "./sf-session";
import {
  query,
  describeObject,
  collectionUpdate,
  collectionCreate,
  SfSessionExpiredError,
  SfApiLimitError,
  SfApiError,
} from "./sf-api-client";
import {
  cacheGet,
  cacheSet,
  cacheDeleteByPrefix,
  buildCacheKey,
  CACHE_TTL_PERMISSIONS,
  CACHE_TTL_METADATA,
} from "./cache";
import {
  QUERY_PERMISSION_SETS,
  QUERY_PERMISSION_SET_GROUPS,
  queryPermissionSetGroupComponents,
  queryPermissionSetsByIds,
  queryDistinctObjectTypes,
  queryFieldPermissionsByObject,
  queryObjectPermissionsByObject,
} from "../lib/sf-queries";
import {
  toPermissionSetInfo,
  toFieldPermissionEntry,
  toObjectPermissionEntry,
  groupChangesForApi,
} from "../lib/permission-utils";
import type {
  SfSession,
  SfPermissionSet,
  SfPermissionSetGroup,
  SfPermissionSetGroupComponent,
  SfFieldPermission,
  SfObjectPermission,
} from "../types/salesforce";
import type {
  PermissionSetInfo,
  FieldPermissionEntry,
  ObjectPermissionEntry,
  FieldInfo,
  ObjectInfo,
  BulkPermissionChange,
  PermissionChangeResult,
} from "../types/permissions";

// --- メッセージ型定義 ---

type BackgroundMessage =
  | { type: "GET_SF_HOST"; url: string }
  | { type: "GET_SESSION"; hostname: string }
  | { type: "GET_STATUS" }
  | { type: "GET_PS_GROUPS"; hostname: string }
  | { type: "GET_PS_GROUP_COMPONENTS"; hostname: string; groupId: string }
  | { type: "GET_PERMISSION_SETS"; hostname: string }
  | { type: "GET_PERMISSION_SETS_BY_IDS"; hostname: string; ids: string[] }
  | { type: "GET_OBJECTS_WITH_PERMISSIONS"; hostname: string; permissionSetIds: string[] }
  | { type: "DESCRIBE_OBJECT"; hostname: string; objectApiName: string }
  | {
      type: "GET_FIELD_PERMISSIONS";
      hostname: string;
      objectApiName: string;
      permissionSetIds: string[];
    }
  | {
      type: "GET_OBJECT_PERMISSIONS";
      hostname: string;
      objectApiName: string;
      permissionSetIds: string[];
    }
  | { type: "UPDATE_FIELD_PERMISSIONS"; hostname: string; changes: BulkPermissionChange[] }
  | { type: "CLEAR_CACHE"; prefix?: string }
  | { type: "SF_HOST_DETECTED"; sfHost: string; currentObjectApiName?: string }
  | { type: "GET_DETECTED_OBJECT" };

export type { BackgroundMessage };

// --- メッセージハンドラ ---

chrome.runtime.onMessage.addListener(
  (
    message: BackgroundMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ) => {
    handleMessage(message)
      .then(sendResponse)
      .catch((err) => {
        if (err instanceof SfSessionExpiredError) {
          sendResponse({ error: err.message, code: "SESSION_EXPIRED" });
        } else if (err instanceof SfApiLimitError) {
          sendResponse({ error: err.message, code: "API_LIMIT" });
        } else if (err instanceof SfApiError) {
          sendResponse({
            error: err.message,
            code: "API_ERROR",
            statusCode: err.statusCode,
          });
        } else {
          sendResponse({
            error: err instanceof Error ? err.message : String(err),
            code: "UNKNOWN",
          });
        }
      });
    return true;
  },
);

async function handleMessage(message: BackgroundMessage): Promise<unknown> {
  switch (message.type) {
    case "GET_SF_HOST":
      return { sfHost: getSfHostFromUrl(message.url) };
    case "GET_SESSION":
      return handleGetSession(message.hostname);
    case "GET_STATUS":
      return checkConnectionStatus();
    case "GET_PS_GROUPS":
      return handleGetPsGroups(message.hostname);
    case "GET_PS_GROUP_COMPONENTS":
      return handleGetPsGroupComponents(message.hostname, message.groupId);
    case "GET_PERMISSION_SETS":
      return handleGetPermissionSets(message.hostname);
    case "GET_PERMISSION_SETS_BY_IDS":
      return handleGetPermissionSetsByIds(message.hostname, message.ids);
    case "GET_OBJECTS_WITH_PERMISSIONS":
      return handleGetObjectsWithPermissions(message.hostname, message.permissionSetIds);
    case "DESCRIBE_OBJECT":
      return handleDescribeObject(message.hostname, message.objectApiName);
    case "GET_FIELD_PERMISSIONS":
      return handleGetFieldPermissions(message.hostname, message.objectApiName, message.permissionSetIds);
    case "GET_OBJECT_PERMISSIONS":
      return handleGetObjectPermissions(message.hostname, message.objectApiName, message.permissionSetIds);
    case "UPDATE_FIELD_PERMISSIONS":
      return handleUpdateFieldPermissions(message.hostname, message.changes);
    case "CLEAR_CACHE":
      return handleClearCache(message.prefix);
    case "SF_HOST_DETECTED":
      return handleSfHostDetected(message.sfHost, message.currentObjectApiName);
    case "GET_DETECTED_OBJECT":
      return handleGetDetectedObject();
    default:
      throw new Error(`不明なメッセージタイプ: ${(message as { type: string }).type}`);
  }
}

// --- セッション ---

async function handleGetSession(
  hostname: string,
): Promise<{ sessionId: string; hostname: string } | { error: string }> {
  const result = await getSessionCookie(hostname);
  if (!result) {
    return { error: "sid cookie が見つかりません。Salesforce にログインしてください。" };
  }
  return result;
}

async function requireSession(hostname: string): Promise<SfSession> {
  const cookieResult = await getSessionCookie(hostname);
  if (!cookieResult) {
    throw new SfSessionExpiredError();
  }
  return buildSessionFromCookie(cookieResult.hostname, cookieResult.sessionId);
}

// --- 権限セットグループ ---

async function handleGetPsGroups(hostname: string): Promise<SfPermissionSetGroup[]> {
  const session = await requireSession(hostname);
  const cacheKey = buildCacheKey(hostname, "psGroups", "all");
  const cached = await cacheGet<SfPermissionSetGroup[]>(cacheKey);
  if (cached) return cached;

  const result = await query<SfPermissionSetGroup>(session, QUERY_PERMISSION_SET_GROUPS);
  await cacheSet(cacheKey, result.records, CACHE_TTL_METADATA);
  return result.records;
}

async function handleGetPsGroupComponents(
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

// --- 権限セット ---

async function handleGetPermissionSets(hostname: string): Promise<PermissionSetInfo[]> {
  const session = await requireSession(hostname);
  const cacheKey = buildCacheKey(hostname, "permissionSets", "all");
  const cached = await cacheGet<PermissionSetInfo[]>(cacheKey);
  if (cached) return cached;

  const result = await query<SfPermissionSet>(session, QUERY_PERMISSION_SETS);
  const mapped = result.records.map(toPermissionSetInfo);
  await cacheSet(cacheKey, mapped, CACHE_TTL_METADATA);
  return mapped;
}

async function handleGetPermissionSetsByIds(
  hostname: string,
  ids: string[],
): Promise<PermissionSetInfo[]> {
  if (ids.length === 0) return [];
  const session = await requireSession(hostname);
  const soql = queryPermissionSetsByIds(ids);
  const result = await query<SfPermissionSet>(session, soql);
  return result.records.map(toPermissionSetInfo);
}

// --- オブジェクト ---

async function handleGetObjectsWithPermissions(
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
  const objectApiNames = result.records.map((r) => r.SobjectType);

  // describe で各オブジェクトのラベル・フィールド数を取得（並列）
  const objects: ObjectInfo[] = [];
  for (const apiName of objectApiNames) {
    try {
      const desc = await describeObject(session, apiName);
      const isCustom = apiName.endsWith("__c") || apiName.endsWith("__mdt") || apiName.endsWith("__e");
      const ns = apiName.includes("__") ? apiName.split("__")[0] ?? null : null;
      objects.push({
        apiName,
        label: desc.label,
        namespace: ns === "MANAERP" ? "MANAERP" : isCustom ? "Custom" : "Standard",
        lastModified: "",
        fieldCount: desc.fields.length,
        isCustom,
      });
    } catch {
      // describe 失敗はスキップ（権限不足等）
      objects.push({
        apiName,
        label: apiName,
        namespace: apiName.endsWith("__c") ? "Custom" : "Standard",
        lastModified: "",
        fieldCount: 0,
        isCustom: apiName.endsWith("__c"),
      });
    }
  }

  await cacheSet(cacheKey, objects, CACHE_TTL_METADATA);
  return objects;
}

// --- Describe ---

async function handleDescribeObject(
  hostname: string,
  objectApiName: string,
): Promise<{ fields: FieldInfo[] }> {
  const session = await requireSession(hostname);
  const cacheKey = buildCacheKey(hostname, "describe", objectApiName);
  const cached = await cacheGet<{ fields: FieldInfo[] }>(cacheKey);
  if (cached) return cached;

  const desc = await describeObject(session, objectApiName);
  const fields: FieldInfo[] = desc.fields.map((f) => ({
    qualifiedApiName: `${objectApiName}.${f.name}`,
    fieldApiName: f.name,
    label: f.label,
    dataType: f.type,
    lastModified: "",
    isCustom: f.custom,
    namespace: f.name.includes("__") ? (f.name.split("__")[0] ?? null) : null,
  }));

  const data = { fields };
  await cacheSet(cacheKey, data, CACHE_TTL_METADATA);
  return data;
}

// --- フィールド権限 ---

async function handleGetFieldPermissions(
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

async function handleGetObjectPermissions(
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

// --- 更新 ---

async function handleUpdateFieldPermissions(
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

// --- ユーティリティ ---

async function handleClearCache(prefix?: string): Promise<{ cleared: boolean }> {
  await cacheDeleteByPrefix(prefix ?? "sf:");
  return { cleared: true };
}

async function handleSfHostDetected(
  sfHost: string,
  currentObjectApiName?: string,
): Promise<{ ok: boolean }> {
  const apiHost = toApiHostname(sfHost);
  const data: Record<string, string> = { lastSfHost: apiHost };
  if (currentObjectApiName) data.lastDetectedObject = currentObjectApiName;
  await chrome.storage.local.set(data);
  return { ok: true };
}

async function handleGetDetectedObject(): Promise<{ objectApiName: string | null }> {
  const result = await chrome.storage.local.get("lastDetectedObject");
  return { objectApiName: (result.lastDetectedObject as string) ?? null };
}
