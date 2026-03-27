/**
 * Service Worker エントリポイント
 *
 * sf-custom-config-tool パターン: Cookie broker のみ
 * - セッション取得（chrome.cookies）
 * - ホスト名解決
 * - 接続状態チェック
 * - Content Script からのホスト検出通知
 *
 * データ取得のAPI呼出はDashboard/拡張ページ側から直接行う
 */

import {
  getSfHostFromUrl,
  getSessionCookie,
  checkConnectionStatus,
  toApiHostname,
} from "./sf-session";

// --- メッセージ型定義 ---

type BackgroundMessage =
  | { type: "GET_SF_HOST"; url: string }
  | { type: "GET_SESSION"; hostname: string }
  | { type: "GET_STATUS" }
  | { type: "SF_HOST_DETECTED"; sfHost: string; currentObjectApiName?: string }
  | { type: "GET_DETECTED_OBJECT" };

export type { BackgroundMessage };

// --- メッセージハンドラ ---

chrome.runtime.onMessage.addListener(
  (
    message: BackgroundMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ) => {
    handleMessage(message)
      .then(sendResponse)
      .catch((err) => {
        sendResponse({
          error: err instanceof Error ? err.message : String(err),
          code: "UNKNOWN",
        });
      });
    return true;
  },
);

async function handleMessage(message: BackgroundMessage): Promise<unknown> {
  switch (message.type) {
    case "GET_SF_HOST":
      return { sfHost: getSfHostFromUrl(message.url) };
    case "GET_SESSION":
      return handleGetSession(message.hostname);
    case "GET_STATUS":
      return checkConnectionStatus();
    case "SF_HOST_DETECTED":
      return handleSfHostDetected(message.sfHost, message.currentObjectApiName);
    case "GET_DETECTED_OBJECT":
      return handleGetDetectedObject();
    default:
      throw new Error(`不明なメッセージタイプ: ${(message as { type: string }).type}`);
  }
}

// --- セッション ---

async function handleGetSession(
  hostname: string,
): Promise<{ sessionId: string; hostname: string } | { error: string }> {
  const result = await getSessionCookie(hostname);
  if (!result) {
    return { error: "sid cookie が見つかりません。Salesforce にログインしてください。" };
  }
  return result;
}

// --- ユーティリティ ---

async function handleSfHostDetected(
  sfHost: string,
  currentObjectApiName?: string,
): Promise<{ ok: boolean }> {
  const apiHost = toApiHostname(sfHost);
  const data: Record<string, string> = { lastSfHost: apiHost };
  if (currentObjectApiName) data.lastDetectedObject = currentObjectApiName;
  await chrome.storage.local.set(data);
  return { ok: true };
}

async function handleGetDetectedObject(): Promise<{ objectApiName: string | null }> {
  const result = await chrome.storage.local.get("lastDetectedObject");
  return { objectApiName: (result.lastDetectedObject as string) ?? null };
}
