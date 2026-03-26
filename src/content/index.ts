/**
 * Content Script
 * sf-custom-config-tool と同じ2ステップパターン:
 * 1. getSfHost でURL→API用ホスト名を解決
 * 2. sfDetected でバックグラウンドに通知
 */

function detectObjectFromUrl(url: string): string | null {
  try {
    const { pathname } = new URL(url);
    const recordMatch = pathname.match(
      /\/lightning\/r\/([A-Za-z0-9_]+)\/[A-Za-z0-9]+/,
    );
    if (recordMatch?.[1]) return recordMatch[1];

    const listMatch = pathname.match(
      /\/lightning\/o\/([A-Za-z0-9_]+)\//,
    );
    if (listMatch?.[1]) return listMatch[1];

    return null;
  } catch {
    return null;
  }
}

(function () {
  // SF画面であることを確認
  const isSfPage =
    location.hostname.endsWith(".my.salesforce.com") ||
    location.hostname.endsWith(".lightning.force.com") ||
    location.hostname.endsWith(".salesforce.com") ||
    document.querySelector("[data-aura-rendered-by]") !== null;

  if (!isSfPage) return;

  // Step 1: URLからAPI用ホスト名を解決
  chrome.runtime.sendMessage({
    type: "GET_SF_HOST",
    url: location.href,
  }).then((response: unknown) => {
    const res = response as { sfHost: string | null };
    if (res?.sfHost) {
      const currentObjectApiName = detectObjectFromUrl(location.href);
      // Step 2: バックグラウンドに通知
      chrome.runtime.sendMessage({
        type: "SF_HOST_DETECTED",
        sfHost: res.sfHost,
        currentObjectApiName,
      }).catch(() => {});
    }
  }).catch(() => {
    // Extension context invalidated; ignore
  });
})();
