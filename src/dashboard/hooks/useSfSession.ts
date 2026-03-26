/**
 * Dashboard用セッションフック
 * URLパラメータ ?host=xxx からホスト名を取得
 * フォールバック: GET_STATUS で最後のホストを取得
 */

import { useEffect, useCallback, useState } from "react";
import { usePermissionStore } from "../stores/permission-store";
import { getSession, getStatus } from "../../lib/messaging";

function isSalesforceHost(host: string): boolean {
  return host.endsWith(".salesforce.com") || host.endsWith(".force.com");
}

export function useSfSession() {
  const { state, dispatch } = usePermissionStore();
  const [hostname, setHostname] = useState<string | null>(null);

  const connect = useCallback(async () => {
    dispatch({ type: "SET_CONNECTION_STATUS", status: "connecting" });
    try {
      // URLパラメータからホスト名を取得（SFドメインのみ許可）
      const params = new URLSearchParams(location.search);
      let host = params.get("host");

      // ホスト名のバリデーション: SFドメインのみ許可
      if (host && !isSalesforceHost(host)) {
        host = null;
      }

      // フォールバック: GET_STATUS
      if (!host) {
        const status = await getStatus();
        if (status.connected && status.hostname) {
          host = status.hostname;
        }
      }

      if (!host) {
        dispatch({ type: "SET_CONNECTION_STATUS", status: "disconnected" });
        return;
      }

      // sid cookie 確認
      const session = await getSession(host);
      setHostname(session.hostname);
      dispatch({
        type: "SET_SESSION",
        session: {
          accessToken: session.sessionId,
          instanceUrl: `https://${session.hostname}`,
          userId: "",
          orgId: "",
          sfHost: session.hostname,
        },
      });
    } catch (err) {
      dispatch({
        type: "SET_CONNECTION_STATUS",
        status: "error",
        error: err instanceof Error ? err.message : "接続に失敗しました",
      });
    }
  }, [dispatch]);

  useEffect(() => {
    void connect();
  }, [connect]);

  return {
    session: state.session,
    hostname,
    status: state.connectionStatus,
    error: state.connectionError,
    reconnect: connect,
  };
}
