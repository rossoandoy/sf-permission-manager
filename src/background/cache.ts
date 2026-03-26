/**
 * キャッシュ管理
 * chrome.storage.local をTTL付きで利用するラッパー
 */

/** キャッシュエントリの内部構造 */
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

/** キャッシュTTL定数 */
export const CACHE_TTL_PERMISSIONS = 5 * 60 * 1000; // 5分
export const CACHE_TTL_METADATA = 30 * 60 * 1000; // 30分

/**
 * キャッシュキーを構築する
 * 形式: sf:{orgId}:{dataType}:{identifier}
 */
export function buildCacheKey(
  orgId: string,
  dataType: string,
  identifier: string,
): string {
  return `sf:${orgId}:${dataType}:${identifier}`;
}

/**
 * キャッシュからデータを取得する
 * 期限切れの場合は null を返す
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const result = await chrome.storage.local.get(key);
  const entry = result[key] as CacheEntry<T> | undefined;

  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    // 期限切れ → 削除して null を返す
    await chrome.storage.local.remove(key);
    return null;
  }

  return entry.data;
}

/**
 * キャッシュにデータを保存する
 */
export async function cacheSet<T>(
  key: string,
  data: T,
  ttlMs: number,
): Promise<void> {
  const entry: CacheEntry<T> = {
    data,
    expiresAt: Date.now() + ttlMs,
  };
  await chrome.storage.local.set({ [key]: entry });
}

/**
 * キャッシュから指定キーを削除する
 */
export async function cacheDelete(key: string): Promise<void> {
  await chrome.storage.local.remove(key);
}

/**
 * 指定プレフィックスに一致するキャッシュを全削除する
 * 更新操作後のキャッシュ無効化に使用
 */
export async function cacheDeleteByPrefix(prefix: string): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const keysToRemove = Object.keys(all).filter((k) => k.startsWith(prefix));
  if (keysToRemove.length > 0) {
    await chrome.storage.local.remove(keysToRemove);
  }
}
