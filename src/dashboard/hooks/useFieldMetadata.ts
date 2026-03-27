/**
 * グループ → PS → オブジェクト フロー管理
 */

import { useEffect, useCallback } from "react";
import { usePermissionStore } from "../stores/permission-store";
import {
  getPsGroups,
  getPsGroupComponents,
  getPermissionSetsByIds,
  getObjectsWithPermissions,
  describeObjectFields,
} from "../../lib/messaging";

export function useFieldMetadata() {
  const { state, dispatch } = usePermissionStore();
  const hostname = state.session?.sfHost ?? null;

  // 接続後にグループ一覧を取得
  useEffect(() => {
    if (state.connectionStatus !== "connected" || !hostname) return;

    const load = async () => {
      dispatch({ type: "SET_LOADING", loading: true, message: "権限セットグループを取得中..." });
      try {
        const groups = await getPsGroups(hostname);
        dispatch({ type: "SET_PS_GROUPS", groups });
      } catch (err) {
        console.error("グループ取得エラー:", err);
        dispatch({
          type: "SET_CONNECTION_STATUS",
          status: "error",
          error: err instanceof Error ? err.message : "データ取得に失敗しました",
        });
      } finally {
        dispatch({ type: "SET_LOADING", loading: false });
      }
    };

    void load();
  }, [state.connectionStatus, hostname, dispatch]);

  // グループ選択 → 含まれるPS取得 → オブジェクト取得
  const selectGroup = useCallback(
    async (groupId: string) => {
      if (!hostname) return;
      dispatch({ type: "SELECT_GROUP", groupId });
      dispatch({ type: "SET_LOADING", loading: true, message: "権限セットを取得中..." });
      try {
        const { permissionSetIds } = await getPsGroupComponents(hostname, groupId);
        const permissionSets = await getPermissionSetsByIds(hostname, permissionSetIds);
        dispatch({ type: "SET_PERMISSION_SETS", permissionSets });

        // 全PSのIDでオブジェクト取得（チェック状態に関係なく）
        if (permissionSetIds.length > 0) {
          dispatch({ type: "SET_LOADING", loading: true, message: "オブジェクト一覧を取得中..." });
          const objects = await getObjectsWithPermissions(hostname, permissionSetIds);
          dispatch({ type: "SET_OBJECTS", objects });
        }
      } catch (err) {
        console.error("グループ詳細取得エラー:", err);
      } finally {
        dispatch({ type: "SET_LOADING", loading: false });
      }
    },
    [hostname, dispatch],
  );

  // オブジェクト選択 → describe でフィールド取得
  const loadFieldsForObject = useCallback(
    async (objectApiName: string) => {
      if (!hostname) return;
      dispatch({ type: "SELECT_OBJECT", objectApiName });
      dispatch({ type: "SET_LOADING", loading: true, message: "フィールド情報を取得中..." });
      try {
        const { fields, fieldCount } = await describeObjectFields(hostname, objectApiName);
        dispatch({ type: "SET_FIELDS", fields });
        // フィールド数のみ更新（ラベルは変えない → ソート順が安定）
        dispatch({ type: "UPDATE_OBJECT_META", apiName: objectApiName, fieldCount });
      } catch (err) {
        console.error("フィールド取得エラー:", err);
      } finally {
        dispatch({ type: "SET_LOADING", loading: false });
      }
    },
    [hostname, dispatch],
  );

  return {
    psGroups: state.psGroups,
    selectedGroupId: state.selectedGroupId,
    objects: state.objects,
    fields: state.fields,
    permissionSets: state.permissionSets,
    selectedObjectApiName: state.selectedObjectApiName,
    loading: state.loading,
    loadingMessage: state.loadingMessage,
    selectGroup,
    loadFieldsForObject,
  };
}
