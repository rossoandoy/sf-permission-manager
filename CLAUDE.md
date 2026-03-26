# SF Permission Manager — Chrome拡張

## プロジェクト概要
Salesforceの権限セット定義・メンテナンスを効率化するChrome拡張機能。
Salesforce Inspector Reloaded と同じ方式（セッションCookie再利用）でSF APIに接続し、
標準の設定画面では困難な一括操作・漏れ検出・差分比較を提供する。

## 技術スタック
- **Chrome Extension**: Manifest V3
- **UI**: React 18 + TypeScript + Tailwind CSS
- **Build**: Vite（Chrome拡張向け CRXJS プラグイン）
- **SF API通信**: Salesforce REST API / Tooling API（セッション再利用方式）
- **テスト**: Vitest + Testing Library
- **言語**: TypeScript strict mode

## アーキテクチャ
```
┌─ Background (Service Worker) ─────────────────────┐
│  ・chrome.cookies API でSFセッショントークン取得      │
│  ・SF REST API / Tooling API 呼び出し                │
│  ・データキャッシュ（chrome.storage.local）           │
└─────────────────────────┬─────────────────────────┘
                          │ chrome.runtime.sendMessage
┌─ Popup / Side Panel ───┴─────────────────────────┐
│  ・React UI（マトリクス・漏れ検出・差分比較）         │
│  ・オブジェクト/フィールド選択                        │
│  ・一括変更操作 + 保存                               │
└───────────────────────────────────────────────────┘
┌─ Content Script ──────────────────────────────────┐
│  ・SF画面上のコンテキスト情報取得（現在のorg URL等）    │
│  ・オプション：SF画面へのショートカットボタン注入       │
└───────────────────────────────────────────────────┘
```

## ディレクトリ構成
```
sf-permission-manager/
├── CLAUDE.md                    # このファイル（プロジェクトルール）
├── .claude/rules/               # Claude Codeモジュールルール
│   ├── sf-api.md                # SF API利用時のルール
│   ├── chrome-extension.md      # Chrome拡張固有ルール
│   └── testing.md               # テストルール
├── src/
│   ├── background/              # Service Worker
│   │   ├── index.ts             # エントリポイント
│   │   ├── sf-session.ts        # セッション管理
│   │   ├── sf-api-client.ts     # SF REST API クライアント
│   │   └── cache.ts             # キャッシュ管理
│   ├── popup/                   # メインUI
│   │   ├── App.tsx              # ルートコンポーネント
│   │   ├── index.tsx            # エントリポイント
│   │   ├── components/          # UIコンポーネント
│   │   │   ├── Header.tsx
│   │   │   ├── ObjectSelector.tsx
│   │   │   ├── MatrixView.tsx
│   │   │   ├── GapDetection.tsx
│   │   │   ├── DiffView.tsx
│   │   │   └── BulkActions.tsx
│   │   ├── hooks/               # カスタムフック
│   │   │   ├── useSfSession.ts
│   │   │   ├── usePermissions.ts
│   │   │   └── useFieldMetadata.ts
│   │   └── stores/              # 状態管理
│   │       └── permission-store.ts
│   ├── content/                 # Content Script
│   │   └── index.ts
│   ├── lib/                     # 共通ライブラリ
│   │   ├── sf-queries.ts        # SOQLクエリ定義
│   │   ├── permission-utils.ts  # 権限データ変換ロジック
│   │   └── gap-detector.ts      # 漏れ検出ロジック
│   └── types/                   # TypeScript型定義
│       ├── salesforce.ts        # SF APIレスポンス型
│       ├── permissions.ts       # 権限データモデル
│       └── chrome.ts            # Chrome API型拡張
├── public/
│   ├── manifest.json            # Chrome拡張マニフェスト
│   └── icons/                   # 拡張アイコン
├── tests/
│   ├── lib/                     # ユニットテスト
│   └── integration/             # 統合テスト（モック使用）
├── docs/
│   ├── ARCHITECTURE.md          # アーキテクチャ設計書
│   ├── SF-API-REFERENCE.md      # 使用するSF APIリファレンス
│   └── DEVELOPMENT.md           # 開発ガイド
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
└── .gitignore
```

## コーディング規約

### 全般
- コメントは日本語で記述（変数名・関数名は英語）
- `any` 型の使用禁止。必ず具体的な型を定義する
- エラーハンドリングは必ず行い、ユーザーに分かりやすいメッセージを表示する
- console.log はデバッグ用に残さない（開発中は console.debug を使用）

