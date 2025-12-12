# S3 Audit Log Bucket - 使用ガイド

## クイックスタート

### 1. KMSキーの作成（事前準備）

監査ログバケットには暗号化が必須です。まずKMSキーを作成してください。

```bash
# KMSキーの作成
aws kms create-key \
  --description "S3 Audit Log Encryption Key" \
  --key-usage ENCRYPT_DECRYPT \
  --origin AWS_KMS

# エイリアスの作成（オプション）
aws kms create-alias \
  --alias-name alias/s3-audit-log \
  --target-key-id <KEY_ID>

# KMS Key ARNを取得
aws kms describe-key --key-id <KEY_ID> --query 'KeyMetadata.Arn' --output text
```

### 2. モジュールの使用

#### 基本的な使用例

```hcl
module "s3_audit" {
  source = "./modules/s3"

  project_name = "myproject"
  environment  = "prod"

  # 監査ログバケット有効化
  enable_audit_log = true
  kms_key_arn     = "arn:aws:kms:ap-northeast-1:123456789012:key/xxxx"

  tags = {
    ManagedBy  = "Terraform"
    Compliance = "commercial-law-10years"
  }
}
```

#### すべてのオプションを使用する例

```hcl
module "s3_audit_complete" {
  source = "./modules/s3"

  project_name = "myproject"
  environment  = "prod"

  # 監査ログバケット設定
  enable_audit_log              = true
  kms_key_arn                  = var.kms_key_arn
  audit_log_retention_mode     = "GOVERNANCE"
  audit_log_retention_years    = 10
  audit_log_glacier_transition_days      = 90
  audit_log_deep_archive_transition_days = 365

  # アクセスログ有効化
  enable_access_logging = true
  access_log_bucket_id  = "myproject-access-logs-prod"

  tags = var.common_tags
}
```

### 3. 実行コマンド

```bash
# モジュールディレクトリに移動
cd terraform/modules/s3

# 初期化
terraform init

# プラン確認
terraform plan

# 適用
terraform apply

# 出力確認
terraform output
```

## 出力値の使用例

```hcl
# 監査ログバケットIDを取得
output "audit_bucket_id" {
  value = module.s3_audit.audit_log_bucket_id
}

# 監査ログバケットARNを取得
output "audit_bucket_arn" {
  value = module.s3_audit.audit_log_bucket_arn
}

# Object Lock設定情報を取得
output "object_lock_info" {
  value = module.s3_audit.audit_log_object_lock_configuration
}
```

## テスト方法

### 1. バケット作成の確認

```bash
# バケット一覧
aws s3 ls | grep audit-log

# バケット詳細
aws s3api head-bucket --bucket <BUCKET_NAME>
```

### 2. Object Lock設定の確認

```bash
# Object Lock設定確認
aws s3api get-object-lock-configuration --bucket <BUCKET_NAME>

# 期待される出力例:
# {
#   "ObjectLockConfiguration": {
#     "ObjectLockEnabled": "Enabled",
#     "Rule": {
#       "DefaultRetention": {
#         "Mode": "GOVERNANCE",
#         "Years": 10
#       }
#     }
#   }
# }
```

### 3. 暗号化設定の確認

```bash
# 暗号化設定確認
aws s3api get-bucket-encryption --bucket <BUCKET_NAME>
```

### 4. ライフサイクルポリシーの確認

```bash
# ライフサイクルポリシー確認
aws s3api get-bucket-lifecycle-configuration --bucket <BUCKET_NAME>
```

### 5. ファイルアップロードテスト

```bash
# テストファイル作成
echo "Test audit log" > test-audit.log

# アップロード
aws s3 cp test-audit.log s3://<BUCKET_NAME>/test/

# Object Lock確認
aws s3api head-object \
  --bucket <BUCKET_NAME> \
  --key test/test-audit.log
```

### 6. 削除保護のテスト

```bash
# 削除を試みる（失敗するはず）
aws s3 rm s3://<BUCKET_NAME>/test/test-audit.log

# 期待されるエラー:
# An error occurred (AccessDenied) when calling the DeleteObject operation
```

## トラブルシューティング

### エラー: "Object Lock configuration cannot be enabled on existing buckets"

**原因**: 既存のバケットにObject Lockを有効化しようとした

**解決策**: バケットを削除してから再作成するか、新しいバケット名を使用

```bash
# バケット削除（すべてのオブジェクトを削除してから）
aws s3 rb s3://<BUCKET_NAME> --force
```

### エラー: "KMS key not found"

**原因**: KMSキーのARNが間違っている、または権限がない

