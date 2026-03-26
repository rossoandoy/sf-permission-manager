# Chrome拡張開発ルール

## Manifest V3 必須事項
- `manifest_version: 3` を使用
- Background は Service Worker（`"type": "module"` 指定）
- `chrome.` API のみ使用（`browser.` は不使用）
- CSP: `script-src 'self'`（外部スクリプト読み込み不可）

## 権限（最小権限の原則）
```json
{
  "permissions": ["cookies", "storage", "activeTab"],
  "host_permissions": [
    "https://*.salesforce.com/*",
    "https://*.force.com/*",
    "https://*.my.salesforce.com/*",
    "https://*.sandbox.my.salesforce.com/*",
    "https://*.lightning.force.com/*"
  ]
}
```

## Service Worker
- ステートレスに設計（いつでもアンロード・再起動される前提）
- 長時間の処理は避ける（30秒でタイムアウト）
- 状態は `chrome.storage.local` に保存
- alarms API でバックグラウンドタスクをスケジュール

## Content Script
- DOM操作は最小限に
- SalesforceのSPA特性を考慮（URLの変化を MutationObserver で検出）
- Content Script → Background の通信:
  ```typescript
  chrome.runtime.sendMessage({ type: 'GET_SESSION' }, (response) => { ... });
  ```

## ストレージ設計
```typescript
// chrome.storage.local のキー設計
interface StorageSchema {
  // セッション情報（orgごと）
  [`session:${orgId}`]: {
    accessToken: string;
    instanceUrl: string;
    userId: string;
    orgId: string;
    expiresAt: number;
  };
  // キャッシュ
  [`cache:${orgId}:${key}`]: {
    data: unknown;
    expiresAt: number;
  };
  // ユーザー設定
  'settings': {
    cacheEnabled: boolean;
    cacheTtlMinutes: number;
    maxConcurrentRequests: number;
    showOnlyCustomObjects: boolean;
    defaultNamespaceFilter: string[];
  };
}
```

## Popup / Side Panel
- 画面サイズ: 最大 800x600（popup）、Side Panel は全高
- 起動時に即座にセッション確認 → 未接続なら接続案内を表示
- SF画面のタブがアクティブでない場合でもセッションキャッシュから動作可能
- 大量データ表示時は仮想スクロール（react-virtual）を検討

## ビルド設定
- Vite + CRXJS Vite Plugin（Chrome拡張向けHMR対応）
- 出力先: `dist/`
- Source map は開発ビルドのみ
- 本番ビルド: `vite build`
- 開発: `vite dev`（HMR対応）
