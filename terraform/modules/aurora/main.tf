# ============================================================
# Aurora PostgreSQL Serverless v2 Cluster
# ============================================================

# DB Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-${var.environment}-aurora-subnet-group"
  subnet_ids = var.subnet_ids

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-${var.environment}-aurora-subnet-group"
      Environment = var.environment
    }
  )
}

# Security Group for Aurora Cluster
resource "aws_security_group" "aurora" {
  name        = "${var.project_name}-${var.environment}-aurora-sg"
  description = "Security group for Aurora PostgreSQL cluster"
  vpc_id      = var.vpc_id

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-${var.environment}-aurora-sg"
      Environment = var.environment
    }
  )
}

# Allow inbound PostgreSQL traffic from application security groups
resource "aws_security_group_rule" "aurora_ingress" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = var.app_security_group_id
  security_group_id        = aws_security_group.aurora.id
  description              = "Allow PostgreSQL traffic from application"
}

# Allow all outbound traffic
resource "aws_security_group_rule" "aurora_egress" {
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.aurora.id
  description       = "Allow all outbound traffic"
}

# RDS Cluster Parameter Group
resource "aws_rds_cluster_parameter_group" "main" {
  name        = "${var.project_name}-${var.environment}-aurora-pg15-cluster-params"
  family      = "aurora-postgresql15"
  description = "Aurora PostgreSQL 15 cluster parameter group"

  parameter {
    name  = "log_statement"
    value = var.environment == "prod" ? "ddl" : "all"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000" # Log queries taking longer than 1 second
  }

  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements"
  }

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-${var.environment}-aurora-pg15-cluster-params"
      Environment = var.environment
    }
  )
}

# DB Parameter Group
resource "aws_db_parameter_group" "main" {
  name        = "${var.project_name}-${var.environment}-aurora-pg15-db-params"
  family      = "aurora-postgresql15"
  description = "Aurora PostgreSQL 15 DB parameter group"

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-${var.environment}-aurora-pg15-db-params"
      Environment = var.environment
    }
  )
}

# Aurora PostgreSQL Cluster
resource "aws_rds_cluster" "main" {
  cluster_identifier = "${var.project_name}-${var.environment}-aurora-cluster"
  engine             = "aurora-postgresql"
  engine_mode        = "provisioned"
  engine_version     = var.engine_version
  database_name      = var.database_name
  master_username    = var.master_username
  master_password    = var.master_password

  # Serverless v2 Scaling Configuration
  serverlessv2_scaling_configuration {
    min_capacity = var.min_capacity
    max_capacity = var.max_capacity
  }

  # Encryption
  storage_encrypted = true
  kms_key_id        = var.kms_key_arn

  # Backup Configuration
  backup_retention_period      = var.backup_retention_period
  preferred_backup_window      = var.preferred_backup_window
  preferred_maintenance_window = var.preferred_maintenance_window

  # Network Configuration
  vpc_security_group_ids          = [aws_security_group.aurora.id]
  db_subnet_group_name            = aws_db_subnet_group.main.name
  db_cluster_parameter_group_name = aws_rds_cluster_parameter_group.main.name

  # High Availability
  enabled_cloudwatch_logs_exports = ["postgresql"]
  deletion_protection             = var.deletion_protection
  skip_final_snapshot             = var.skip_final_snapshot
  final_snapshot_identifier       = var.skip_final_snapshot ? null : "${var.project_name}-${var.environment}-aurora-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"

  # IAM Database Authentication
  iam_database_authentication_enabled = var.iam_database_authentication_enabled

  # Copy tags to snapshots
  copy_tags_to_snapshot = true

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-${var.environment}-aurora-cluster"
      Environment = var.environment
    }
  )

  depends_on = [aws_cloudwatch_log_group.postgresql]
}

# CloudWatch Log Group for PostgreSQL logs
resource "aws_cloudwatch_log_group" "postgresql" {
  name              = "/aws/rds/cluster/${var.project_name}-${var.environment}-aurora-cluster/postgresql"
  retention_in_days = var.log_retention_days

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-${var.environment}-aurora-postgresql-logs"
      Environment = var.environment
    }
  )
}

