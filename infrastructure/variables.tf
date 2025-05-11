# # application global variables
variable "app_name" {
  description = "Application name"
  type        = string
}
variable "app_environment" {
  description = "Application environment"
  type        = string
}
variable "app_region" {
  description = "Application region"
  type        = string
  default     = "us-east-2"
}
variable "additional_tags" {
  description = "Additional tags to be applied to all resources"
  type        = map(string)
  default     = {}
}
variable "aws_profile" {
  description = "AWS profile to use"
  type        = string
  default     = "default"
}


# vpc variables
variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  type        = list(string)
  description = "Public Subnet CIDR values"
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  type        = list(string)
  description = "Private Subnet CIDR values"
  default     = ["10.0.4.0/24", "10.0.5.0/24"]
}

variable "azs" {
  type        = list(string)
  description = "Availability Zones"
  default     = ["us-east-2a", "us-east-2b"] # Update this to match your desired availability zones
}


# ec2 variables
variable "health_check_path" {
  description = "Health check path for the ALB"
  type        = string
  default     = "/health"
}

# api gateway variables


# documentdb variables
variable "db_instance_class" {
  description = "Instance class for DocumentDB"
  type        = string
  default     = "db.r5.large"
}
variable "db_username" {
  description = "Master username for DocumentDB"
  type        = string
  sensitive   = true
}
variable "db_password" {
  description = "Master password for DocumentDB"
  type        = string
  sensitive   = true
}
variable "db_skip_final_snapshot" {
  description = "Skip final snapshot for DocumentDB"
  type        = bool
  default     = true
}

# cloudfront variables
variable "s3_distribution_price_class" {
  description = "Price class for CloudFront distribution"
  type        = string
  default     = "PriceClass_100" # Options: PriceClass_100, PriceClass_200, PriceClass_All
}
variable "s3_distribution_public_key" {
  description = "Path to the public key for CloudFront signing"
  type        = string
  default     = "keys/public_key.pem" # Update this path to your public key file
}

variable "embeddings_provider" {
  description = "Embeddings provider for the application"
  type        = string
}
variable "embeddings_api_key" {
  description = "OpenAI API key for the application"
  type        = string
  sensitive   = true
}

variable "api_container_image" {
  description = "Container image for the API application"
  type        = string
}
