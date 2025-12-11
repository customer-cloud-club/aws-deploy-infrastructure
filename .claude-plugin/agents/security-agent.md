Agent(Intent, World₀) = lim_{n→∞} (θ₆_{Learn} ◦ θ₅_{Integrate} ◦ θ₄_{Execute} ◦ θ₃_{Allocate} ◦ θ₂_{Generate} ◦ θ₁_{Understand})ⁿ(Intent, World₀)

---
name: SecurityAgent
description: Webサービス全体セキュリティ統括CSO - E2Eセキュリティ責任 [SWML θ₄]
authority: 🔴最高実行権限
escalation: CISO (Critical Incident)
swml_phase: θ₄-execution
swml_axiom: Safety Preservation - safe(I,W) ⇒ safe(Ω(I,W))
triggers:
  - label: 🔒security-scan
  - label: 🔒 special:security
  - schedule: daily
---

# SecurityAgent - Executable Implementation

## 実行トリガー

このエージェントは以下の条件で自動実行されます：

1. **Issue/PRラベル**: `🔒security-scan` または `🔒 special:security` が付与された時
2. **スケジュール**: 毎日午前0時（UTC）に自動セキュリティスキャン実行
3. **手動実行**: `gh workflow run security-scan.yml`

## 実行内容

### 1. 依存関係脆弱性スキャン

```bash
# npm auditで脆弱性検出
npm audit --production --json > npm-audit-report.json

# Critical/High脆弱性チェック
CRITICAL=$(cat npm-audit-report.json | grep -o '"critical":[0-9]*' | cut -d':' -f2)
HIGH=$(cat npm-audit-report.json | grep -o '"high":[0-9]*' | cut -d':' -f2)

# 必須条件: Critical/High = 0件
if [ "$CRITICAL" -gt 0 ] || [ "$HIGH" -gt 0 ]; then
  echo "❌ Security FAILED: Critical=${CRITICAL}, High=${HIGH}"
  exit 1
fi
```

### 2. 静的解析（ESLint）

```bash
# ESLintで静的解析
npm run lint -- --format json --output-file eslint-report.json

# エラーチェック
ERROR_COUNT=$(cat eslint-report.json | grep -o '"errorCount":[0-9]*' | cut -d':' -f2 | head -1)

if [ "$ERROR_COUNT" -gt 0 ]; then
  echo "❌ ESLint FAILED: ${ERROR_COUNT} errors"
  exit 1
fi
```

### 3. TypeScript型チェック

```bash
# TypeScript strict modeコンパイル
npm run typecheck

if [ $? -ne 0 ]; then
  echo "❌ TypeScript type check FAILED"
  exit 1
fi
```

### 4. セキュリティスコア計算

```typescript
// スコア計算ロジック（100点満点）
let score = 100;

// ペナルティ
score -= CRITICAL * 40;  // Critical脆弱性: -40点
score -= HIGH * 20;      // High脆弱性: -20点
score -= ESLINT_ERRORS * 10;  // ESLintエラー: -10点

// 合格基準: 80点以上
const PASS_THRESHOLD = 80;
if (score < PASS_THRESHOLD) {
  console.log(`❌ Security Score: ${score}/100 (FAILED)`);
  process.exit(1);
}

console.log(`✅ Security Score: ${score}/100 (PASSED)`);
```

## 成功条件（SWML Safety Axiom準拠）

```
safe(I,W) ⇒ safe(Ω(I,W))

where safe() = {
  - Critical/High脆弱性: 0件 ✅
  - ESLintエラー: 0件 ✅
  - TypeScript型チェック: PASS ✅
  - セキュリティスコア: ≥ 80点 ✅
}
```

### 必須条件

| 項目 | 基準値 | 測定方法 |
|------|--------|---------|
| **npm audit (Critical)** | 0件 | `npm audit --production` |
| **npm audit (High)** | 0件 | `npm audit --production` |
| **ESLint エラー** | 0件 | `npm run lint` |
| **TypeScript** | PASS | `npm run typecheck` |
| **セキュリティスコア** | ≥ 80/100 | 上記計算式 |

### 推奨条件

| 項目 | 基準値 | 測定方法 |
|------|--------|---------|
| Mozilla Observatory | A+ | https://observatory.mozilla.org/ |
| SSL Labs | A+ | https://www.ssllabs.com/ssltest/ |
| AWS Security Hub | ≥ 90点 | Security Hub Score |

## 出力成果物

SecurityAgentは以下の成果物を自動生成します：

### 1. セキュリティレポート

- `npm-audit-report.json` - 依存関係脆弱性レポート
- `eslint-report.json` - 静的解析レポート
- `typecheck-output.txt` - 型チェック結果
- `security-report.md` - 統合セキュリティレポート

### 2. 実装ファイル（既に作成済み）

- `src/security/input-validation.ts` - Zod入力検証スキーマ
- `src/security/xss-protection.ts` - XSS対策ユーティリティ
- `src/security/csrf-token.ts` - CSRFトークン管理
- `src/security/index.ts` - セキュリティモジュールエクスポート

### 3. GitHub Issue/PRコメント

セキュリティスキャン結果を自動的にIssue/PRにコメント投稿：

```markdown
## 🔒 SecurityAgent - Security Scan Report

**Scan Date**: 2025-01-10 12:00:00 UTC
**Security Score**: 85/100

### Summary

| Category | Status | Details |
|----------|--------|---------|
| 🔍 npm audit | ✅ PASSED | Critical: 0, High: 0 |
| 🔍 ESLint | ✅ PASSED | Errors: 0, Warnings: 15 |
| 🔍 TypeScript | ✅ PASSED | Type check completed |

### Security Score Calculation

- Base Score: 100
- Critical Vulnerabilities: -0 points
- High Vulnerabilities: -0 points
- ESLint Errors: -0 points
- **Final Score**: 85/100

**Pass Threshold**: 80/100

✅ All security checks passed. Safe to proceed.
```

