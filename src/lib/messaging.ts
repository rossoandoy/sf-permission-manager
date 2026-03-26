/**
 * Background Service Worker との型安全なメッセージング
 * sf-custom-config-tool パターン: Popup がホスト名を管理し、各リクエストに渡す
 */

import type {
  PermissionSetInfo,
  FieldPermissionEntry,
  ObjectPermissionEntry,
  FieldInfo,
  ObjectInfo,
  BulkPermissionChange,
  PermissionChangeResult,
} from "../types/permissions";

/** バックグラウンドからのエラーレスポンス */
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

// --- 接続確認（ホスト名不要） ---

/** アクティブタブのURLからSFホスト名を解決 */
export function getSfHost(url: string): Promise<{ sfHost: string | null }> {
  return sendMessage<{ sfHost: string | null }>({
    type: "GET_SF_HOST",
    url,
  });
}

/** sid cookieの存在で接続状態を確認 */
export function getStatus(): Promise<{ connected: boolean; hostname: string | null }> {
  return sendMessage<{ connected: boolean; hostname: string | null }>({
    type: "GET_STATUS",
  });
}

/** 指定ホストのsid cookieを取得 */
export function getSession(
  hostname: string,
): Promise<{ sessionId: string; hostname: string }> {
  return sendMessage<{ sessionId: string; hostname: string }>({
    type: "GET_SESSION",
    hostname,
  });
}

// --- データ取得（ホスト名必須） ---

export function getPermissionSets(hostname: string): Promise<PermissionSetInfo[]> {
  return sendMessage<PermissionSetInfo[]>({
    type: "GET_PERMISSION_SETS",
    hostname,
  });
}

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

export function getFieldDefinitions(
  hostname: string,
  objectApiName: string,
): Promise<FieldInfo[]> {
  return sendMessage<FieldInfo[]>({
    type: "GET_FIELD_DEFINITIONS",
    hostname,
    objectApiName,
  });
}

export function getEntityDefinitions(hostname: string): Promise<ObjectInfo[]> {
  return sendMessage<ObjectInfo[]>({
    type: "GET_ENTITY_DEFINITIONS",
    hostname,
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

export function clearCache(prefix?: string): Promise<{ cleared: boolean }> {
  return sendMessage<{ cleared: boolean }>({
    type: "CLEAR_CACHE",
    prefix,
  });
}

export function getDetectedObject(): Promise<{ objectApiName: string | null }> {
  return sendMessage<{ objectApiName: string | null }>({
    type: "GET_DETECTED_OBJECT",
  });
}
