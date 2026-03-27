/**
 * 権限データ管理フック
 * FLS + CRUD のトグル・保存を担当
 */

import { useEffect, useCallback, useMemo } from "react";
import { usePermissionStore } from "../stores/permission-store";
import {
  getFieldPermissions,
  getObjectPermissions,
  updateFieldPermissions,
  updateObjectPermissions,
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
    pendingCrudChanges,
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
        dispatch({ type: "SET_OBJECT_PERMISSIONS", objectPermissions: objPermMap });
      } catch (err) {
        console.debug("権限データ取得エラー:", err);
      } finally {
        dispatch({ type: "SET_LOADING", loading: false });
      }
    };

    void load();
  }, [hostname, selectedObjectApiName, selectedPermissionSetIds, fields, dispatch]);

  // FLS トグル
  const togglePermission = useCallback(
    (fieldQualifiedName: string, permissionSetId: string, permission: "read" | "edit") => {
      const changeKey = `${fieldQualifiedName}:${permissionSetId}:${permission}`;
      const existingPending = pendingChanges[changeKey];
      if (existingPending !== undefined) {
        dispatch({ type: "TOGGLE_PERMISSION", changeKey, newValue: !existingPending });
      } else {
        const existing = fieldPermissions[fieldQualifiedName]?.[permissionSetId];
        const currentValue = permission === "read" ? (existing?.read ?? false) : (existing?.edit ?? false);
        dispatch({ type: "TOGGLE_PERMISSION", changeKey, newValue: !currentValue });
      }
    },
    [pendingChanges, fieldPermissions, dispatch],
  );

  // CRUD トグル
  const toggleCrud = useCallback(
    (permissionSetId: string, crudKey: string) => {
      const changeKey = `${permissionSetId}:${crudKey}`;
      const existingPending = pendingCrudChanges[changeKey];
      if (existingPending !== undefined) {
        dispatch({ type: "TOGGLE_CRUD", changeKey, newValue: !existingPending });
      } else {
        const perm = objectPermissions[permissionSetId];
        const currentValue = perm ? (perm as unknown as Record<string, unknown>)[crudKey] === true : false;
        dispatch({ type: "TOGGLE_CRUD", changeKey, newValue: !currentValue });
      }
    },
    [pendingCrudChanges, objectPermissions, dispatch],
  );

  // 保存 (FLS + CRUD)
  const saveChanges = useCallback(async () => {
    if (!hostname || !selectedObjectApiName) return;

    const hasFls = Object.keys(pendingChanges).length > 0;
    const hasCrud = Object.keys(pendingCrudChanges).length > 0;
    if (!hasFls && !hasCrud) return;

    dispatch({ type: "SET_SAVING", saving: true });
    try {
      let totalChanges = 0;
      let successCount = 0;
      let failureCount = 0;

      // FLS 保存
      if (hasFls) {
        const changes = buildBulkChanges(pendingChanges, fieldPermissions);
        const result = await updateFieldPermissions(hostname, changes);
        totalChanges += result.totalChanges;
        successCount += result.successCount;
        failureCount += result.failureCount;
      }

      // CRUD 保存
      if (hasCrud) {
        const crudResult = await updateObjectPermissions(
          hostname,
          selectedObjectApiName,
          pendingCrudChanges,
          objectPermissions,
        );
        totalChanges += crudResult.totalChanges;
        successCount += crudResult.successCount;
        failureCount += crudResult.failureCount;
      }

      const success = failureCount === 0;
      dispatch({
        type: "SET_SAVE_RESULT",
        result: { success, totalChanges, successCount, failureCount, errors: [] },
      });

      // 変更履歴に追加
      dispatch({
        type: "ADD_HISTORY",
        entry: {
          timestamp: Date.now(),
          objectApiName: selectedObjectApiName,
          type: hasCrud && !hasFls ? "crud" : "field",
          totalChanges,
          successCount,
          failureCount,
        },
      });

      // 成功時はデータリロード
      if (success) {
        const [fieldPerms, objPerms] = await Promise.all([
          getFieldPermissions(hostname, selectedObjectApiName, selectedPermissionSetIds),
          getObjectPermissions(hostname, selectedObjectApiName, selectedPermissionSetIds),
        ]);
        dispatch({ type: "SET_FIELD_PERMISSIONS", fieldPermissions: buildFieldPermissionMatrix(fieldPerms) });
        const objPermMap: Record<string, (typeof objPerms)[0]> = {};
        for (const perm of objPerms) objPermMap[perm.permissionSetId] = perm;
        dispatch({ type: "SET_OBJECT_PERMISSIONS", objectPermissions: objPermMap });
      }
    } catch (err) {
      dispatch({
        type: "SET_SAVE_RESULT",
        result: {
          success: false,
          totalChanges: Object.keys(pendingChanges).length + Object.keys(pendingCrudChanges).length,
          successCount: 0,
          failureCount: Object.keys(pendingChanges).length + Object.keys(pendingCrudChanges).length,
          errors: [{
            changeKey: "all",
            errorCode: "UNKNOWN",
            message: err instanceof Error ? err.message : "保存に失敗しました",
          }],
        },
      });
    }
  }, [hostname, pendingChanges, pendingCrudChanges, fieldPermissions, objectPermissions, selectedObjectApiName, selectedPermissionSetIds, dispatch]);

  const cancelChanges = useCallback(() => {
    dispatch({ type: "CLEAR_PENDING" });
  }, [dispatch]);

  const matrix: PermissionMatrix | null = useMemo(() => {
    if (!selectedObjectApiName || fields.length === 0) return null;
    const objectInfo = state.objects.find((o) => o.apiName === selectedObjectApiName);
    if (!objectInfo) return null;
    const selectedPs = state.permissionSets.filter((ps) => selectedPermissionSetIds.includes(ps.id));
    return { object: objectInfo, fields, permissionSets: selectedPs, fieldPermissions, objectPermissions };
  }, [selectedObjectApiName, fields, state.objects, state.permissionSets, selectedPermissionSetIds, fieldPermissions, objectPermissions]);

  const totalPendingCount = Object.keys(pendingChanges).length + Object.keys(pendingCrudChanges).length;

  return {
    matrix,
    pendingChanges,
    pendingCrudChanges,
    pendingCount: totalPendingCount,
    saving,
    lastSaveResult,
    togglePermission,
    toggleCrud,
    saveChanges,
    cancelChanges,
    changeHistory: state.changeHistory,
  };
}
