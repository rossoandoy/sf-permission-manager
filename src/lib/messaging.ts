/**
 * Background Service Worker との型安全なメッセージング
 * グループ → PS → オブジェクト フロー対応
 */

import type {
  SfPermissionSetGroup,
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

// --- 接続 ---

export function getSfHost(url: string): Promise<{ sfHost: string | null }> {
  return sendMessage<{ sfHost: string | null }>({ type: "GET_SF_HOST", url });
}

export function getStatus(): Promise<{ connected: boolean; hostname: string | null }> {
  return sendMessage<{ connected: boolean; hostname: string | null }>({ type: "GET_STATUS" });
}

export function getSession(hostname: string): Promise<{ sessionId: string; hostname: string }> {
  return sendMessage<{ sessionId: string; hostname: string }>({ type: "GET_SESSION", hostname });
}

// --- 権限セットグループ ---

export function getPsGroups(hostname: string): Promise<SfPermissionSetGroup[]> {
  return sendMessage<SfPermissionSetGroup[]>({ type: "GET_PS_GROUPS", hostname });
}

export function getPsGroupComponents(
  hostname: string,
  groupId: string,
): Promise<{ permissionSetIds: string[] }> {
  return sendMessage<{ permissionSetIds: string[] }>({
    type: "GET_PS_GROUP_COMPONENTS",
    hostname,
    groupId,
  });
}

// --- 権限セット ---

export function getPermissionSets(hostname: string): Promise<PermissionSetInfo[]> {
  return sendMessage<PermissionSetInfo[]>({ type: "GET_PERMISSION_SETS", hostname });
}

export function getPermissionSetsByIds(
  hostname: string,
  ids: string[],
): Promise<PermissionSetInfo[]> {
  return sendMessage<PermissionSetInfo[]>({ type: "GET_PERMISSION_SETS_BY_IDS", hostname, ids });
}

// --- オブジェクト ---

export function getObjectsWithPermissions(
  hostname: string,
  permissionSetIds: string[],
): Promise<ObjectInfo[]> {
  return sendMessage<ObjectInfo[]>({
    type: "GET_OBJECTS_WITH_PERMISSIONS",
    hostname,
    permissionSetIds,
  });
}

export function describeObjectFields(
  hostname: string,
  objectApiName: string,
): Promise<{ fields: FieldInfo[] }> {
  return sendMessage<{ fields: FieldInfo[] }>({
    type: "DESCRIBE_OBJECT",
    hostname,
    objectApiName,
  });
}

// --- 権限データ ---

export function getFieldPermissions(
  hostname: string,
  objectApiName: string,
  permissionSetIds: string[],
): Promise<FieldPermissionEntry[]> {
  return sendMessage<FieldPermissionEntry[]>({
    type: "GET_FIELD_PERMISSIONS",
    hostname,
    objectApiName,
    permissionSetIds,
  });
}

export function getObjectPermissions(
  hostname: string,
  objectApiName: string,
  permissionSetIds: string[],
): Promise<ObjectPermissionEntry[]> {
  return sendMessage<ObjectPermissionEntry[]>({
    type: "GET_OBJECT_PERMISSIONS",
    hostname,
    objectApiName,
    permissionSetIds,
  });
}

export function updateFieldPermissions(
  hostname: string,
  changes: BulkPermissionChange[],
): Promise<PermissionChangeResult> {
  return sendMessage<PermissionChangeResult>({
    type: "UPDATE_FIELD_PERMISSIONS",
    hostname,
    changes,
  });
}

// --- ユーティリティ ---

export function clearCache(prefix?: string): Promise<{ cleared: boolean }> {
  return sendMessage<{ cleared: boolean }>({ type: "CLEAR_CACHE", prefix });
}

export function getDetectedObject(): Promise<{ objectApiName: string | null }> {
  return sendMessage<{ objectApiName: string | null }>({ type: "GET_DETECTED_OBJECT" });
}
