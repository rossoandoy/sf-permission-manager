/**
 * Service Worker エントリポイント
 * sf-custom-config-tool と同じ認証パターン:
 * - Background はCookie取得のみ（API呼び出しなし）
 * - Popup側がホスト名を渡してセッションを取得
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
  toolingQuery,
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
  queryFieldPermissionsByObject,
  queryObjectPermissionsByObject,
  queryFieldDefinitions,
  QUERY_ENTITY_DEFINITIONS,
} from "../lib/sf-queries";
import {
  toPermissionSetInfo,
  toFieldPermissionEntry,
  toObjectPermissionEntry,
  toFieldInfo,
  toObjectInfo,
  groupChangesForApi,
} from "../lib/permission-utils";
import type {
  SfSession,
  SfPermissionSet,
  SfFieldPermission,
  SfObjectPermission,
  SfFieldDefinition,
  SfEntityDefinition,
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
  | { type: "GET_PERMISSION_SETS"; hostname: string }
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
  | { type: "GET_FIELD_DEFINITIONS"; hostname: string; objectApiName: string }
  | { type: "GET_ENTITY_DEFINITIONS"; hostname: string }
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
    case "GET_PERMISSION_SETS":
      return handleGetPermissionSets(message.hostname);
    case "GET_FIELD_PERMISSIONS":
      return handleGetFieldPermissions(
        message.hostname,
        message.objectApiName,
        message.permissionSetIds,
      );
    case "GET_OBJECT_PERMISSIONS":
      return handleGetObjectPermissions(
        message.hostname,
        message.objectApiName,
        message.permissionSetIds,
      );
    case "GET_FIELD_DEFINITIONS":
      return handleGetFieldDefinitions(message.hostname, message.objectApiName);
    case "GET_ENTITY_DEFINITIONS":
      return handleGetEntityDefinitions(message.hostname);
    case "UPDATE_FIELD_PERMISSIONS":
      return handleUpdateFieldPermissions(message.hostname, message.changes);
    case "CLEAR_CACHE":
      return handleClearCache(message.prefix);
    case "SF_HOST_DETECTED":
      return handleSfHostDetected(message.sfHost, message.currentObjectApiName);
    case "GET_DETECTED_OBJECT":
      return handleGetDetectedObject();
    default:
      throw new Error(
        `不明なメッセージタイプ: ${(message as { type: string }).type}`,
      );
  }
}

// --- セッション関連（シンプル: Cookie取得のみ） ---

async function handleGetSession(
  hostname: string,
): Promise<{ sessionId: string; hostname: string } | { error: string }> {
  const result = await getSessionCookie(hostname);
  if (!result) {
    return { error: "sid cookie が見つかりません。Salesforce にログインしてください。" };
  }
  return result;
}

/** ホスト名からSfSessionを構築してAPI呼び出しに使用 */
async function requireSession(hostname: string): Promise<SfSession> {
  const cookieResult = await getSessionCookie(hostname);
  if (!cookieResult) {
    throw new SfSessionExpiredError();
  }
  // enrichSession は呼ばない — orgId/userInfo 取得が遅い/失敗するとデータ取得全体がブロックされる
  // キャッシュキーには hostname をフォールバックとして使用
  return buildSessionFromCookie(cookieResult.hostname, cookieResult.sessionId);
}

// --- データ取得ハンドラ ---

async function handleGetPermissionSets(hostname: string): Promise<PermissionSetInfo[]> {
  const session = await requireSession(hostname);
  const cacheKey = buildCacheKey(session.orgId || hostname, "permissionSets", "all");

  const cached = await cacheGet<PermissionSetInfo[]>(cacheKey);
  if (cached) return cached;

  const result = await query<SfPermissionSet>(session, QUERY_PERMISSION_SETS);
  const mapped = result.records.map(toPermissionSetInfo);

  await cacheSet(cacheKey, mapped, CACHE_TTL_METADATA);
  return mapped;
}

