# 認証・課金基盤 組み込みガイド

このガイドでは、miyabi（Claude Code）を使って認証・課金基盤をアプリケーションに組み込む方法を説明します。

---

## 目次

1. [概要](#概要)
2. [管理画面でのセットアップ](#管理画面でのセットアップ)
   - [プロダクト作成](#1-プロダクト作成)
   - [プラン作成](#2-プラン作成)
   - [クーポン作成（オプション）](#3-クーポン作成オプション)
3. [アプリへの組み込み](#アプリへの組み込み)
4. [miyabiへの指示例](#miyabiへの指示例)

---

## 概要

この認証・課金基盤を使うと、以下の機能をアプリに簡単に追加できます：

| 機能 | 説明 |
|------|------|
| ユーザー認証 | メール/パスワード、Google OAuth でのログイン |
| サブスクリプション課金 | Stripe連携による月額・年額課金 |
| 使用制限 | プランごとのAPI呼び出し回数制限 |
| 機能フラグ | プランごとの機能ON/OFF |

---

## 管理画面でのセットアップ

管理画面URL: `https://admin.your-domain.com`

### 1. プロダクト作成

プロダクトは「アプリ」を表します。1つのアプリにつき1つのプロダクトを作成します。

**手順:**

1. 管理画面にログイン
2. 左メニューから「プロダクト」を選択
3. 「新しいプロダクトを作成」ボタンをクリック
4. 以下を入力:
   - **プロダクト名**: アプリの名前（例: "MyApp Pro"）
   - **説明**: アプリの説明（オプション）
   - **Stripe Product ID**: 空欄でOK（自動作成されます）
   - **アクティブにする**: チェックを入れる
5. 「作成」をクリック

**作成後に確認すること:**
- プロダクト一覧に表示されたプロダクトの **ID** をメモしておく（SDK設定で使用）

---

### 2. プラン作成

プランは「料金プラン」を表します。Free、Basic、Pro などを作成します。

**手順:**

1. 左メニューから「プラン」を選択
2. 「新しいプランを作成」ボタンをクリック
3. 以下を入力:
   - **プロダクト**: 先ほど作成したプロダクトを選択
   - **プラン名**: "Free", "Basic", "Pro" など
   - **課金サイクル**: monthly（月額）/ yearly（年額）/ one_time（買い切り）
   - **価格**: 金額を入力（円）
   - **トライアル期間**: 無料お試し日数（オプション）
   - **アクティブにする**: チェックを入れる
4. 「作成」をクリック

**プラン設計例:**

| プラン名 | 価格 | 課金サイクル | 特徴 |
|---------|------|-------------|------|
| Free | 0円 | monthly | 機能制限あり、月10回まで |
| Basic | 980円 | monthly | 基本機能、月100回まで |
| Pro | 2,980円 | monthly | 全機能、無制限 |

---

### 3. クーポン作成（オプション）

割引クーポンを作成して、プロモーションに使用できます。

**手順:**

1. 左メニューから「クーポン」を選択
2. 「新しいクーポンを作成」ボタンをクリック
3. 以下を入力:
   - **クーポン名**: "新規登録50%OFF" など
   - **割引タイプ**:
     - パーセント割引: 10%, 20%, 50% など
     - 固定金額割引: 500円引き、1000円引き など
   - **適用期間**:
     - once（1回のみ）
     - repeating（複数月）
     - forever（永続）
   - **有効期限**: いつまで使えるか
   - **最大利用回数**: 何人まで使えるか
4. 「作成」をクリック

**プロモーションコード作成:**

クーポン作成後、「プロモーションコード」で実際のコードを作成します。
例: `WELCOME50`, `SUMMER2025` など

---

## アプリへの組み込み

### 必要な情報

管理画面から以下の情報を取得してください：

| 項目 | 取得場所 | 例 |
|------|---------|-----|
| Product ID | プロダクト一覧 | `2199b3fb-daf7-4d82-b77f-f112f4fa4a31` |
| API URL | 固定値 | `https://9sdlempnx9.execute-api.ap-northeast-1.amazonaws.com/prod` |

### SDK バージョン

現在の最新バージョン: **v1.1.7**

---

## miyabiへの指示例

以下のテンプレートをコピーして、miyabi（Claude Code）に指示してください。

---

### 指示テンプレート 1: 基本的な認証機能の追加

```
このアプリに認証・課金基盤を組み込んでください。

## 設定情報
- Product ID: [管理画面で確認したID]
- API URL: https://9sdlempnx9.execute-api.ap-northeast-1.amazonaws.com/prod

## 必要な機能
1. ログイン画面（メール/パスワード）
2. 新規登録画面
3. ログイン状態の管理
4. ログアウト機能

## SDK情報
パッケージ: @customer-cloud-club/platform-sdk
バージョン: 1.1.7

## .npmrc設定（GitHub Packages認証）
@customer-cloud-club:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

---

### 指示テンプレート 2: サブスクリプション課金の追加

```
このアプリにサブスクリプション課金機能を追加してください。

## 設定情報
- Product ID: [管理画面で確認したID]
- API URL: https://9sdlempnx9.execute-api.ap-northeast-1.amazonaws.com/prod

## 必要な機能
1. プラン選択画面
2. Stripe決済画面への遷移
3. 決済完了後のリダイレクト処理
4. 現在のプラン表示

## 参考: SDK使用方法

### プラン一覧取得
const plans = await PlatformSDK.getPlans();

### 決済画面への遷移
await PlatformSDK.redirectToCheckout({
  planId: 'price_xxxxx',  // Stripe Price ID
  successUrl: window.location.origin + '/success',
  cancelUrl: window.location.origin + '/cancel',
});

### 現在のプラン確認
const entitlement = await PlatformSDK.getEntitlement();
console.log(entitlement.planName);  // "Pro" など
```

---

### 指示テンプレート 3: 使用制限・機能フラグの追加

```
このアプリに使用制限と機能フラグを追加してください。

## 設定情報
- Product ID: [管理画面で確認したID]
- API URL: https://9sdlempnx9.execute-api.ap-northeast-1.amazonaws.com/prod

## 必要な機能
1. API呼び出し時に使用回数をカウント
2. 制限に達したら警告表示
3. Pro機能はProプランのみ表示

## 参考: SDK使用方法

### 使用回数のカウント
await PlatformSDK.incrementUsage('api_call');
// または
await PlatformSDK.recordUsage(1, 'generation');

### 残り回数の確認
const entitlement = await PlatformSDK.getEntitlement();
console.log(entitlement.usage.remaining);  // 残り回数

### 制限チェック
if (entitlement.over_limit) {
  alert('今月の利用上限に達しました');
}

### 機能フラグのチェック
if (await PlatformSDK.hasFeature('pro_feature')) {
  // Pro機能を表示
}
```

---

### 指示テンプレート 4: 完全な組み込み（認証 + 課金 + 制限）

```
このアプリに認証・課金基盤を完全に組み込んでください。

## 設定情報
- Product ID: [管理画面で確認したID]
- API URL: https://9sdlempnx9.execute-api.ap-northeast-1.amazonaws.com/prod

## 必要な機能

### 認証
- ログイン画面（メール/パスワード）
- 新規登録画面（メール確認付き）
- パスワードリセット
- ログアウト

### 課金
- プラン選択・変更画面
- 決済画面への遷移（Stripe Checkout）
- 解約機能

### 使用制限
- API呼び出しのカウント
- 残り回数の表示
- 制限到達時の警告

### ユーザー情報
- プロフィール画面
- 現在のプラン表示
- 使用状況の表示

## SDK初期化コード

import { PlatformSDK } from '@customer-cloud-club/platform-sdk';

PlatformSDK.init({
  productId: '[管理画面で確認したID]',
  apiUrl: 'https://9sdlempnx9.execute-api.ap-northeast-1.amazonaws.com/prod',
});

## 主要なSDKメソッド

// 認証
await PlatformSDK.login(email, password);
await PlatformSDK.signup(email, password, name);
await PlatformSDK.logout();
const user = await PlatformSDK.requireAuth();
const profile = await PlatformSDK.getMe();

// 課金
const plans = await PlatformSDK.getPlans();
await PlatformSDK.redirectToCheckout({ planId, successUrl, cancelUrl });
await PlatformSDK.cancelSubscription();

// 利用権
const entitlement = await PlatformSDK.getEntitlement();
await PlatformSDK.incrementUsage('api_call');

## .npmrc設定
@customer-cloud-club:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

---

## SDK メソッド一覧

### 認証系

| メソッド | 説明 | 戻り値 |
|---------|------|-------|
| `login(email, password)` | ログイン | `LoginResponse` |
| `signup(email, password, name?)` | 新規登録 | `SignupResponse` |
| `confirmSignup(email, code)` | メール確認 | `void` |
| `logout()` | ログアウト | `void` |
| `requireAuth()` | 認証必須チェック | `AuthUser` |
| `getAuthState()` | 認証状態取得 | `AuthUser \| null` |
| `getMe()` | ユーザー情報取得 | `UserProfile` |
| `requestPasswordReset(email)` | パスワードリセット要求 | `void` |
| `confirmPasswordReset(email, code, newPassword)` | パスワードリセット確認 | `void` |
| `deleteAccount()` | アカウント削除 | `void` |

### 課金系

| メソッド | 説明 | 戻り値 |
|---------|------|-------|
| `getPlans()` | プラン一覧取得 | `Plan[]` |
| `createCheckout(options)` | 決済セッション作成 | `CheckoutSession` |
| `redirectToCheckout(options)` | 決済画面へリダイレクト | `void` |
| `cancelSubscription()` | サブスクリプション解約 | `void` |

### 利用権系

| メソッド | 説明 | 戻り値 |
|---------|------|-------|
| `getEntitlement()` | 利用権情報取得 | `Entitlement` |
| `hasFeature(key)` | 機能フラグチェック | `boolean` |
| `checkLimit(type)` | 制限チェック | `{ allowed, remaining }` |
| `incrementUsage(type?)` | 使用回数+1 | `void` |
| `recordUsage(amount, type)` | 使用量記録 | `void` |

---

## よくある質問

### Q: GITHUB_TOKEN はどこで取得できますか？

GitHub の Settings > Developer settings > Personal access tokens で作成できます。
必要なスコープ: `read:packages`

### Q: Product ID はどこで確認できますか？

管理画面のプロダクト一覧で、各プロダクトの ID 列に表示されています。

### Q: 無料プランはどう設定しますか？

プラン作成時に価格を 0 円に設定してください。課金サイクルは monthly でOKです。

### Q: テスト環境で試したい

開発環境の API URL を使用してください：
`https://wqqr3nryw0.execute-api.ap-northeast-1.amazonaws.com/dev`

---

## サポート

問題が発生した場合は、以下をmiyabiに伝えてください：

1. エラーメッセージの全文
2. 実行しようとしたコード
3. ブラウザのコンソールログ

miyabiが適切に対処します。
