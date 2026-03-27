/**
 * 権限管理の状態管理（useReducer ベース）
 * グループ → PS → オブジェクト フロー対応
 */

import {
  createContext,
  useContext,
  useReducer,
  type Dispatch,
  type ReactNode,
  createElement,
} from "react";
import type { SfSession, SfPermissionSetGroup } from "../../types/salesforce";
import type {
  PermissionSetInfo,
  FieldPermissionEntry,
  ObjectPermissionEntry,
  FieldInfo,
  ObjectInfo,
  PermissionChangeResult,
} from "../../types/permissions";

// --- 変更履歴 ---
export interface ChangeHistoryEntry {
  timestamp: number;
  objectApiName: string;
  type: "field" | "crud";
  totalChanges: number;
  successCount: number;
  failureCount: number;
}

// --- State ---

export interface PermissionState {
  // 接続
  session: SfSession | null;
  connectionStatus: "disconnected" | "connecting" | "connected" | "error";
  connectionError: string | null;

  // グループ
  psGroups: SfPermissionSetGroup[];
  selectedGroupId: string | null;

  // 権限セット
  permissionSets: PermissionSetInfo[];
  selectedPermissionSetIds: string[];

  // オブジェクト
  objects: ObjectInfo[];
  selectedObjectApiName: string | null;
  detectedObjectApiName: string | null;

  // フィールド・権限
  fields: FieldInfo[];
  fieldPermissions: Record<string, Record<string, FieldPermissionEntry>>;
  objectPermissions: Record<string, ObjectPermissionEntry>;

  // UI
  activeTab: "matrix" | "gaps" | "diff";
  loading: boolean;
  loadingMessage: string | null;

  // 変更追跡
  pendingChanges: Record<string, boolean>;
  /** CRUD変更: "permissionSetId:create|read|edit|delete|viewAll|modifyAll" → newValue */
  pendingCrudChanges: Record<string, boolean>;
  saving: boolean;
  lastSaveResult: PermissionChangeResult | null;
  /** 変更履歴 */
  changeHistory: ChangeHistoryEntry[];
}

export const initialPermissionState: PermissionState = {
  session: null,
  connectionStatus: "disconnected",
  connectionError: null,
  psGroups: [],
  selectedGroupId: null,
  permissionSets: [],
  selectedPermissionSetIds: [],
  objects: [],
  selectedObjectApiName: null,
  detectedObjectApiName: null,
  fields: [],
  fieldPermissions: {},
  objectPermissions: {},
  activeTab: "matrix",
  loading: false,
  loadingMessage: null,
  pendingChanges: {},
  pendingCrudChanges: {},
  saving: false,
  lastSaveResult: null,
  changeHistory: [],
};

// --- Actions ---

export type PermissionAction =
  | { type: "SET_SESSION"; session: SfSession | null }
  | { type: "SET_CONNECTION_STATUS"; status: PermissionState["connectionStatus"]; error?: string }
  | { type: "SET_PS_GROUPS"; groups: SfPermissionSetGroup[] }
  | { type: "SELECT_GROUP"; groupId: string | null }
  | { type: "SET_PERMISSION_SETS"; permissionSets: PermissionSetInfo[] }
  | { type: "SELECT_PERMISSION_SETS"; ids: string[] }
  | { type: "SET_OBJECTS"; objects: ObjectInfo[] }
  | { type: "UPDATE_OBJECT_META"; apiName: string; label: string; fieldCount: number }
  | { type: "SELECT_OBJECT"; objectApiName: string | null }
  | { type: "SET_DETECTED_OBJECT"; objectApiName: string | null }
  | { type: "SET_FIELDS"; fields: FieldInfo[] }
  | { type: "SET_FIELD_PERMISSIONS"; fieldPermissions: Record<string, Record<string, FieldPermissionEntry>> }
  | { type: "SET_OBJECT_PERMISSIONS"; objectPermissions: Record<string, ObjectPermissionEntry> }
  | { type: "SET_ACTIVE_TAB"; tab: PermissionState["activeTab"] }
  | { type: "SET_LOADING"; loading: boolean; message?: string }
  | { type: "TOGGLE_PERMISSION"; changeKey: string; newValue: boolean }
  | { type: "TOGGLE_CRUD"; changeKey: string; newValue: boolean }
  | { type: "CLEAR_PENDING" }
  | { type: "ADD_HISTORY"; entry: ChangeHistoryEntry }
  | { type: "SET_SAVING"; saving: boolean }
  | { type: "SET_SAVE_RESULT"; result: PermissionChangeResult }
  | { type: "RESET" };

