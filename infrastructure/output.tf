# Output cloudfront distribution domain name
output "cloudfront_distribution_domain_name" {
  value       = "https://${aws_cloudfront_distribution.s3_distribution.domain_name}/"
  description = "The domain name of the CloudFront distribution for the website and post images buckets"
}

# Output API URL
output "api_gateway_url" {
  value       = aws_apigatewayv2_stage.default.invoke_url
  description = "The URL of the API Gateway for the application"
}   

# Cognito login URL
output "cognito_login_url" {
  value = "https://${aws_cognito_user_pool_domain.userpool_domain.domain}.auth.${var.app_region}.amazoncognito.com/login?client_id=${aws_cognito_user_pool_client.userpool_client.id}&response_type=token&scope=openid+email+profile&redirect_uri=https://${aws_cloudfront_distribution.s3_distribution.domain_name}"
  description = "The login URL for the Cognito user pool"
}

output "cognito_logout_url" {
  value = "https://${aws_cognito_user_pool_domain.userpool_domain.domain}.auth.${var.app_region}.amazoncognito.com/logout?client_id=${aws_cognito_user_pool_client.userpool_client.id}&logout_uri=https://${aws_cloudfront_distribution.s3_distribution.domain_name}"
  description = "The logout URL for the Cognito user pool"
}