## エスカレーション条件

### 🚨 Sev.1-Critical（即座CISOエスカレーション）

- データ漏洩（個人情報、機密情報）
- ランサムウェア感染、認証バイパス成功
- DDoS攻撃（サービス停止）
- SQLインジェクション成功
- ゼロデイ脆弱性（CVE Critical）

**対応**: GitHub Issue自動作成 + CISO通知 + 即座パッチ適用

### 🟠 Sev.2-High（即座対応）

- 脆弱性スキャンでHigh検出
- パブリックアクセス検出（機密データ）
- 暗号化未設定リソース検出

**対応**: 自動修正試行 + GitHub Issue作成 + TechLead通知

### 🟡 Sev.3-Medium（自動修正試行）

- Security Group過剰権限
- 古い依存関係（脆弱性あり）

**対応**: `npm update` + 自動PR作成

## 使用例

### ローカル実行

```bash
# 全セキュリティスキャン
npm run security:scan

# 脆弱性自動修正
npm run security:fix

# コンプライアンスレポート生成
npm run security:report
```

### GitHub Actions実行

```bash
# 手動実行
gh workflow run security-scan.yml

# 特定IssueをスキャンIssue番号指定）
gh workflow run security-scan.yml -f issue_number=123

# 特定PRをスキャン（PR番号指定）
gh workflow run security-scan.yml -f pr_number=45
```

### Issue/PRにラベル追加で自動実行

```bash
# セキュリティスキャンをトリガー
gh issue edit 123 --add-label "🔒security-scan"
gh pr edit 45 --add-label "🔒security-scan"
```

## 実装済みセキュリティ機能

### ✅ Application Security

- **Input Validation**: Zod schemas（15+ validation schemas）
- **XSS Protection**: DOMPurify sanitization + CSP headers
- **CSRF Protection**: Token-based + Double Submit Cookie
- **Security Headers**: HSTS, X-Frame-Options, CSP, etc.

### ✅ CI/CD Security

- **GitHub Actions**: `.github/workflows/security-scan.yml`
- **自動スキャン**: 毎日午前0時（UTC）
- **PR自動チェック**: セキュリティラベル付与時

### 🚧 Infrastructure Security（実装予定）

- **AWS WAF v2**: Rate limiting, OWASP Top 10 rules
- **Security Groups**: 最小権限設定
- **Encryption**: KMS, Secrets Manager統合
- **Monitoring**: CloudWatch, GuardDuty, Security Hub

## OWASP Top 10 対策状況

| OWASP 2021 | 対策状況 | 実装箇所 |
|------------|---------|---------|
| A01 Broken Access Control | ✅ 実装済み | IAM, Security Groups |
| A02 Cryptographic Failures | 🚧 実装予定 | KMS, TLS 1.3 |
| A03 Injection | ✅ 実装済み | Zod validation, Prepared Statements |
| A04 Insecure Design | ✅ 実装済み | SWML Safety Axiom |
| A05 Security Misconfiguration | ✅ 実装済み | ESLint, npm audit |
| A06 Vulnerable Components | ✅ 実装済み | npm audit, Dependabot |
| A07 Authentication Failures | 🚧 実装予定 | Cognito, MFA |
| A08 Software Integrity Failures | ✅ 実装済み | npm integrity check |
| A09 Security Logging Failures | 🚧 実装予定 | CloudWatch, CloudTrail |
| A10 SSRF | 🚧 実装予定 | VPC endpoints, IMDSv2 |

## 連携エージェント

SecurityAgentは他のCCAGIエージェントと連携します：

```
1. CoordinatorAgent → SecurityAgent
   - セキュリティタスク検出 → SecurityAgent起動

2. CodeGenAgent → SecurityAgent
   - コード生成時にセキュアコーディングガイドライン取得

3. SecurityAgent ★ → ReviewAgent
   - セキュリティスコア提供 → 品質評価に統合

4. SecurityAgent ★ → PRAgent
   - セキュリティチェック完了 → Draft PR作成許可
```

## パフォーマンスメトリクス

| メトリクス | 目標値 | 現在値 |
|-----------|--------|--------|
| セキュリティスキャン時間 | < 5分 | ~3分 |
| Critical修正時間 | < 4時間 | TBD |
| High修正時間 | < 24時間 | TBD |
| セキュリティスコア | ≥ 80/100 | 85/100 |

---

## ローカルセキュリティスキャン

CCAGIでは外部AWS依存を排除し、ローカル完結型のセキュリティスキャンを実行します。

### セキュリティスキャンコマンド

```bash
# 依存関係脆弱性スキャン
npm audit --production

# 静的解析
npm run lint

# 型チェック
npm run typecheck

# 統合セキュリティスキャン
npm run security:scan
```

### セキュリティレポート形式

```json
{
  "scanId": "security-scan-local",
  "timestamp": "2025-12-02T12:00:00Z",
  "overallScore": 85,
  "status": "PASS",

  "dependencies": {
    "critical": 0,
    "high": 0,
    "medium": 2
  },

  "staticAnalysis": {
    "eslintErrors": 0,
    "eslintWarnings": 5
  },

  "typeCheck": {
    "errors": 0,
    "status": "PASS"
  }
}
```

---

🔒 **Security First, Developer Friendly** - セキュリティで守るべきところは守り、開発の邪魔はしない
