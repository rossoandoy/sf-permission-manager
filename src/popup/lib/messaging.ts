/**
 * Background Service Worker との型安全なメッセージング
 */

import type { SfSession } from "../../types/salesforce";
import type {
  PermissionSetInfo,
  FieldPermissionEntry,
  ObjectPermissionEntry,
  FieldInfo,
  ObjectInfo,
  BulkPermissionChange,
  PermissionChangeResult,
} from "../../types/permissions";

/** バックグラウンドからのエラーレスポンス */
interface ErrorResponse {
  error: string;
  code?: string;
  statusCode?: number;
}

function isErrorResponse(value: unknown): value is ErrorResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as ErrorResponse).error === "string"
  );
}

/**
 * Background にメッセージを送信し、レスポンスを返す
 */
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

// --- 型付きコンビニエンス関数 ---

export function getSession(): Promise<SfSession | null> {
  return sendMessage<SfSession | null>({ type: "GET_SESSION" });
}

export function getPermissionSets(): Promise<PermissionSetInfo[]> {
  return sendMessage<PermissionSetInfo[]>({ type: "GET_PERMISSION_SETS" });
}

export function getFieldPermissions(
  objectApiName: string,
  permissionSetIds: string[],
): Promise<FieldPermissionEntry[]> {
  return sendMessage<FieldPermissionEntry[]>({
    type: "GET_FIELD_PERMISSIONS",
    objectApiName,
    permissionSetIds,
  });
}

export function getObjectPermissions(
  objectApiName: string,
  permissionSetIds: string[],
): Promise<ObjectPermissionEntry[]> {
  return sendMessage<ObjectPermissionEntry[]>({
    type: "GET_OBJECT_PERMISSIONS",
    objectApiName,
    permissionSetIds,
  });
}

export function getFieldDefinitions(
  objectApiName: string,
): Promise<FieldInfo[]> {
  return sendMessage<FieldInfo[]>({
    type: "GET_FIELD_DEFINITIONS",
    objectApiName,
  });
}

export function getEntityDefinitions(): Promise<ObjectInfo[]> {
  return sendMessage<ObjectInfo[]>({ type: "GET_ENTITY_DEFINITIONS" });
}

export function updateFieldPermissions(
  changes: BulkPermissionChange[],
): Promise<PermissionChangeResult> {
  return sendMessage<PermissionChangeResult>({
    type: "UPDATE_FIELD_PERMISSIONS",
    changes,
  });
}

export function clearCache(prefix?: string): Promise<{ cleared: boolean }> {
  return sendMessage<{ cleared: boolean }>({
    type: "CLEAR_CACHE",
    prefix,
  });
}
