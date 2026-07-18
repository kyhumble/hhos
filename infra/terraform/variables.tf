variable "project" {
  type        = string
  description = "Project name prefix"
  default     = "hhos"
}

variable "environment" {
  type        = string
  description = "dev | stage | prod"
  default     = "dev"
}

variable "aws_region" {
  type        = string
  description = "AWS region (HIPAA-eligible)"
  default     = "us-east-1"
}