# Aurora Cluster Instance - Writer
resource "aws_rds_cluster_instance" "writer" {
  identifier                            = "${var.project_name}-${var.environment}-aurora-writer"
  cluster_identifier                    = aws_rds_cluster.main.id
  instance_class                        = "db.serverless"
  engine                                = aws_rds_cluster.main.engine
  engine_version                        = aws_rds_cluster.main.engine_version
  db_parameter_group_name               = aws_db_parameter_group.main.name
  publicly_accessible                   = false
  auto_minor_version_upgrade            = var.auto_minor_version_upgrade
  performance_insights_enabled          = var.performance_insights_enabled
  performance_insights_kms_key_id       = var.performance_insights_enabled ? var.kms_key_arn : null
  performance_insights_retention_period = var.performance_insights_enabled ? var.performance_insights_retention_period : null

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-${var.environment}-aurora-writer"
      Environment = var.environment
      Role        = "writer"
    }
  )
}

# Aurora Cluster Instance - Reader
resource "aws_rds_cluster_instance" "reader" {
  count = var.reader_count

  identifier                            = "${var.project_name}-${var.environment}-aurora-reader-${count.index + 1}"
  cluster_identifier                    = aws_rds_cluster.main.id
  instance_class                        = "db.serverless"
  engine                                = aws_rds_cluster.main.engine
  engine_version                        = aws_rds_cluster.main.engine_version
  db_parameter_group_name               = aws_db_parameter_group.main.name
  publicly_accessible                   = false
  auto_minor_version_upgrade            = var.auto_minor_version_upgrade
  performance_insights_enabled          = var.performance_insights_enabled
  performance_insights_kms_key_id       = var.performance_insights_enabled ? var.kms_key_arn : null
  performance_insights_retention_period = var.performance_insights_enabled ? var.performance_insights_retention_period : null

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-${var.environment}-aurora-reader-${count.index + 1}"
      Environment = var.environment
      Role        = "reader"
    }
  )
}

# CloudWatch Alarms for Aurora Cluster
resource "aws_cloudwatch_metric_alarm" "aurora_cpu" {
  alarm_name          = "${var.project_name}-${var.environment}-aurora-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors Aurora cluster CPU utilization"
  alarm_actions       = var.alarm_sns_topic_arn != null ? [var.alarm_sns_topic_arn] : []

  dimensions = {
    DBClusterIdentifier = aws_rds_cluster.main.cluster_identifier
  }

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-${var.environment}-aurora-high-cpu"
      Environment = var.environment
    }
  )
}

resource "aws_cloudwatch_metric_alarm" "aurora_capacity" {
  alarm_name          = "${var.project_name}-${var.environment}-aurora-high-capacity"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ServerlessDatabaseCapacity"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = var.max_capacity * 0.8 # Alert at 80% of max capacity
  alarm_description   = "This metric monitors Aurora Serverless capacity"
  alarm_actions       = var.alarm_sns_topic_arn != null ? [var.alarm_sns_topic_arn] : []

  dimensions = {
    DBClusterIdentifier = aws_rds_cluster.main.cluster_identifier
  }

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-${var.environment}-aurora-high-capacity"
      Environment = var.environment
    }
  )
}

resource "aws_cloudwatch_metric_alarm" "aurora_connections" {
  alarm_name          = "${var.project_name}-${var.environment}-aurora-high-connections"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "800" # Adjust based on your expected connection count
  alarm_description   = "This metric monitors Aurora database connections"
  alarm_actions       = var.alarm_sns_topic_arn != null ? [var.alarm_sns_topic_arn] : []

  dimensions = {
    DBClusterIdentifier = aws_rds_cluster.main.cluster_identifier
  }

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-${var.environment}-aurora-high-connections"
      Environment = var.environment
    }
  )
}
