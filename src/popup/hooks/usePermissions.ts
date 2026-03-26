/**
 * 権限データ管理フック
 * オブジェクト選択後のフィールド権限取得・変更・保存を担当
 */

import { useEffect, useCallback, useMemo } from "react";
import { usePermissionStore } from "../stores/permission-store";
import {
  getFieldPermissions,
  getObjectPermissions,
  updateFieldPermissions,
} from "../lib/messaging";
import {
  buildFieldPermissionMatrix,
  buildBulkChanges,
} from "../../lib/permission-utils";
import type { PermissionMatrix } from "../../types/permissions";

export function usePermissions() {
  const { state, dispatch } = usePermissionStore();

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
          getFieldPermissions(selectedObjectApiName, selectedPermissionSetIds),
          getObjectPermissions(selectedObjectApiName, selectedPermissionSetIds),
        ]);

        // フィールド権限をマトリクス形式に変換
        const matrix = buildFieldPermissionMatrix(fieldPerms);
        dispatch({ type: "SET_FIELD_PERMISSIONS", fieldPermissions: matrix });

        // オブジェクト権限をマップ形式に変換
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
  }, [selectedObjectApiName, selectedPermissionSetIds, fields, dispatch]);

  // 権限トグル
  const togglePermission = useCallback(
    (
      fieldQualifiedName: string,
      permissionSetId: string,
      permission: "read" | "edit",
    ) => {
      const changeKey = `${fieldQualifiedName}:${permissionSetId}:${permission}`;

      // 現在の値を確認（pending > existing > false）
      const existingPending = pendingChanges[changeKey];
      if (existingPending !== undefined) {
        // 既にpendingの場合はトグル
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

  // 保存
  const saveChanges = useCallback(async () => {
    if (Object.keys(pendingChanges).length === 0) return;

    dispatch({ type: "SET_SAVING", saving: true });
    try {
      const changes = buildBulkChanges(pendingChanges, fieldPermissions);
      const result = await updateFieldPermissions(changes);
      dispatch({ type: "SET_SAVE_RESULT", result });

      // 成功時は権限データをリロード
      if (result.success && selectedObjectApiName) {
        const fieldPerms = await getFieldPermissions(
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
    pendingChanges,
    fieldPermissions,
    selectedObjectApiName,
    selectedPermissionSetIds,
    dispatch,
  ]);

  // 変更をキャンセル
  const cancelChanges = useCallback(() => {
    dispatch({ type: "CLEAR_PENDING" });
  }, [dispatch]);

  // マトリクスデータ構築
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
