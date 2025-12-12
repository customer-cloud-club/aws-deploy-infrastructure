# Miyabi Admin Console

管理者向けAdmin ConsoleのNext.jsアプリケーション

## 技術スタック

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI (@radix-ui/themes)
- **Authentication**: AWS Amplify Auth (Cognito)
- **Charts**: Recharts
- **Internationalization**: react-i18next
- **State Management**: Zustand

## デザイン原則

- Steve Jobs / Jony Ive原則：シンプル、余白重視
- ダークモード対応
- WCAG 2.1 AA準拠のアクセシビリティ

## プロジェクト構造

```
frontend/admin/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Dashboard page
│   │   ├── products/          # Products management
│   │   ├── plans/             # Plans management
│   │   └── users/             # Users management
│   ├── components/
│   │   ├── ui/                # Basic UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   └── Input.tsx
│   │   ├── layout/            # Layout components
│   │   │   ├── Sidebar.tsx
│   │   │   └── Header.tsx
│   │   └── charts/            # Chart components
│   │       ├── RevenueChart.tsx
│   │       └── UserGrowthChart.tsx
│   ├── lib/
│   │   ├── api.ts             # API client with auth
│   │   ├── auth.ts            # Amplify auth setup
│   │   ├── store.ts           # Zustand store
│   │   └── i18n.ts            # i18next configuration
│   └── locales/
│       ├── ja/common.json     # Japanese translations
│       └── en/common.json     # English translations
├── package.json
├── next.config.js
├── tailwind.config.js
└── tsconfig.json
```

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local.example`を`.env.local`にコピーして、必要な環境変数を設定：

```bash
cp .env.local.example .env.local
```

以下の環境変数を設定：

- `NEXT_PUBLIC_API_URL`: バックエンドAPI URL
- `NEXT_PUBLIC_USER_POOL_ID`: Cognito User Pool ID
- `NEXT_PUBLIC_USER_POOL_CLIENT_ID`: Cognito App Client ID
- `NEXT_PUBLIC_IDENTITY_POOL_ID`: Cognito Identity Pool ID
- `NEXT_PUBLIC_OAUTH_DOMAIN`: Cognito OAuth Domain
- `NEXT_PUBLIC_REDIRECT_SIGN_IN`: サインイン後のリダイレクトURL
- `NEXT_PUBLIC_REDIRECT_SIGN_OUT`: サインアウト後のリダイレクトURL

### 3. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開く

## スクリプト

```bash
# 開発サーバー起動
npm run dev

# 本番ビルド
npm run build

# 本番サーバー起動
npm start

# Lintチェック
npm run lint

# 型チェック
npm run typecheck
```

## 主要機能

### 1. Dashboard (/)
- KPI概要表示
- 収益推移グラフ
- ユーザー成長グラフ
- 最新アクティビティ

### 2. Products (/products)
- プロダクト一覧表示
- プロダクト追加/編集/削除
- 検索・フィルター機能
- ステータス管理

### 3. Plans (/plans)
- プラン一覧表示（カードビュー）
- プラン追加/編集/削除
- 料金・機能表示
- 請求サイクル管理

### 4. Users (/users)
- ユーザー一覧表示
- ユーザー追加/編集/削除
- ロール・ステータスによるフィルタリング
- ユーザー統計

## 認証フロー

AWS Amplifyを使用したCognito認証：

1. `configureAmplify()`でAmplifyを初期化
2. `signInUser()`でログイン
3. `getAuthToken()`でJWTトークン取得
4. API呼び出し時に`Authorization`ヘッダーにトークンを付与

## API連携

`src/lib/api.ts`のAPIクライアントを使用：

```typescript
import { apiClient } from '@/lib/api';

// GET request
const data = await apiClient.get('/products');

// POST request
const result = await apiClient.post('/products', { name: 'New Product' });

// PUT request
await apiClient.put('/products/123', { name: 'Updated' });

// DELETE request
await apiClient.delete('/products/123');
```

## 状態管理

Zustandを使用したグローバル状態管理：

```typescript
import { useStore } from '@/lib/store';

const { user, theme, setTheme, toggleSidebar } = useStore();
```

## 多言語対応

react-i18nextを使用：

```typescript
import { useTranslation } from 'react-i18next';

const { t } = useTranslation('common');
const title = t('dashboard.title');
```

## ダークモード

システムテーマに対応し、手動切り替えも可能：

- ヘッダーのテーマ切り替えボタン
- Zustandで状態管理
- Tailwind CSS の`dark:`クラスでスタイリング

## デプロイ

### Vercel (推奨)

```bash
# Vercel CLIインストール
npm i -g vercel

# デプロイ
vercel
```

### その他のプラットフォーム

```bash
# ビルド
npm run build

# 本番サーバー起動
npm start
```

## トラブルシューティング

### Amplify設定エラー

`.env.local`の環境変数が正しく設定されているか確認

### 認証エラー

Cognitoの設定（App Client、OAuth設定）を確認

### API接続エラー

`NEXT_PUBLIC_API_URL`が正しく設定されているか確認

## ライセンス

Private - All Rights Reserved
