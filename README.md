# SF Permission Manager

**Salesforce の権限セット定義・メンテナンスを効率化する Chrome 拡張機能**

[![MV3](https://img.shields.io/badge/Chrome-Manifest_V3-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React_18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> 標準の Salesforce 設定画面では困難な **フィールド権限の一括表示・編集・漏れ検出・差分比較** を、マトリクス UI で直感的に操作できます。

---

## 何ができるか

### 権限マトリクス

```
┌──────────────────────┬─────────┬─────────┬─────────┐
│ フィールド            │ Admin   │ ReadOnly│ Editor  │
│                      │ R  E    │ R  E    │ R  E    │
├──────────────────────┼─────────┼─────────┼─────────┤
│ Tax Amount  Currency │ ✓  ✓    │ ✓  –    │ ✓  ✓    │
│ Unit Price  Currency │ ✓  –    │ ✓  –    │ ✓  ✓    │
│ New Field●  Text     │ –  –    │ –  –    │ –  –    │ ← 漏れ検出
├──────────────────────┴─────────┴─────────┴─────────┤
│ CRUD: C✓ R✓ U✓ D– VA– MA–  │ C– R✓ U– D– VA– MA–│
└────────────────────────────────────────────────────┘
```

### 主要機能

| 機能 | 説明 |
|------|------|
| **権限セットグループ起点** | グループ選択 → 含まれる PS 表示 → 設定済みオブジェクト一覧 |
| **FLS マトリクス** | フィールド × 権限セットの Read/Edit をトグル。型バッジ付き |
| **オブジェクト権限 (CRUD)** | C/R/U/D/ViewAll/ModifyAll の表示・編集 |
| **一括操作** | 全 Read ON / 全 Read+Edit ON ボタン |
| **漏れ検出** | 権限未設定のカスタムフィールドを検出。フィールド作成日 vs PS 更新日の比較。一括 Read/Edit 付与 |
| **差分比較** | 2 つの権限セット間の FLS 差分を並べて表示 |
| **保存確認** | 変更一覧 + 対象環境名表示の確認ダイアログ。Ctrl+S ショートカット |
| **Namespace フィルタ** | MANAERP / Custom / Standard をチェックボックスで絞り込み |
| **ソート** | ラベル順 / API 名順 / フィールド数順 |

---

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│  Chrome Browser                                          │
│                                                          │
│  Content Script ──→ Service Worker ──→ Popup             │
│  (SF画面検出)       (Cookie Broker)    (接続確認)         │
│                         │                                │
│                    sid cookie のみ                        │
│                         ↓                                │
│  Dashboard (別タブ) ─── 直接 fetch ─── SF REST API       │
│  ┌─────────┬────────────────────┐      SF Tooling API    │
│  │Sidebar  │ Matrix / Gaps / Diff│      describe API      │
│  │グループ  │ タブ切り替え        │                        │
│  │PS選択   │                    │                        │
│  │オブジェクト│                    │                        │
│  └─────────┴────────────────────┘                        │
│                                                          │
│  ※ SW は Cookie 取得のみ（30秒タイムアウト回避）            │
│  ※ API 呼び出しは Dashboard から直接実行                    │
└─────────────────────────────────────────────────────────┘
```

> **Cookie Broker パターン**: [Salesforce Inspector Reloaded](https://github.com/tprouvot/Salesforce-Inspector-reloaded) と同じ方式で `sid` Cookie を Bearer トークンとして利用。Connected App / OAuth 不要。

---

## セットアップ

### 前提条件

- Node.js 18+
- npm

### インストール & ビルド

```bash
git clone https://github.com/rossoandoy/sf-permission-manager.git
cd sf-permission-manager
npm install
npm run build
```

### Chrome にロード

1. `chrome://extensions` を開く
2. 「デベロッパーモード」を ON
3. 「パッケージ化されていない拡張機能を読み込む」→ `dist/` フォルダを選択

### 開発

```bash
npm run dev       # Vite HMR
npm test          # vitest watch
npm run test:run  # テスト単発実行
npm run type-check  # TypeScript 型チェック
```

---

## 使い方

### 基本フロー

```
1. SF にブラウザでログイン
2. 拡張アイコンクリック → "Connected" 表示 → "Open Dashboard"
3. 権限セットグループを選択
4. 含まれる PS のチェックを確認
5. オブジェクトを選択 → マトリクス表示
6. R/E セルをクリックして権限をトグル
7. Ctrl+S → 確認ダイアログ → 保存
```

### タブ

| タブ | 用途 |
|------|------|
| **マトリクス** | FLS の Read/Edit トグル + CRUD 表示/編集 |
| **漏れ検出** | 権限未設定フィールドの一覧 + 一括修正 |
| **差分比較** | 2 PS 間の FLS 差分 |

---

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| Chrome Extension | Manifest V3 |
| UI | React 18 + TypeScript strict + Tailwind CSS |
| Build | Vite + CRXJS Vite Plugin |
| SF API | REST API / Tooling API / describe API（Cookie 再利用方式） |
| テスト | Vitest (31 tests) |
| 状態管理 | useReducer + Context（外部ライブラリなし） |

---

## ディレクトリ構成

```
src/
├── background/              # Service Worker（Cookie Broker のみ）
│   ├── index.ts             # メッセージハンドラ（5メッセージタイプ）
│   ├── sf-session.ts        # toApiHostname, getSessionCookie, checkStatus
│   ├── sf-api-client.ts     # query, toolingQuery, describe, collection API
│   └── cache.ts             # TTL 付き chrome.storage.local ラッパー
├── popup/                   # Popup（接続確認 + Dashboard 起動）
│   ├── App.tsx
│   ├── index.html / index.tsx / index.css
├── dashboard/               # Dashboard（メイン UI、別タブで起動）
│   ├── App.tsx              # 3ペインレイアウト
│   ├── components/
│   │   ├── Header.tsx       # 接続状態 + API バッジ + 統計
│   │   ├── ObjectSidebar.tsx # グループ→PS→オブジェクト選択
│   │   ├── TabNav.tsx       # マトリクス / 漏れ検出 / 差分比較
│   │   ├── MatrixView.tsx   # FLS マトリクス + CRUD + 保存
│   │   ├── GapDetectionView.tsx  # 漏れ検出 + 一括修正
│   │   ├── DiffView.tsx     # 差分比較
│   │   ├── SaveConfirmDialog.tsx # 保存確認ダイアログ
│   │   ├── FieldTypeBadge.tsx
│   │   └── StatusBar.tsx
│   ├── hooks/               # useSfSession, useFieldMetadata, usePermissions
│   └── stores/              # useReducer ベース状態管理
├── content/                 # Content Script（SF ページ検出）
├── lib/                     # 共通ロジック
│   ├── messaging.ts         # SW通信 + 直接API呼び出し
│   ├── sf-queries.ts        # SOQL クエリ集約
│   ├── permission-utils.ts  # データ変換・差分比較・一括変更構築
│   └── gap-detector.ts      # 漏れ検出ロジック
└── types/                   # TypeScript 型定義
    ├── salesforce.ts        # SF API レスポンス型
    └── permissions.ts       # 内部データモデル
tests/
├── lib/                     # ユニットテスト（31 tests）
└── mocks/                   # SF API レスポンスモック
```

---

## 参考

- [Salesforce Inspector Reloaded](https://github.com/tprouvot/Salesforce-Inspector-reloaded) — Cookie 認証方式の着想元（MIT License）
- [sf-chrome-extension](https://github.com/rossoandoy/sf-chrome-extension) — このプロジェクトの scaffold 生成スキル

## ライセンス

MIT