**解決策**:
```bash
# KMSキー確認
aws kms describe-key --key-id <KEY_ID>

# 権限確認
aws kms get-key-policy --key-id <KEY_ID> --policy-name default
```

### エラー: "Access Denied" when deleting objects

**原因**: Object Lockが有効で、保持期間中のオブジェクトを削除しようとした

**解決策**:
```bash
# GOVERNANCEモードの場合: バイパス権限で削除
aws s3api delete-object \
  --bucket <BUCKET_NAME> \
  --key <OBJECT_KEY> \
  --bypass-governance-retention

# COMPLIANCEモードの場合: 保持期間満了まで削除不可
```

## セキュリティベストプラクティス

1. **KMSキーのローテーション**: 自動キーローテーションを有効化
   ```bash
   aws kms enable-key-rotation --key-id <KEY_ID>
   ```

2. **アクセスログの有効化**: 監査トレイルのため
   ```hcl
   enable_access_logging = true
   ```

3. **最小権限の原則**: IAMポリシーで必要最小限の権限のみ付与
   ```json
   {
     "Effect": "Allow",
     "Action": [
       "s3:PutObject",
       "s3:PutObjectRetention",
       "s3:GetObject",
       "s3:GetObjectRetention"
     ],
     "Resource": "arn:aws:s3:::bucket-name/*"
   }
   ```

4. **CloudTrailログ**: S3 APIコールの監査
   ```bash
   # CloudTrailでS3データイベントを有効化
   aws cloudtrail put-event-selectors \
     --trail-name <TRAIL_NAME> \
     --event-selectors '[{"ReadWriteType":"All","IncludeManagementEvents":true,"DataResources":[{"Type":"AWS::S3::Object","Values":["arn:aws:s3:::<BUCKET_NAME>/*"]}]}]'
   ```

## コスト最適化

### ストレージクラス別の料金（ap-northeast-1）

| ストレージクラス | 料金/GB/月 | 取り出し料金 | 取り出し時間 |
|-----------------|-----------|------------|-------------|
| S3 Standard | $0.025 | 無料 | 即時 |
| GLACIER | $0.005 | $0.01/GB | 数時間 |
| DEEP_ARCHIVE | $0.002 | $0.02/GB | 最大12時間 |

### 推奨ライフサイクル設定

```hcl
# コスト重視（早期アーカイブ）
audit_log_glacier_transition_days      = 30   # 30日でGLACIER
audit_log_deep_archive_transition_days = 90   # 90日でDEEP_ARCHIVE

# バランス重視（デフォルト）
audit_log_glacier_transition_days      = 90   # 90日でGLACIER
audit_log_deep_archive_transition_days = 365  # 1年でDEEP_ARCHIVE

# アクセス重視（長期Standard）
audit_log_glacier_transition_days      = 365  # 1年でGLACIER
audit_log_deep_archive_transition_days = 1825 # 5年でDEEP_ARCHIVE
```

## FAQ

### Q1: GOVERNANCEとCOMPLIANCEの違いは？

**A**:
- **GOVERNANCE**: 特権ユーザー（`s3:BypassGovernanceRetention`権限）が削除可能。内部監査に推奨。
- **COMPLIANCE**: 保持期間中は誰も削除不可（rootユーザーでも不可）。厳格な法規制対応に推奨。

### Q2: Object Lock有効バケットを削除するには？

**A**:
```bash
# 1. すべてのオブジェクトを削除（バイパス権限が必要）
aws s3api list-object-versions --bucket <BUCKET_NAME> | \
  jq -r '.Versions[] | "--key \(.Key) --version-id \(.VersionId)"' | \
  xargs -I {} aws s3api delete-object --bucket <BUCKET_NAME> {} --bypass-governance-retention

# 2. バケットを削除
aws s3 rb s3://<BUCKET_NAME>
```

### Q3: ライフサイクルポリシーの変更は既存オブジェクトに適用される？

**A**: はい、ライフサイクルポリシー変更は既存オブジェクトにも適用されます。ただし、変更が反映されるまで最大48時間かかる場合があります。

### Q4: DEEP_ARCHIVEからのデータ取り出しにかかる時間は？

**A**:
- **標準取り出し**: 最大12時間
- **一括取り出し**: 最大48時間（最も安価）

急ぎの場合はGLACIERを推奨（数時間で取り出し可能）。

## 参考資料

- [AWS S3 Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html)
- [S3 Storage Classes](https://aws.amazon.com/s3/storage-classes/)
- [S3 Lifecycle Configuration](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html)
- [KMS Best Practices](https://docs.aws.amazon.com/kms/latest/developerguide/best-practices.html)
