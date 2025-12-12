# S3 Terraform Module

AWS S3バケットの管理モジュール。汎用バケットと監査ログバケット（Object Lock対応）の両方に対応。

## 機能

### 汎用バケット
- アップロード用バケット
- アセット保存用バケット
- バージョニング対応
- CORS設定
- ライフサイクルルール

### 監査ログバケット（Object Lock対応）
- **WORM（Write Once Read Many）**: 改ざん防止
- **10年保存**: 商法準拠の長期保存
- **KMS暗号化**: データ暗号化
- **ライフサイクル自動移行**: コスト最適化
  - 90日後: GLACIER移行
  - 365日後: DEEP_ARCHIVE移行
  - 10年後: 自動削除
- **Object Lock**: GOVERNANCE/COMPLIANCEモード選択可能
- **バージョニング**: 必須有効化
- **パブリックアクセスブロック**: セキュリティ強化
- **アクセスログ**: オプション設定可能

## 使用方法

### 基本的な使用例（汎用バケット）

```hcl
module "s3" {
  source = "./modules/s3"

  project_name = "myproject"
  environment  = "prod"
  enabled      = true

  buckets = ["uploads", "assets"]

  tags = {
    ManagedBy = "Terraform"
    Project   = "MyProject"
  }
}
```

### 監査ログバケットの使用例

```hcl
module "s3_audit" {
  source = "./modules/s3"

  project_name = "myproject"
  environment  = "prod"

  # 汎用バケットは無効化
  enabled = false

  # 監査ログバケット有効化
  enable_audit_log = true
  kms_key_arn     = "arn:aws:kms:ap-northeast-1:123456789012:key/12345678-1234-1234-1234-123456789012"

  # オプション: カスタム設定
  audit_log_retention_mode             = "GOVERNANCE"  # または "COMPLIANCE"
  audit_log_retention_years            = 10
  audit_log_glacier_transition_days    = 90
  audit_log_deep_archive_transition_days = 365

  # アクセスログ有効化（オプション）
  enable_access_logging = true
  access_log_bucket_id  = "myproject-access-logs-prod"

  tags = {
    ManagedBy  = "Terraform"
    Compliance = "commercial-law-10years"
  }
}
```

### 両方を使用する例

```hcl
module "s3" {
  source = "./modules/s3"

  project_name = "myproject"
  environment  = "prod"

  # 汎用バケット
  enabled = true
  buckets = ["uploads", "assets"]

  # 監査ログバケット
  enable_audit_log = true
  kms_key_arn     = var.kms_key_arn

  tags = var.common_tags
}
```

## 必須入力変数

| 変数名 | 型 | 説明 |
|--------|-----|------|
| `project_name` | string | プロジェクト名 |
| `environment` | string | 環境名（dev, stg, prod） |

## オプション入力変数

### 汎用バケット設定

| 変数名 | 型 | デフォルト | 説明 |
|--------|-----|------------|------|
| `enabled` | bool | `false` | 汎用バケットを作成するか |
| `buckets` | list(string) | `["uploads", "assets"]` | 作成するバケットリスト |
| `tags` | map(string) | `{}` | 共通タグ |

### 監査ログバケット設定

| 変数名 | 型 | デフォルト | 説明 |
|--------|-----|------------|------|
| `enable_audit_log` | bool | `false` | 監査ログバケットを作成するか |
| `kms_key_arn` | string | `""` | KMS CMKのARN（必須） |
| `audit_log_retention_mode` | string | `"GOVERNANCE"` | Object Lockモード |
| `audit_log_retention_years` | number | `10` | 保持期間（年） |
| `audit_log_glacier_transition_days` | number | `90` | GLACIER移行日数 |
| `audit_log_deep_archive_transition_days` | number | `365` | DEEP_ARCHIVE移行日数 |
| `enable_access_logging` | bool | `false` | アクセスログ有効化 |
| `access_log_bucket_id` | string | `""` | アクセスログ保存先バケット |

## 出力値

### 汎用バケット

| 出力名 | 説明 |
|--------|------|
| `bucket_names` | バケット名のマップ |
| `bucket_arns` | バケットARNのマップ |
| `bucket_regional_domain_names` | リージョナルドメイン名のマップ |

### 監査ログバケット

| 出力名 | 説明 |
|--------|------|
| `audit_log_bucket_id` | 監査ログバケットID |
| `audit_log_bucket_arn` | 監査ログバケットARN |
| `audit_log_bucket_domain_name` | バケットドメイン名 |
| `audit_log_bucket_regional_domain_name` | リージョナルドメイン名 |
| `audit_log_object_lock_configuration` | Object Lock設定情報 |
| `security_configuration` | セキュリティ設定情報（sensitive） |
| `lifecycle_configuration` | ライフサイクル設定情報 |
| `access_logging_enabled` | アクセスログ有効状態 |

## Object Lockモードの選択

### GOVERNANCE モード（推奨）
- 特権ユーザー（IAMポリシー`s3:BypassGovernanceRetention`権限）が削除可能
- 監査目的で適切
- 誤った設定の修正が可能
- **用途**: 内部監査、規制準拠

### COMPLIANCE モード
- 保持期間中は誰も削除不可（rootユーザーでも不可）
- より厳格なコンプライアンス要件
- 一度設定すると変更不可
- **用途**: 厳格な法規制対応、金融機関

## セキュリティ機能

1. **暗号化**: KMS-CMKによるサーバーサイド暗号化
2. **パブリックアクセスブロック**: すべてのパブリックアクセスを遮断
3. **バケットポリシー**:
   - 暗号化されていないアップロードを拒否
   - HTTP（非SSL）接続を拒否
4. **バージョニング**: すべての変更履歴を保持
5. **Object Lock**: 削除・上書き防止

## ライフサイクル管理

```
Day 0-90:      S3 Standard (高速アクセス)
Day 90-365:    GLACIER (低コスト)
Day 365-3650:  DEEP_ARCHIVE (最低コスト)
Day 3650+:     削除（10年保存期間満了）
```

## コスト最適化

- 90日後のGLACIER移行: ストレージコスト削減
- 1年後のDEEP_ARCHIVE移行: さらにコスト削減（約1/4）
- 非カレントバージョンの自動アーカイブ

## 注意事項

1. **Object Lock有効化**: バケット作成時のみ設定可能（後から変更不可）
2. **KMS Key必須**: 監査ログバケットにはKMS CMKのARNが必要
3. **バージョニング必須**: Object Lock使用時は自動的に有効化
4. **削除制限**: Object Lock有効バケットは空にしてから削除が必要
5. **DEEP_ARCHIVEの取り出し**: 最大12時間かかる場合あり

## 要件定義書準拠

このモジュールは以下の要件定義書に準拠しています：

- **Section 10.4**: S3監査ログバケット仕様
- **商法準拠**: 10年間の保存義務
- **改ざん防止**: Object Lock（WORM）
- **コスト最適化**: ライフサイクルポリシー

## Terraform バージョン

- Terraform >= 1.0
- AWS Provider >= 4.0

## 参考資料

- [AWS S3 Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html)
- [S3 Lifecycle Configuration](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html)
- [S3 Storage Classes](https://aws.amazon.com/s3/storage-classes/)
