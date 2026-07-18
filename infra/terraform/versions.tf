terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Configure backend and provider in a later phase after account/BAA setup.
# provider "aws" {
#   region = var.aws_region
# }
