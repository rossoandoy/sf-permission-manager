/**
 * Content Script
 * SF画面のホスト名を検出してバックグラウンドに通知する
 */

const sfHost = window.location.hostname;

chrome.runtime.sendMessage({ type: "SF_HOST_DETECTED", sfHost }).catch(() => {
  // Service Worker が未起動の場合のエラーを無視
});
