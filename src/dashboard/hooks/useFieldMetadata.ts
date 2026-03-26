/**
 * フィールド/エンティティメタデータ取得フック
 * ホスト名を各APIコールに渡す
 */

import { useEffect, useCallback, useRef } from "react";
import { usePermissionStore } from "../stores/permission-store";
import {
  getEntityDefinitions,
  getFieldDefinitions,
  getPermissionSets,
  getDetectedObject,
} from "../../lib/messaging";

export function useFieldMetadata() {
  const { state, dispatch } = usePermissionStore();
  const hostname = state.session?.sfHost ?? null;
  const autoSelectDone = useRef(false);

  // 接続後にエンティティ一覧・権限セット一覧・検出オブジェクトを取得
  useEffect(() => {
    if (state.connectionStatus !== "connected" || !hostname) return;

    const load = async () => {
      dispatch({ type: "SET_LOADING", loading: true, message: "オブジェクト一覧を取得中..." });
      try {
        const [objects, permissionSets, detected] = await Promise.all([
          getEntityDefinitions(hostname),
          getPermissionSets(hostname),
          getDetectedObject(),
        ]);
        dispatch({ type: "SET_OBJECTS", objects });
        dispatch({ type: "SET_PERMISSION_SETS", permissionSets });

        if (detected.objectApiName) {
          dispatch({ type: "SET_DETECTED_OBJECT", objectApiName: detected.objectApiName });
        }
      } catch (err) {
        console.debug("メタデータ取得エラー:", err);
      } finally {
        dispatch({ type: "SET_LOADING", loading: false });
      }
    };

    void load();
  }, [state.connectionStatus, hostname, dispatch]);

  // 検出オブジェクトが設定されたら自動選択（1回のみ）
  useEffect(() => {
    if (autoSelectDone.current) return;
    if (
      !state.detectedObjectApiName ||
      state.selectedObjectApiName !== null ||
      state.objects.length === 0 ||
      state.loading ||
      !hostname
    ) return;

    const exists = state.objects.some(
      (o) => o.apiName === state.detectedObjectApiName,
    );
    if (exists) {
      autoSelectDone.current = true;
      // 直接dispatchしてloadFieldsForObjectのuseCallback依存を避ける
      dispatch({ type: "SELECT_OBJECT", objectApiName: state.detectedObjectApiName });
      dispatch({ type: "SET_LOADING", loading: true, message: "フィールド定義を取得中..." });
      getFieldDefinitions(hostname, state.detectedObjectApiName)
        .then((fields) => dispatch({ type: "SET_FIELDS", fields }))
        .catch((err) => console.debug("自動選択フィールド取得エラー:", err))
        .finally(() => dispatch({ type: "SET_LOADING", loading: false }));
    }
  }, [state.detectedObjectApiName, state.objects, state.selectedObjectApiName, state.loading, hostname, dispatch]);

  const loadFieldsForObject = useCallback(
    async (objectApiName: string) => {
      if (!hostname) return;
      dispatch({ type: "SELECT_OBJECT", objectApiName });
      dispatch({
        type: "SET_LOADING",
        loading: true,
        message: "フィールド定義を取得中...",
      });
      try {
        const fields = await getFieldDefinitions(hostname, objectApiName);
        dispatch({ type: "SET_FIELDS", fields });
      } catch (err) {
        console.debug("フィールド定義取得エラー:", err);
      } finally {
        dispatch({ type: "SET_LOADING", loading: false });
      }
    },
    [hostname, dispatch],
  );

  return {
    objects: state.objects,
    fields: state.fields,
    permissionSets: state.permissionSets,
    selectedObjectApiName: state.selectedObjectApiName,
    detectedObjectApiName: state.detectedObjectApiName,
    loading: state.loading,
    loadingMessage: state.loadingMessage,
    loadFieldsForObject,
  };
}