### SF API
- すべてのAPIコールは `sf-api-client.ts` を経由する
- APIバージョンは定数 `SF_API_VERSION = "62.0"` で管理
- セッション取得は `sf-session.ts` の `getSession()` を使用
- レート制限を考慮し、並列リクエストは最大5本に制限
- APIコール結果はキャッシュし、TTLは5分（設定変更操作後はキャッシュクリア）

### Chrome拡張
- Manifest V3準拠。`chrome.` API のみ使用（`browser.` は不使用）
- Service Worker はステートレス。状態は `chrome.storage.local` に保存
- Content Script → Background の通信は `chrome.runtime.sendMessage`
- 権限は最小限（cookies, storage, activeTab, Salesforceドメインのみ）

### React UI
- 関数コンポーネント + Hooks のみ
- 状態管理は React の useState / useReducer（外部ライブラリ不使用でMVP）
- UIコンポーネントは Tailwind CSS のユーティリティクラスで記述
- カラーテーマ: zinc ベースのダークモード（プロトタイプ準拠）

## Salesforce API詳細

### 使用するオブジェクト/API
```
# 権限セット一覧取得
SELECT Id, Name, Label, Description, IsCustom, IsOwnedByProfile,
       LastModifiedDate, LastModifiedById, NamespacePrefix
FROM PermissionSet
WHERE IsCustom = true AND IsOwnedByProfile = false

# フィールド権限取得（権限セットID指定）
SELECT Id, SobjectType, Field, PermissionsRead, PermissionsEdit, ParentId
FROM FieldPermissions
WHERE ParentId IN (:permissionSetIds)

# オブジェクト権限取得
SELECT Id, SobjectType, ParentId,
       PermissionsCreate, PermissionsRead, PermissionsEdit,
       PermissionsDelete, PermissionsViewAllRecords, PermissionsModifyAllRecords
FROM ObjectPermissions
WHERE ParentId IN (:permissionSetIds)

# フィールドメタデータ取得（Tooling API）
SELECT EntityDefinition.QualifiedApiName, QualifiedApiName, Label,
       DataType, LastModifiedDate, IsCustom, NamespacePrefix
FROM FieldDefinition
WHERE EntityDefinition.QualifiedApiName = ':objectApiName'

# 権限セットグループ取得
SELECT Id, DeveloperName, MasterLabel, Description, Status
FROM PermissionSetGroup

# 権限セットグループ - 権限セット紐付け
SELECT Id, PermissionSetGroupId, PermissionSetId
FROM PermissionSetGroupComponent
```

### セッション取得方式
```typescript
// SF Inspector Reloaded と同じ方式
// 1. chrome.cookies.get でSFドメインの sid Cookie取得
// 2. sid をAuthorization: Bearer ヘッダーに設定
// 3. SF REST API エンドポイントに直接リクエスト
```

### 権限の更新API
```
// FieldPermissions の更新
PATCH /services/data/v62.0/sobjects/FieldPermissions/:id
Body: { "PermissionsRead": true, "PermissionsEdit": false }

// FieldPermissions の新規作成（権限未設定フィールドへの付与）
POST /services/data/v62.0/sobjects/FieldPermissions
Body: {
  "ParentId": ":permissionSetId",
  "SobjectType": "MANAERP__Bill_Item__c",
  "Field": "MANAERP__Bill_Item__c.MANAERP__Tax_Amount__c",
  "PermissionsRead": true,
  "PermissionsEdit": false
}
```

## 開発フェーズ

### Phase 1: MVP（現在のスコープ）
- [x] UIプロトタイプ（React アーティファクト完成済み）
- [ ] Chrome拡張の雛形（Manifest V3 + Vite + React）
- [ ] SF セッション取得 + API接続
- [ ] 権限セット一覧表示
- [ ] 単一オブジェクトのフィールド権限マトリクス表示
- [ ] フィールド権限の個別更新

### Phase 2: コア機能
- [ ] 一括権限設定（全Read ON、全Read+Edit ON）
- [ ] 漏れ検出（FieldDefinition.LastModifiedDate vs PermissionSet.LastModifiedDate）
- [ ] 権限セット間の差分比較
- [ ] オブジェクト権限（CRUD）の表示・編集

### Phase 3: 拡張機能
- [ ] プロファイルのFLS表示（読み取り専用）
- [ ] 権限セットグループ対応
- [ ] カスタム権限の表示
- [ ] 設定エクスポート（CSV/JSON）
- [ ] 変更履歴の表示

## テスト方針
- `lib/` 配下のビジネスロジックは必ずユニットテストを書く
- SF APIモックは `tests/mocks/sf-responses.ts` に集約
- Chrome API モックは `vitest.setup.ts` でグローバル設定
- UIコンポーネントのテストは Phase 2 以降
