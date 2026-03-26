# テストルール

## テストフレームワーク
- Vitest を使用
- UI テストは @testing-library/react
- Chrome API モックは vitest.setup.ts でグローバル設定

## テスト対象の優先順位
1. `lib/` 配下のビジネスロジック（必須）
2. `background/` のAPIクライアント・セッション管理（必須）
3. `hooks/` のカスタムフック（Phase 2）
4. `components/` のUIコンポーネント（Phase 2）

## テストファイル配置
- `tests/lib/` — lib配下のユニットテスト
- `tests/background/` — background配下のテスト
- `tests/mocks/` — 共有モック定義
  - `sf-responses.ts` — SF APIレスポンスモック
  - `chrome-api.ts` — Chrome APIモック

## SF APIモックパターン
```typescript
// tests/mocks/sf-responses.ts に定義
export const mockPermissionSets = {
  totalSize: 5,
  done: true,
  records: [
    { Id: '0PS000001', Name: 'Manabie_Admin', Label: 'Manabie Admin', ... },
    ...
  ]
};

export const mockFieldPermissions = {
  totalSize: 20,
  done: true,
  records: [
    { Id: '01k000001', SobjectType: 'MANAERP__Bill_Item__c', Field: '...', ... },
    ...
  ]
};
```

## Chrome APIモック
```typescript
// vitest.setup.ts
global.chrome = {
  cookies: {
    get: vi.fn(),
    getAll: vi.fn(),
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
    session: {
      get: vi.fn(),
      set: vi.fn(),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: { addListener: vi.fn() },
  },
  tabs: {
    query: vi.fn(),
  },
} as unknown as typeof chrome;
```

## テスト命名規約
- `describe`: テスト対象のモジュール/関数名
- `it`: 「〜の場合、〜する」形式（日本語OK）
```typescript
describe('GapDetector', () => {
  it('権限セット変更日より新しいフィールドで権限未設定のものを検出する', () => { ... });
  it('標準フィールドは検出対象外とする', () => { ... });
});
```