// --- Reducer ---

export function permissionReducer(
  state: PermissionState,
  action: PermissionAction,
): PermissionState {
  switch (action.type) {
    case "SET_SESSION":
      return {
        ...state,
        session: action.session,
        connectionStatus: action.session ? "connected" : "disconnected",
        connectionError: null,
      };

    case "SET_CONNECTION_STATUS":
      return {
        ...state,
        connectionStatus: action.status,
        connectionError: action.error ?? null,
      };

    case "SET_PS_GROUPS":
      return { ...state, psGroups: action.groups };

    case "SELECT_GROUP":
      return {
        ...state,
        selectedGroupId: action.groupId,
        // グループ変更時にPS・オブジェクト・フィールドをリセット
        permissionSets: [],
        selectedPermissionSetIds: [],
        objects: [],
        selectedObjectApiName: null,
        fields: [],
        fieldPermissions: {},
        objectPermissions: {},
        pendingChanges: {},
        lastSaveResult: null,
      };

    case "SET_PERMISSION_SETS":
      return {
        ...state,
        permissionSets: action.permissionSets,
        selectedPermissionSetIds:
          state.selectedPermissionSetIds.length === 0
            ? action.permissionSets.map((ps) => ps.id)
            : state.selectedPermissionSetIds,
      };

    case "SELECT_PERMISSION_SETS":
      return { ...state, selectedPermissionSetIds: action.ids };

    case "SET_OBJECTS":
      return { ...state, objects: action.objects };

    case "UPDATE_OBJECT_META":
      return {
        ...state,
        objects: state.objects.map((o) =>
          o.apiName === action.apiName
            ? { ...o, label: action.label, fieldCount: action.fieldCount }
            : o,
        ),
      };

    case "SELECT_OBJECT":
      return {
        ...state,
        selectedObjectApiName: action.objectApiName,
        fields: [],
        fieldPermissions: {},
        objectPermissions: {},
        pendingChanges: {},
        lastSaveResult: null,
      };

    case "SET_DETECTED_OBJECT":
      return { ...state, detectedObjectApiName: action.objectApiName };

    case "SET_FIELDS":
      return { ...state, fields: action.fields };

    case "SET_FIELD_PERMISSIONS":
      return { ...state, fieldPermissions: action.fieldPermissions };

    case "SET_OBJECT_PERMISSIONS":
      return { ...state, objectPermissions: action.objectPermissions };

    case "SET_ACTIVE_TAB":
      return { ...state, activeTab: action.tab };

    case "SET_LOADING":
      return { ...state, loading: action.loading, loadingMessage: action.message ?? null };

    case "TOGGLE_PERMISSION":
      return {
        ...state,
        pendingChanges: { ...state.pendingChanges, [action.changeKey]: action.newValue },
        lastSaveResult: null,
      };

    case "TOGGLE_CRUD":
      return {
        ...state,
        pendingCrudChanges: { ...state.pendingCrudChanges, [action.changeKey]: action.newValue },
        lastSaveResult: null,
      };

    case "CLEAR_PENDING":
      return { ...state, pendingChanges: {}, pendingCrudChanges: {}, lastSaveResult: null };

    case "ADD_HISTORY":
      return { ...state, changeHistory: [action.entry, ...state.changeHistory].slice(0, 50) };

    case "SET_SAVING":
      return { ...state, saving: action.saving };

    case "SET_SAVE_RESULT":
      return {
        ...state,
        saving: false,
        lastSaveResult: action.result,
        pendingChanges: action.result.success ? {} : state.pendingChanges,
        pendingCrudChanges: action.result.success ? {} : state.pendingCrudChanges,
      };

    case "RESET":
      return initialPermissionState;

    default:
      return state;
  }
}

// --- Context ---

interface PermissionContextValue {
  state: PermissionState;
  dispatch: Dispatch<PermissionAction>;
}

const PermissionContext = createContext<PermissionContextValue | null>(null);

export function PermissionProvider({ children }: { children: ReactNode }): ReactNode {
  const [state, dispatch] = useReducer(permissionReducer, initialPermissionState);
  return createElement(PermissionContext.Provider, { value: { state, dispatch } }, children);
}

export function usePermissionStore(): PermissionContextValue {
  const ctx = useContext(PermissionContext);
  if (!ctx) throw new Error("usePermissionStore は PermissionProvider 内で使用してください");
  return ctx;
}
