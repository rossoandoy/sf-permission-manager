/**
 * SFセッション管理フック
 * マウント時に自動接続を試みる
 */

import { useEffect, useCallback } from "react";
import { usePermissionStore } from "../stores/permission-store";
import { getSession, clearCache } from "../lib/messaging";

export function useSfSession() {
  const { state, dispatch } = usePermissionStore();

  const connect = useCallback(async () => {
    dispatch({ type: "SET_CONNECTION_STATUS", status: "connecting" });
    try {
      const session = await getSession();
      dispatch({ type: "SET_SESSION", session });
    } catch (err) {
      dispatch({
        type: "SET_CONNECTION_STATUS",
        status: "error",
        error:
          err instanceof Error
            ? err.message
            : "セッション取得に失敗しました",
      });
    }
  }, [dispatch]);

  const reconnect = useCallback(async () => {
    await clearCache();
    await connect();
  }, [connect]);

  // マウント時に自動接続
  useEffect(() => {
    void connect();
  }, [connect]);

  return {
    session: state.session,
    status: state.connectionStatus,
    error: state.connectionError,
    reconnect,
  };
}
