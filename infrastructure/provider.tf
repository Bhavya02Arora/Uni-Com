terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.88.0"
    }
  }
}

provider "aws" {
  # Configuration options
  region  = var.app_region
  # profile = var.aws_profile
}
