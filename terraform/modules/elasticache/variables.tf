# ElastiCache (Redis) Module Variables

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "vpc_id" {
  description = "VPC ID where ElastiCache will be deployed"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs for ElastiCache subnet group (use private subnets)"
  type        = list(string)
}

variable "allowed_security_group_ids" {
  description = "List of security group IDs allowed to access Redis (e.g., ECS, Lambda)"
  type        = list(string)
}

# Engine Configuration
variable "engine_version" {
  description = "Redis engine version"
  type        = string
  default     = "7.1"
}

variable "parameter_group_family" {
  description = "Redis parameter group family"
  type        = string
  default     = "redis7"
}

# Node Configuration
variable "node_type" {
  description = "ElastiCache node type (e.g., cache.t4g.micro for dev, cache.r6g.large for prod)"
  type        = string
  default     = "cache.t4g.micro"
}

variable "num_cache_clusters" {
  description = "Number of cache clusters (primary + replicas). Minimum 2 for automatic failover."
  type        = number
  default     = 2
  validation {
    condition     = var.num_cache_clusters >= 1 && var.num_cache_clusters <= 6
    error_message = "Number of cache clusters must be between 1 and 6."
  }
}

variable "multi_az_enabled" {
  description = "Enable Multi-AZ for automatic failover"
  type        = bool
  default     = true
}

# Security Configuration
variable "auth_token" {
  description = "AUTH token for Redis authentication (leave empty to auto-generate)"
  type        = string
  default     = ""
  sensitive   = true
}

# Memory Policy
variable "maxmemory_policy" {
  description = "Redis maxmemory eviction policy (allkeys-lru for cache, volatile-lru for rate limiting)"
  type        = string
  default     = "allkeys-lru"
  validation {
    condition = contains([
      "volatile-lru", "allkeys-lru", "volatile-lfu", "allkeys-lfu",
      "volatile-random", "allkeys-random", "volatile-ttl", "noeviction"
    ], var.maxmemory_policy)
    error_message = "Invalid maxmemory policy."
  }
}

# Backup Configuration
variable "snapshot_retention_limit" {
  description = "Number of days to retain automatic snapshots (0 to disable)"
  type        = number
  default     = 7
  validation {
    condition     = var.snapshot_retention_limit >= 0 && var.snapshot_retention_limit <= 35
    error_message = "Snapshot retention limit must be between 0 and 35 days."
  }
}

variable "snapshot_window" {
  description = "Daily time range for automatic snapshots (UTC)"
  type        = string
  default     = "03:00-05:00"
}

variable "maintenance_window" {
  description = "Weekly time range for maintenance (UTC)"
  type        = string
  default     = "sun:05:00-sun:07:00"
}

# Auto-upgrade
variable "auto_minor_version_upgrade" {
  description = "Enable automatic minor version upgrades"
  type        = bool
  default     = true
}

# Logging Configuration
variable "log_retention_days" {
  description = "CloudWatch Logs retention period in days"
  type        = number
  default     = 7
  validation {
    condition = contains([
      1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653
    ], var.log_retention_days)
    error_message = "Log retention days must be a valid CloudWatch Logs retention value."
  }
}

# CloudWatch Alarms
variable "enable_alarms" {
  description = "Enable CloudWatch alarms for monitoring"
  type        = bool
  default     = true
}

variable "alarm_sns_topic_arns" {
  description = "List of SNS topic ARNs for CloudWatch alarm notifications"
  type        = list(string)
  default     = []
}

variable "cpu_utilization_threshold" {
  description = "CPU utilization threshold for CloudWatch alarm (percentage)"
  type        = number
  default     = 75
}

variable "memory_usage_threshold" {
  description = "Memory usage threshold for CloudWatch alarm (percentage)"
  type        = number
  default     = 80
}

# Tags
variable "tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}