async function handleGetFieldPermissions(
  hostname: string,
  objectApiName: string,
  permissionSetIds: string[],
): Promise<FieldPermissionEntry[]> {
  const session = await requireSession(hostname);
  const cacheKey = buildCacheKey(
    session.orgId || hostname,
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
    session.orgId || hostname,
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

async function handleGetFieldDefinitions(
  hostname: string,
  objectApiName: string,
): Promise<FieldInfo[]> {
  const session = await requireSession(hostname);
  const cacheKey = buildCacheKey(
    session.orgId || hostname,
    "fieldDefs",
    objectApiName,
  );

  const cached = await cacheGet<FieldInfo[]>(cacheKey);
  if (cached) return cached;

  const soql = queryFieldDefinitions(objectApiName);
  const result = await toolingQuery<SfFieldDefinition>(session, soql);
  const mapped = result.records.map(toFieldInfo);

  await cacheSet(cacheKey, mapped, CACHE_TTL_METADATA);
  return mapped;
}

async function handleGetEntityDefinitions(hostname: string): Promise<ObjectInfo[]> {
  const session = await requireSession(hostname);
  const cacheKey = buildCacheKey(session.orgId || hostname, "entities", "all");

  const cached = await cacheGet<ObjectInfo[]>(cacheKey);
  if (cached) return cached;

  const result = await toolingQuery<SfEntityDefinition>(
    session,
    QUERY_ENTITY_DEFINITIONS,
  );
  const mapped = result.records.map(toObjectInfo);

  await cacheSet(cacheKey, mapped, CACHE_TTL_METADATA);
  return mapped;
}

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
      const rec: { Id: string; PermissionsRead?: boolean; PermissionsEdit?: boolean } = {
        Id: entry.id,
      };
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
    const updateResults = await collectionUpdate(session, "FieldPermissions", updates);
    for (let i = 0; i < updateResults.length; i++) {
      const r = updateResults[i];
      if (r && r.success) {
        successCount++;
      } else if (r) {
        const firstError = r.errors[0];
        errors.push({
          changeKey: updates[i]?.Id ?? `update-${i}`,
          errorCode: firstError?.statusCode ?? "UNKNOWN",
          message: firstError?.message ?? "不明なエラー",
        });
      }
    }
  }

  if (creates.length > 0) {
    const createResults = await collectionCreate(session, "FieldPermissions", creates);
    for (let i = 0; i < createResults.length; i++) {
      const r = createResults[i];
      if (r && r.success) {
        successCount++;
      } else if (r) {
        const firstError = r.errors[0];
        errors.push({
          changeKey: `create-${i}`,
          errorCode: firstError?.statusCode ?? "UNKNOWN",
          message: firstError?.message ?? "不明なエラー",
        });
      }
    }
  }

  await cacheDeleteByPrefix(`sf:${session.orgId || hostname}:fieldPerms:`);
  await cacheDeleteByPrefix(`sf:${session.orgId || hostname}:objPerms:`);

  return {
    success: errors.length === 0,
    totalChanges: updates.length + creates.length,
    successCount,
    failureCount: errors.length,
    errors,
  };
}

async function handleClearCache(prefix?: string): Promise<{ cleared: boolean }> {
  if (prefix) {
    await cacheDeleteByPrefix(prefix);
  } else {
    await cacheDeleteByPrefix("sf:");
  }
  return { cleared: true };
}

async function handleSfHostDetected(
  sfHost: string,
  currentObjectApiName?: string,
): Promise<{ ok: boolean }> {
  const apiHost = toApiHostname(sfHost);
  const data: Record<string, string> = { lastSfHost: apiHost };
  if (currentObjectApiName) {
    data.lastDetectedObject = currentObjectApiName;
  }
  await chrome.storage.local.set(data);
  return { ok: true };
}

async function handleGetDetectedObject(): Promise<{ objectApiName: string | null }> {
  const result = await chrome.storage.local.get("lastDetectedObject");
  return { objectApiName: (result.lastDetectedObject as string) ?? null };
}
