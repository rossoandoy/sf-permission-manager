/**
 * Service Worker エントリポイント
 * Popup/Content Script からのメッセージをルーティングする
 */

import { getSession, getSessionForHost } from "./sf-session";
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
  | { type: "GET_SESSION" }
  | { type: "GET_PERMISSION_SETS" }
  | {
      type: "GET_FIELD_PERMISSIONS";
      objectApiName: string;
      permissionSetIds: string[];
    }
  | {
      type: "GET_OBJECT_PERMISSIONS";
      objectApiName: string;
      permissionSetIds: string[];
    }
  | { type: "GET_FIELD_DEFINITIONS"; objectApiName: string }
  | { type: "GET_ENTITY_DEFINITIONS" }
  | { type: "UPDATE_FIELD_PERMISSIONS"; changes: BulkPermissionChange[] }
  | { type: "CLEAR_CACHE"; prefix?: string }
  | { type: "SF_HOST_DETECTED"; sfHost: string };

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
    return true; // 非同期レスポンスを示す
  },
);

async function handleMessage(message: BackgroundMessage): Promise<unknown> {
  switch (message.type) {
    case "GET_SESSION":
      return handleGetSession();
    case "GET_PERMISSION_SETS":
      return handleGetPermissionSets();
    case "GET_FIELD_PERMISSIONS":
      return handleGetFieldPermissions(
        message.objectApiName,
        message.permissionSetIds,
      );
    case "GET_OBJECT_PERMISSIONS":
      return handleGetObjectPermissions(
        message.objectApiName,
        message.permissionSetIds,
      );
    case "GET_FIELD_DEFINITIONS":
      return handleGetFieldDefinitions(message.objectApiName);
    case "GET_ENTITY_DEFINITIONS":
      return handleGetEntityDefinitions();
    case "UPDATE_FIELD_PERMISSIONS":
      return handleUpdateFieldPermissions(message.changes);
    case "CLEAR_CACHE":
      return handleClearCache(message.prefix);
    case "SF_HOST_DETECTED":
      return handleSfHostDetected(message.sfHost);
    default:
      throw new Error(
        `不明なメッセージタイプ: ${(message as { type: string }).type}`,
      );
  }
}

// --- 各ハンドラ実装 ---

/** セッションが必要な操作の前提チェック */
async function requireSession(): Promise<SfSession> {
  const session = await getSession();
  if (!session) {
    throw new SfSessionExpiredError();
  }
  return session;
}

async function handleGetSession(): Promise<SfSession | null> {
  return getSession();
}

async function handleGetPermissionSets(): Promise<PermissionSetInfo[]> {
  const session = await requireSession();
  const cacheKey = buildCacheKey(session.orgId, "permissionSets", "all");

  // キャッシュ確認
  const cached = await cacheGet<PermissionSetInfo[]>(cacheKey);
  if (cached) return cached;

  const result = await query<SfPermissionSet>(session, QUERY_PERMISSION_SETS);
  const mapped = result.records.map(toPermissionSetInfo);

  await cacheSet(cacheKey, mapped, CACHE_TTL_METADATA);
  return mapped;
}

async function handleGetFieldPermissions(
  objectApiName: string,
  permissionSetIds: string[],
): Promise<FieldPermissionEntry[]> {
  const session = await requireSession();
  const cacheKey = buildCacheKey(
    session.orgId,
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
  objectApiName: string,
  permissionSetIds: string[],
): Promise<ObjectPermissionEntry[]> {
  const session = await requireSession();
  const cacheKey = buildCacheKey(
    session.orgId,
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
  objectApiName: string,
): Promise<FieldInfo[]> {
  const session = await requireSession();
  const cacheKey = buildCacheKey(
    session.orgId,
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

async function handleGetEntityDefinitions(): Promise<ObjectInfo[]> {
  const session = await requireSession();
  const cacheKey = buildCacheKey(session.orgId, "entities", "all");

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
  changes: BulkPermissionChange[],
): Promise<PermissionChangeResult> {
  const session = await requireSession();
  const grouped = groupChangesForApi(changes);

  const updates: { Id: string; PermissionsRead?: boolean; PermissionsEdit?: boolean }[] = [];
  const creates: Record<string, unknown>[] = [];

  for (const entry of grouped.values()) {
    if (entry.id) {
      // 既存レコード更新
      const rec: { Id: string; PermissionsRead?: boolean; PermissionsEdit?: boolean } = {
        Id: entry.id,
      };
      if (entry.read !== undefined) rec.PermissionsRead = entry.read;
      if (entry.edit !== undefined) rec.PermissionsEdit = entry.edit;
      updates.push(rec);
    } else {
      // 新規レコード作成
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

  // バッチ更新
  if (updates.length > 0) {
    const updateResults = await collectionUpdate(
      session,
      "FieldPermissions",
      updates,
    );
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

  // バッチ作成
  if (creates.length > 0) {
    const createResults = await collectionCreate(
      session,
      "FieldPermissions",
      creates,
    );
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

  // 権限キャッシュを無効化
  await cacheDeleteByPrefix(`sf:${session.orgId}:fieldPerms:`);
  await cacheDeleteByPrefix(`sf:${session.orgId}:objPerms:`);

  return {
    success: errors.length === 0,
    totalChanges: updates.length + creates.length,
    successCount,
    failureCount: errors.length,
    errors,
  };
}

async function handleClearCache(
  prefix?: string,
): Promise<{ cleared: boolean }> {
  if (prefix) {
    await cacheDeleteByPrefix(prefix);
  } else {
    await cacheDeleteByPrefix("sf:");
  }
  return { cleared: true };
}

async function handleSfHostDetected(
  sfHost: string,
): Promise<{ ok: boolean }> {
  // セッション情報をキャッシュに保持
  await getSessionForHost(sfHost);
  // 最後に検出したホストを保存
  await chrome.storage.local.set({ lastSfHost: sfHost });
  return { ok: true };
}
