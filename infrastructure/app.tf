locals {
  # Build directory files (recursive)
  build_dir_files = fileset("${path.module}/../Next-app/unicom-webapp/out", "**")

  # Check if build directory exists
  build_dir_exists = fileexists("${path.module}/../Next-app/unicom-webapp/out/index.html")

  # Generate production environment content
  env_content = templatefile("${path.module}/../api/env.tpl", {
    aws_region                  = var.app_region
    flask_port                  = 8080
    mongo_host                  = aws_docdb_cluster.db_cluster.endpoint
    mongo_port                  = 27017
    mongo_db                    = var.app_name
    mongo_username              = var.db_username
    mongo_password              = var.db_password
    use_tls                     = true
    mongo_ca_file               = "/home/ec2-user/global-bundle.pem"
    mongo_min_pool_size         = 5
    mongo_max_pool_size         = 50
    cognito_pool_id             = aws_cognito_user_pool.userpool.id
    cognito_region              = var.app_region
    cognito_app_client_id       = aws_cognito_user_pool_client.userpool_client.id
    s3_bucket_name              = aws_s3_bucket.images_bucket.bucket
    cloudfront_url              = "https://${aws_cloudfront_distribution.s3_distribution.domain_name}/"
    cloudfront_key_pair_id      = aws_cloudfront_public_key.signing_key.id
    cloudfront_private_key_path = "/home/ec2-user/keys/private_key.pem"
    embeddings_provider         = var.embeddings_provider
    embeddings_api_key          = var.embeddings_api_key
  })

  # Generate local development environment content
  local_env_content = templatefile("${path.module}/../api/env.tpl", {
    aws_region                  = var.app_region
    flask_port                  = 8080
    mongo_host                  = "localhost"
    mongo_port                  = 27017
    mongo_db                    = "unicom"
    mongo_username              = "unicom"
    mongo_password              = var.db_password
    use_tls                     = true
    mongo_ca_file               = "global-bundle.pem"
    mongo_min_pool_size         = 5
    mongo_max_pool_size         = 50
    cognito_pool_id             = aws_cognito_user_pool.userpool.id
    cognito_region              = var.app_region
    cognito_app_client_id       = aws_cognito_user_pool_client.userpool_client.id
    s3_bucket_name              = aws_s3_bucket.images_bucket.bucket
    cloudfront_url              = "https://${aws_cloudfront_distribution.s3_distribution.domain_name}/"
    cloudfront_key_pair_id      = aws_cloudfront_public_key.signing_key.id
    cloudfront_private_key_path = "private_key.pem"
    embeddings_provider         = var.embeddings_provider
    embeddings_api_key          = var.embeddings_api_key
  })

  # MIME types mapping
  mime_types = {
    html        = "text/html"
    css         = "text/css"
    js          = "application/javascript"
    json        = "application/json"
    png         = "image/png"
    jpg         = "image/jpeg"
    jpeg        = "image/jpeg"
    svg         = "image/svg+xml"
    ico         = "image/x-icon"
    txt         = "text/plain"
    map         = "application/json"
    webmanifest = "application/manifest+json"
  }

  # Website config for frontend usage
  website_config = {
    base_url           = "https://${aws_cloudfront_distribution.s3_distribution.domain_name}/"
    cognito_login_url  = "https://${aws_cognito_user_pool_domain.userpool_domain.domain}.auth.${var.app_region}.amazoncognito.com/login?client_id=${aws_cognito_user_pool_client.userpool_client.id}&response_type=token&scope=openid+email+profile&redirect_uri=https://${aws_cloudfront_distribution.s3_distribution.domain_name}"
    cognito_logout_url = "https://${aws_cognito_user_pool_domain.userpool_domain.domain}.auth.${var.app_region}.amazoncognito.com/logout?client_id=${aws_cognito_user_pool_client.userpool_client.id}&logout_uri=https://${aws_cloudfront_distribution.s3_distribution.domain_name}"
    post_images_url    = "https://${aws_cloudfront_distribution.s3_distribution.domain_name}/published/"
    api_url            = "${aws_apigatewayv2_stage.default.invoke_url}"
    cloudfront_url     = "https://${aws_cloudfront_distribution.s3_distribution.domain_name}/"
  }
}

# Upload website frontend build files (recursive)
resource "aws_s3_object" "website_files" {
  count = local.build_dir_exists ? length(local.build_dir_files) : 0

  bucket = aws_s3_bucket.website_bucket.id

  key = replace(
    tolist(local.build_dir_files)[count.index],
    "^\\.*/",
    "" # Remove leading ./ if any
  )

  source = "${path.module}/../Next-app/unicom-webapp/out/${tolist(local.build_dir_files)[count.index]}"

  etag = filemd5("${path.module}/../Next-app/unicom-webapp/out/${tolist(local.build_dir_files)[count.index]}")

  content_type = lookup(
    local.mime_types,
    lower(regex("\\.([^.]+)$", tolist(local.build_dir_files)[count.index])[0]),
    "binary/octet-stream"
  )
}

# Write local development .env
resource "local_file" "write_local_env" {
  content  = local.local_env_content
  filename = "${path.module}/../api/.env"
}

# Write website configuration file for frontend
resource "local_file" "website_config" {
  content  = jsonencode(local.website_config)
  filename = "${path.module}/../Next-app/unicom-webapp/public/infra_config.json"
}
