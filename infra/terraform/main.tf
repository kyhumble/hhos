# Phase 0 stub — no resources created.
# Future: VPC, RDS, S3+KMS, ECS, Cognito, WAF.

locals {
  name_prefix = "${var.project}-${var.environment}"
}

output "notice" {
  value = "HHOS Terraform stub for ${local.name_prefix}. Implement modules after BAA."
}
