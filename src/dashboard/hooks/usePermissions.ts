/**
 * 権限データ管理フック
 * ホスト名を各APIコールに渡す
 */

import { useEffect, useCallback, useMemo } from "react";
import { usePermissionStore } from "../stores/permission-store";
import {
  getFieldPermissions,
  getObjectPermissions,
  updateFieldPermissions,
} from "../../lib/messaging";
import {
  buildFieldPermissionMatrix,
  buildBulkChanges,
} from "../../lib/permission-utils";
import type { PermissionMatrix } from "../../types/permissions";

export function usePermissions() {
  const { state, dispatch } = usePermissionStore();
  const hostname = state.session?.sfHost ?? null;

  const {
    selectedObjectApiName,
    selectedPermissionSetIds,
    fields,
    fieldPermissions,
    objectPermissions,
    pendingChanges,
    saving,
    lastSaveResult,
  } = state;

  // フィールドが読み込まれたら権限データを取得
  useEffect(() => {
    if (
      !hostname ||
      !selectedObjectApiName ||
      selectedPermissionSetIds.length === 0 ||
      fields.length === 0
    )
      return;

    const load = async () => {
      dispatch({
        type: "SET_LOADING",
        loading: true,
        message: "権限データを取得中...",
      });
      try {
        const [fieldPerms, objPerms] = await Promise.all([
          getFieldPermissions(hostname, selectedObjectApiName, selectedPermissionSetIds),
          getObjectPermissions(hostname, selectedObjectApiName, selectedPermissionSetIds),
        ]);

        const matrix = buildFieldPermissionMatrix(fieldPerms);
        dispatch({ type: "SET_FIELD_PERMISSIONS", fieldPermissions: matrix });

        const objPermMap: Record<string, (typeof objPerms)[0]> = {};
        for (const perm of objPerms) {
          objPermMap[perm.permissionSetId] = perm;
        }
        dispatch({
          type: "SET_OBJECT_PERMISSIONS",
          objectPermissions: objPermMap,
        });
      } catch (err) {
        console.debug("権限データ取得エラー:", err);
      } finally {
        dispatch({ type: "SET_LOADING", loading: false });
      }
    };

    void load();
  }, [hostname, selectedObjectApiName, selectedPermissionSetIds, fields, dispatch]);

  const togglePermission = useCallback(
    (
      fieldQualifiedName: string,
      permissionSetId: string,
      permission: "read" | "edit",
    ) => {
      const changeKey = `${fieldQualifiedName}:${permissionSetId}:${permission}`;
      const existingPending = pendingChanges[changeKey];
      if (existingPending !== undefined) {
        dispatch({
          type: "TOGGLE_PERMISSION",
          changeKey,
          newValue: !existingPending,
        });
      } else {
        const existing =
          fieldPermissions[fieldQualifiedName]?.[permissionSetId];
        const currentValue =
          permission === "read"
            ? (existing?.read ?? false)
            : (existing?.edit ?? false);
        dispatch({
          type: "TOGGLE_PERMISSION",
          changeKey,
          newValue: !currentValue,
        });
      }
    },
    [pendingChanges, fieldPermissions, dispatch],
  );

  const saveChanges = useCallback(async () => {
    if (!hostname || Object.keys(pendingChanges).length === 0) return;

    dispatch({ type: "SET_SAVING", saving: true });
    try {
      const changes = buildBulkChanges(pendingChanges, fieldPermissions);
      const result = await updateFieldPermissions(hostname, changes);
      dispatch({ type: "SET_SAVE_RESULT", result });

      if (result.success && selectedObjectApiName) {
        const fieldPerms = await getFieldPermissions(
          hostname,
          selectedObjectApiName,
          selectedPermissionSetIds,
        );
        const matrix = buildFieldPermissionMatrix(fieldPerms);
        dispatch({ type: "SET_FIELD_PERMISSIONS", fieldPermissions: matrix });
      }
    } catch (err) {
      dispatch({
        type: "SET_SAVE_RESULT",
        result: {
          success: false,
          totalChanges: Object.keys(pendingChanges).length,
          successCount: 0,
          failureCount: Object.keys(pendingChanges).length,
          errors: [
            {
              changeKey: "all",
              errorCode: "UNKNOWN",
              message:
                err instanceof Error ? err.message : "保存に失敗しました",
            },
          ],
        },
      });
    }
  }, [
    hostname,
    pendingChanges,
    fieldPermissions,
    selectedObjectApiName,
    selectedPermissionSetIds,
    dispatch,
  ]);

  const cancelChanges = useCallback(() => {
    dispatch({ type: "CLEAR_PENDING" });
  }, [dispatch]);

  const matrix: PermissionMatrix | null = useMemo(() => {
    if (!selectedObjectApiName || fields.length === 0) return null;

    const objectInfo = state.objects.find(
      (o) => o.apiName === selectedObjectApiName,
    );
    if (!objectInfo) return null;

    const selectedPs = state.permissionSets.filter((ps) =>
      selectedPermissionSetIds.includes(ps.id),
    );

    return {
      object: objectInfo,
      fields,
      permissionSets: selectedPs,
      fieldPermissions,
      objectPermissions,
    };
  }, [
    selectedObjectApiName,
    fields,
    state.objects,
    state.permissionSets,
    selectedPermissionSetIds,
    fieldPermissions,
    objectPermissions,
  ]);

  return {
    matrix,
    pendingChanges,
    pendingCount: Object.keys(pendingChanges).length,
    saving,
    lastSaveResult,
    togglePermission,
    saveChanges,
    cancelChanges,
  };
}
