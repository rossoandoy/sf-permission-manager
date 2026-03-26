/**
 * Popup — 接続確認 + Open Dashboard
 * sf-custom-config-tool と同じパターン
 */

import { useEffect, useState, type FC } from "react";
import { getSfHost, getSession, getStatus } from "../lib/messaging";

type State = "loading" | "connected" | "not-sf" | "no-session";

const App: FC = () => {
  const [state, setState] = useState<State>("loading");
  const [hostname, setHostname] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    void init();
  }, []);

  async function init() {
    setErrorMsg(null);
    try {
      // アクティブタブURLからSFホスト名を取得
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabUrl = tab?.url;

      if (!tabUrl) {
        setState("not-sf");
        return;
      }

      const hostResult = await getSfHost(tabUrl);

      if (!hostResult?.sfHost) {
        // SFページではない → フォールバック: 保存済みセッション確認
        const status = await getStatus();
        if (status.connected && status.hostname) {
          setHostname(status.hostname);
          setState("connected");
        } else {
          setState("not-sf");
        }
        return;
      }

      // sid cookie 確認
      try {
        const session = await getSession(hostResult.sfHost);
        setHostname(session.hostname);
        setState("connected");
      } catch (sessionErr) {
        setErrorMsg(
          sessionErr instanceof Error ? sessionErr.message : "セッション確認に失敗しました",
        );
        setState("no-session");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "エラーが発生しました");
      setState("no-session");
    }
  }

  function openDashboard() {
    if (!hostname) return;
    const dashUrl = chrome.runtime.getURL(
      `src/dashboard/index.html?host=${encodeURIComponent(hostname)}`,
    );
    chrome.tabs.create({ url: dashUrl });
    window.close();
  }

  return (
    <div className="w-[320px] p-4 bg-zinc-900 text-zinc-100">
      {/* ヘッダー */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded bg-violet-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
          P
        </div>
        <div>
          <h1 className="text-sm font-bold leading-tight">Permission Set Manager</h1>
          <p className="text-[10px] text-zinc-500">for Salesforce</p>
        </div>
      </div>

      {/* Loading */}
      {state === "loading" && (
        <div className="flex items-center justify-center py-6">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-zinc-400">接続確認中...</span>
          </div>
        </div>
      )}

      {/* Connected */}
      {state === "connected" && hostname && (
        <div>
          <div className="rounded-lg bg-emerald-900/30 border border-emerald-800/50 px-3 py-2 mb-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-xs text-emerald-300">接続済み</span>
            </div>
            <p className="text-xs text-zinc-300 mt-1 break-all">{hostname}</p>
          </div>
          <button
            onClick={openDashboard}
            className="w-full py-2.5 text-sm font-medium rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors"
          >
            Open Dashboard
          </button>
        </div>
      )}

      {/* Not SF page */}
      {state === "not-sf" && (
        <div className="rounded-lg bg-zinc-800 px-3 py-3">
          <p className="text-xs text-zinc-400">
            Salesforce のページを開いてから拡張アイコンをクリックしてください。
          </p>
        </div>
      )}

      {/* No session */}
      {state === "no-session" && (
        <div className="rounded-lg bg-amber-900/20 border border-amber-800/50 px-3 py-3">
          <p className="text-xs text-amber-300">
            Salesforce にログインしてください。
          </p>
          {errorMsg && (
            <p className="text-[10px] text-zinc-500 mt-1">{errorMsg}</p>
          )}
          <button
            onClick={() => {
              setState("loading");
              void init();
            }}
            className="mt-2 w-full py-1.5 text-xs rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors"
          >
            再確認
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
