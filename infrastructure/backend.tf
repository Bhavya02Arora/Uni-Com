# manage state in S3
terraform {
  backend "s3" {
    bucket         = "unicom-iac-state"
    key            = "terraform.tfstate"
    region         = "us-east-1"
  }
}
