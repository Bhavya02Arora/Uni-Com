# global variables
app_name = "unicom"
app_environment = "dev"
# app_region = "us-east-1"

# vpc variables
vpc_cidr = "10.0.0.0/16"
public_subnet_cidrs = ["10.0.1.0/24", "10.0.2.0/24"]
private_subnet_cidrs = ["10.0.4.0/24", "10.0.5.0/24"]
azs = ["us-east-1a", "us-east-1b"]

# ec2 variables
api_container_image = "jheelp/unicom:latest" # Change this to your API container image

# docdb variables
db_username = "unicom"
db_password = "password1234" # Change this to a secure password
db_instance_class = "db.t3.medium"

# openai
embeddings_provider = "GEMINI"
# embeddings_api_key = "AIzaSyD-ypJnX37-o_05TssKpZQDRo3aYr5Fg9g"
# embeddings_api_key = "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"
