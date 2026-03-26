# SF Permission Manager

Salesforce の権限セット定義・メンテナンスを効率化する Chrome 拡張機能。

標準の設定画面では困難な **フィールド権限の一括表示・編集・漏れ検出・差分比較** を、マトリクスUIで直感的に操作できます。

## 機能

### Phase 1（MVP）— 現在のスコープ
- SF セッション自動取得（Salesforce Inspector Reloaded と同じ Cookie 再利用方式）
- 権限セット一覧表示
- 単一オブジェクトのフィールド権限マトリクス表示（行=フィールド、列=権限セット）
- フィールド権限の個別・一括更新（Read / Edit トグル）

### Phase 2（予定）
- 一括権限設定（全 Read ON、全 Read+Edit ON）
- 漏れ検出（新規フィールドに対する未設定権限の自動検出）
- 権限セット間の差分比較
- オブジェクト権限（CRUD）の表示・編集

### Phase 3（予定）
- プロファイルの FLS 表示（読み取り専用）
- 権限セットグループ対応
- 設定エクスポート（CSV / JSON）

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| Chrome Extension | Manifest V3 |
| UI | React 18 + TypeScript + Tailwind CSS |
| Build | Vite + CRXJS Vite Plugin |
| SF API 通信 | REST API / Tooling API（セッション Cookie 再利用方式） |
| テスト | Vitest + Testing Library |

## セットアップ

### 前提条件
- Node.js 18+
- npm

### インストール

```bash
git clone https://github.com/rossoandoy/sf-permission-manager.git
cd sf-permission-manager
npm install
```

### 開発

```bash
npm run dev
```

HMR 対応の開発サーバーが起動します。

### ビルド

```bash
npm run build
```

`dist/` ディレクトリに Chrome 拡張がビルドされます。

### テスト

```bash
npm test          # watch モード
npm run test:run  # 単発実行
```

### 型チェック

```bash
npm run type-check
```

## Chrome 拡張のインストール（開発版）

1. `npm run build` でビルド
2. Chrome で `chrome://extensions` を開く
3. 「デベロッパーモード」を ON
4. 「パッケージ化されていない拡張機能を読み込む」→ `dist/` フォルダを選択

## 使い方

1. Salesforce にブラウザでログイン
2. 拡張アイコンをクリック → 自動的にセッションを取得
3. オブジェクトを選択 → フィールド権限マトリクスが表示
4. R（Read）/ E（Edit）ボタンをクリックして権限をトグル
5. 「保存」ボタンで Salesforce に反映

## アーキテクチャ

```
┌─ Background (Service Worker) ──────────────────────┐
│  ・chrome.cookies で SF セッショントークン取得         │
│  ・SF REST API / Tooling API 呼び出し                │
│  ・データキャッシュ（chrome.storage.local）            │
└──────────────────────┬────────────────────────────┘
                       │ chrome.runtime.sendMessage
┌─ Popup (React UI) ──┴────────────────────────────┐
│  ・フィールド権限マトリクス表示                       │
│  ・オブジェクト / 権限セット選択                      │
│  ・一括変更操作 + 保存                               │
└──────────────────────────────────────────────────┘
┌─ Content Script ─────────────────────────────────┐
│  ・SF 画面のホスト名検出 → Background に通知          │
└──────────────────────────────────────────────────┘
```

## ディレクトリ構成

```
src/
├── background/          # Service Worker
│   ├── index.ts         # メッセージルーター
│   ├── sf-session.ts    # セッション管理
│   ├── sf-api-client.ts # SF API クライアント
│   └── cache.ts         # キャッシュ管理
├── popup/               # メイン UI (React)
│   ├── components/      # UI コンポーネント
│   ├── hooks/           # カスタムフック
│   ├── stores/          # 状態管理
│   └── lib/             # ユーティリティ
├── content/             # Content Script
├── lib/                 # 共通ビジネスロジック
│   ├── sf-queries.ts    # SOQL クエリ定義
│   ├── permission-utils.ts
│   └── gap-detector.ts
└── types/               # TypeScript 型定義
tests/
├── lib/                 # ユニットテスト
└── mocks/               # テスト用モック
```

## ライセンス

MIT
