# SF API 利用ルール

## セッション管理
- セッションは `sf-session.ts` の `getSession()` 経由で取得すること
- セッション切れ（401レスポンス）は自動検出し、ユーザーに再ログインを促す
- セッション情報は `chrome.storage.session` に保存（ブラウザ閉じたら破棄）

## APIコール規約
- すべてのAPIコールは `sf-api-client.ts` を経由する
- 直接 `fetch()` を呼ばない
- APIバージョンは `SF_API_VERSION` 定数を使用
- レスポンス型は `types/salesforce.ts` に定義された型を使用

## SOQLクエリ
- クエリ文字列は `lib/sf-queries.ts` に集約
- インラインでSOQL文字列を書かない
- SOQL インジェクション防止：ユーザー入力は必ずエスケープ
- 大量レコード取得時は `queryMore` を使用（2000件超）

## レート制限
- 並列リクエスト上限: 5（p-limit ライブラリ使用）
- バッチ更新時は Composite API（/composite/sobjects）を使用
- 1回のCompositeリクエストで最大200件まで

## キャッシュ
- オブジェクト/フィールドメタデータ: TTL 30分
- 権限データ: TTL 5分
- 更新操作後は関連キャッシュを即時無効化
- キャッシュキー命名: `sf:{orgId}:{dataType}:{identifier}`

## エラーハンドリング
```typescript
// 全APIコールでこのパターンを使用
try {
  const result = await sfApiClient.query<T>(soql);
  return result;
} catch (error) {
  if (error instanceof SfSessionExpiredError) {
    // セッション切れ → 再ログイン促進
    await notifySessionExpired();
  } else if (error instanceof SfApiLimitError) {
    // API制限 → リトライ or ユーザー通知
    await handleRateLimit(error);
  } else {
    // その他 → エラーログ + ユーザー通知
    console.error('SF API error:', error);
    throw new SfApiError(error.message, error);
  }
}
```

## Manabie ERP 固有の注意点
- MANAERP__ namespace のオブジェクトが主な対象
- 管理パッケージ内のフィールドは `IsManaged = true` で識別
- 管理パッケージフィールドのFLS変更は可能だが、フィールド自体の変更は不可
- NamespacePrefix でフィルタリングする際は空文字（標準/カスタム）と "MANAERP" を区別
