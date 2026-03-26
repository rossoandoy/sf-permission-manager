/**
 * フィールド/エンティティメタデータ取得フック
 */

import { useEffect, useCallback } from "react";
import { usePermissionStore } from "../stores/permission-store";
import {
  getEntityDefinitions,
  getFieldDefinitions,
  getPermissionSets,
} from "../lib/messaging";

export function useFieldMetadata() {
  const { state, dispatch } = usePermissionStore();

  // 接続後にエンティティ一覧と権限セット一覧を取得
  useEffect(() => {
    if (state.connectionStatus !== "connected") return;

    const load = async () => {
      dispatch({ type: "SET_LOADING", loading: true, message: "オブジェクト一覧を取得中..." });
      try {
        const [objects, permissionSets] = await Promise.all([
          getEntityDefinitions(),
          getPermissionSets(),
        ]);
        dispatch({ type: "SET_OBJECTS", objects });
        dispatch({ type: "SET_PERMISSION_SETS", permissionSets });
      } catch (err) {
        console.debug("メタデータ取得エラー:", err);
      } finally {
        dispatch({ type: "SET_LOADING", loading: false });
      }
    };

    void load();
  }, [state.connectionStatus, dispatch]);

  // オブジェクト選択時にフィールド定義を取得
  const loadFieldsForObject = useCallback(
    async (objectApiName: string) => {
      dispatch({ type: "SELECT_OBJECT", objectApiName });
      dispatch({
        type: "SET_LOADING",
        loading: true,
        message: "フィールド定義を取得中...",
      });
      try {
        const fields = await getFieldDefinitions(objectApiName);
        dispatch({ type: "SET_FIELDS", fields });
      } catch (err) {
        console.debug("フィールド定義取得エラー:", err);
      } finally {
        dispatch({ type: "SET_LOADING", loading: false });
      }
    },
    [dispatch],
  );

  return {
    objects: state.objects,
    fields: state.fields,
    permissionSets: state.permissionSets,
    selectedObjectApiName: state.selectedObjectApiName,
    loading: state.loading,
    loadingMessage: state.loadingMessage,
    loadFieldsForObject,
  };
}
