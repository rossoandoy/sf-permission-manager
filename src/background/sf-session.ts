/**
 * Salesforce セッション管理
 * SF Inspector Reloaded / sf-custom-config-tool と同じ方式でセッションCookieを再利用
 *
 * 方針: Background はシンプルにCookie取得のみ。API検証はしない。
 */

import type { SfSession } from "../types/salesforce";

/**
 * Lightning/VF ホスト名を My Domain API ホスト名に変換する
 */
export function toApiHostname(hostname: string): string {
  // Lightning ドメイン → My Domain
  const lightningMatch = hostname.match(
    /^(.+?)\.(?:(sandbox|develop|scratch)\.)?lightning\.force\.com$/i,
  );
  if (lightningMatch) {
    const [, prefix, env] = lightningMatch;
    return env
      ? `${prefix}.${env}.my.salesforce.com`
      : `${prefix}.my.salesforce.com`;
  }

  // VisualForce ドメイン → My Domain
  const vfMatch = hostname.match(
    /^(.+?)(?:--[a-z0-9]+)?\.(?:vf|visualforce)\.(?:force\.)?com$/i,
  );
  if (vfMatch) {
    const [, prefix] = vfMatch;
    return `${prefix}.my.salesforce.com`;
  }

  return hostname;
}

/**
 * URLからSalesforceホスト名を抽出する（API用に正規化済み）
 * SF以外のURLの場合はnullを返す
 */
export function getSfHostFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const { hostname } = parsed;

    if (
      hostname.endsWith(".salesforce.com") ||
      hostname.endsWith(".force.com")
    ) {
      return toApiHostname(hostname);
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * 指定ホスト名のsid Cookieを取得する
 * Background Service Worker内でのみ呼び出し可能
 */
export async function getSessionCookie(
  hostname: string,
): Promise<{ sessionId: string; hostname: string } | null> {
  // まず指定ホストで直接取得
  const url = `https://${hostname}`;
  const cookie = await chrome.cookies.get({ url, name: "sid" });

  if (cookie?.value) {
    return { sessionId: cookie.value, hostname };
  }

  // フォールバック: 全SF sid cookieをスキャン
  const allCookies = await chrome.cookies.getAll({ name: "sid" });
  const sfCookie = allCookies.find(
    (c) =>
      c.domain.endsWith(".salesforce.com") ||
      c.domain.endsWith(".force.com"),
  );

  if (sfCookie?.value) {
    const cookieHost = sfCookie.domain.startsWith(".")
      ? sfCookie.domain.slice(1)
      : sfCookie.domain;
    const apiHost = toApiHostname(cookieHost);
    return { sessionId: sfCookie.value, hostname: apiHost };
  }

  return null;
}

/**
 * 接続状態チェック（sid Cookieの存在確認のみ、API呼び出しなし）
 */
export async function checkConnectionStatus(): Promise<{
  connected: boolean;
  hostname: string | null;
}> {
  // 保存済みホストを確認
  const result = await chrome.storage.local.get("lastSfHost");
  const lastHost = result.lastSfHost as string | undefined;

  if (lastHost) {
    const url = `https://${lastHost}`;
    const cookie = await chrome.cookies.get({ url, name: "sid" });
    if (cookie?.value) {
      return { connected: true, hostname: lastHost };
    }
  }

  // 全SF cookieスキャン
  const allCookies = await chrome.cookies.getAll({ name: "sid" });
  const sfCookie = allCookies.find((c) =>
    c.domain.endsWith(".salesforce.com"),
  );

  if (sfCookie?.value) {
    const cookieHost = sfCookie.domain.startsWith(".")
      ? sfCookie.domain.slice(1)
      : sfCookie.domain;
    const hostname = toApiHostname(cookieHost);
    await chrome.storage.local.set({ lastSfHost: hostname });
    return { connected: true, hostname };
  }

  return { connected: false, hostname: null };
}

/**
 * ホスト名 + sid Cookie から SfSession を構築する
 * orgId/userIdは後から /services/oauth2/userinfo で取得（popup側で非同期に）
 */
export function buildSessionFromCookie(
  hostname: string,
  sessionId: string,
): SfSession {
  return {
    accessToken: sessionId,
    instanceUrl: `https://${hostname}`,
    userId: "",
    orgId: "",
    sfHost: hostname,
  };
}

/**
 * orgId / userId を非同期で取得して SfSession を完成させる
 * 失敗してもセッション自体は使える（orgId/userIdが空のまま）
 */
export async function enrichSession(session: SfSession): Promise<SfSession> {
  try {
    const response = await fetch(
      `${session.instanceUrl}/services/oauth2/userinfo`,
      {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          Accept: "application/json",
        },
      },
    );

    if (response.ok) {
      const data = (await response.json()) as {
        organization_id: string;
        user_id: string;
      };
      return {
        ...session,
        orgId: data.organization_id,
        userId: data.user_id,
      };
    }
  } catch {
    // 失敗してもセッションは使える
  }

  return session;
}
