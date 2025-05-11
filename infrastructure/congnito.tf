resource "aws_cognito_user_pool" "userpool" {
  name = "${var.app_name}-${var.app_environment}-userpool"

  lambda_config {
    pre_sign_up = aws_lambda_function.pre_signup_lambda.arn
  }

  schema {
    name                     = "email"
    attribute_data_type      = "String"
    mutable                  = true
    developer_only_attribute = false
  }

  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
  }

  auto_verified_attributes = ["email"]

  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  password_policy {
    minimum_length    = 6
    require_lowercase = false
    require_numbers   = false
    require_symbols   = false
    require_uppercase = false
  }

  username_attributes = ["email"]

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  lifecycle {
    ignore_changes = [
      schema,
    ]
  }
}

resource "aws_cognito_user_pool_client" "userpool_client" {
  name = "${var.app_name}-${var.app_environment}-userpool-client"

  user_pool_id                  = aws_cognito_user_pool.userpool.id
  supported_identity_providers  = ["COGNITO"]
  explicit_auth_flows           = ["ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH", "ALLOW_USER_PASSWORD_AUTH"]
  generate_secret               = false
  prevent_user_existence_errors = "LEGACY"
  refresh_token_validity        = 30
  access_token_validity         = 1
  id_token_validity             = 1
  token_validity_units {
    access_token  = "days"
    id_token      = "days"
    refresh_token = "days"
  }
  callback_urls = ["https://${aws_cloudfront_distribution.s3_distribution.domain_name}", # CloudFront distribution URL
                   "http://localhost:3000/"] # Local development callback URL
  logout_urls   = ["https://${aws_cloudfront_distribution.s3_distribution.domain_name}", "http://localhost:3000/"]

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["implicit"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]

}

resource "aws_lambda_function" "pre_signup_lambda" {
  filename      = "scripts/pre_signup_lambda.zip"
  function_name = "PreSignupLambdaFunc"
  role          = aws_iam_role.lambda_role.arn
  handler       = "pre_signup_lambda.lambda_handler"
  runtime       = "python3.11"

  source_code_hash = filebase64sha256("scripts/pre_signup_lambda.zip")
}

resource "aws_iam_role" "lambda_role" {
  name = "${var.app_name}-${var.app_environment}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_policy_attachment" "lambda_basic_execution" {
  name       = "${var.app_name}-${var.app_environment}-lambda-basic-execution"
  roles      = [aws_iam_role.lambda_role.name]
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_cognito_user_pool_domain" "userpool_domain" {
  domain       = "${var.app_name}-${var.app_environment}-${random_id.app_id.hex}"
  user_pool_id = aws_cognito_user_pool.userpool.id
}

resource "aws_iam_role_policy" "lambda_cognito_permissions" {
  name = "lambda_cognito_policy"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "cognito-idp:ListUsers",
          "cognito-idp:AdminUpdateUserAttributes",
          "cognito-idp:AdminCreateUser",
          "cognito-idp:AdminConfirmSignUp",
          "cognito-idp:DescribeUserPool",
          "cognito-idp:DescribeUserPoolClient",
          "cognito-idp:GetUser",
          "cognito-idp:AdminEnableUser",
          "lambda:InvokeFunction"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "*"
      }
    ]
  })
}

# Added to allow Cognito to invoke the Lambda function
resource "aws_lambda_permission" "allow_cognito" {
  statement_id  = "AllowCognitoInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.pre_signup_lambda.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.userpool.arn
}