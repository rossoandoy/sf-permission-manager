/**
 * Salesforce セッション管理
 * SF Inspector Reloaded と同じ方式でセッションCookieを再利用
 */

import type { SfSession } from "../types/salesforce";

/** SFドメインパターン */
const SF_DOMAIN_PATTERNS = [
  ".salesforce.com",
  ".force.com",
  ".my.salesforce.com",
  ".lightning.force.com",
];

/**
 * 現在アクティブなSFタブからセッション情報を取得
 */
export async function getSession(): Promise<SfSession | null> {
  // アクティブなSFタブを検索
  const sfHost = await getActiveSfHost();
  if (!sfHost) return null;

  return getSessionForHost(sfHost);
}

/**
 * 指定ホストのセッション情報を取得
 */
export async function getSessionForHost(sfHost: string): Promise<SfSession | null> {
  // キャッシュ確認
  const cached = await getCachedSession(sfHost);
  if (cached) return cached;

  // Cookie から sid を取得
  const sid = await getSidCookie(sfHost);
  if (!sid) return null;

  // ユーザー情報を取得してセッション構築
  const session = await buildSession(sfHost, sid);
  if (session) {
    await cacheSession(session);
  }

  return session;
}

/**
 * アクティブなSFタブのホスト名を取得
 */
async function getActiveSfHost(): Promise<string | null> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeTab = tabs[0];
  if (!activeTab?.url) return null;

  try {
    const url = new URL(activeTab.url);
    if (isSalesforceHost(url.hostname)) {
      return url.hostname;
    }
  } catch {
    // URL解析失敗
  }

  return null;
}

/**
 * ホスト名がSalesforceドメインかどうか判定
 */
function isSalesforceHost(hostname: string): boolean {
  return SF_DOMAIN_PATTERNS.some(pattern => hostname.endsWith(pattern));
}

/**
 * SFドメインの sid Cookie を取得
 */
async function getSidCookie(sfHost: string): Promise<string | null> {
  // Lightning ドメインの場合、対応するクラシックドメインからもCookieを探す
  const hostsToCheck = [sfHost];

  // my.salesforce.com → 対応する .salesforce.com も試す
  if (sfHost.endsWith(".my.salesforce.com")) {
    const orgDomain = sfHost.replace(".my.salesforce.com", ".salesforce.com");
    hostsToCheck.push(orgDomain);
  }

  for (const host of hostsToCheck) {
    const cookie = await chrome.cookies.get({
      url: `https://${host}`,
      name: "sid",
    });
    if (cookie?.value) return cookie.value;
  }

  return null;
}

/**
 * sid トークンを使ってセッション情報を構築
 */
async function buildSession(sfHost: string, sid: string): Promise<SfSession | null> {
  try {
    // instanceUrl はホストから構築
    const instanceUrl = `https://${sfHost}`;

    // ユーザー情報取得で有効性を確認
    const response = await fetch(
      `${instanceUrl}/services/data/v62.0/chatter/users/me`,
      {
        headers: {
          Authorization: `Bearer ${sid}`,
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) return null;

    // セッション有効性確認（レスポンス自体は使用しない）
    await response.json();

    // ユーザーIDからorgIdを推定（先頭15文字の最初の部分）
    // より正確にはIdentity URLから取得
    const identityResponse = await fetch(
      `${instanceUrl}/services/oauth2/userinfo`,
      {
        headers: { Authorization: `Bearer ${sid}` },
      },
    );

    let orgId = "";
    let userId = "";
    if (identityResponse.ok) {
      const identity = (await identityResponse.json()) as {
        organization_id: string;
        user_id: string;
      };
      orgId = identity.organization_id;
      userId = identity.user_id;
    }

    return {
      accessToken: sid,
      instanceUrl,
      userId,
      orgId,
      sfHost,
    };
  } catch {
    return null;
  }
}

// --- キャッシュ ---

async function getCachedSession(sfHost: string): Promise<SfSession | null> {
  const key = `session:${sfHost}`;
  const result = await chrome.storage.session.get(key);
  const cached = result[key] as (SfSession & { expiresAt: number }) | undefined;

  if (cached && cached.expiresAt > Date.now()) {
    return cached;
  }

  return null;
}

async function cacheSession(session: SfSession): Promise<void> {
  const key = `session:${session.sfHost}`;
  await chrome.storage.session.set({
    [key]: {
      ...session,
      expiresAt: Date.now() + 30 * 60 * 1000, // 30分TTL
    },
  });
}

/**
 * セッションキャッシュをクリア
 */
export async function clearSession(sfHost: string): Promise<void> {
  const key = `session:${sfHost}`;
  await chrome.storage.session.remove(key);
}
