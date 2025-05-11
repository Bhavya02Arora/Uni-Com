########################################
# 1) Origin Access Control & Signing Keys
########################################

resource "aws_cloudfront_origin_access_control" "s3_oac" {
  name                              = "${var.app_name}-${var.app_environment}-origin-access-control"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "tls_private_key" "cloudfront_signing_key" {
  algorithm = "RSA"
  rsa_bits  = 2048
}

resource "aws_cloudfront_public_key" "signing_key" {
  encoded_key = tls_private_key.cloudfront_signing_key.public_key_pem
  name        = "${var.app_name}-${var.app_environment}-s3-distribution-public-key"
}

resource "aws_cloudfront_key_group" "signing_key_group" {
  items = [aws_cloudfront_public_key.signing_key.id]
  name  = "${var.app_name}-${var.app_environment}-s3-distribution-key-group"
}

########################################
# 2) Path‐Rewrite Function
########################################

resource "aws_cloudfront_function" "path_rewrite" {
  name    = "${var.app_name}-${var.app_environment}-path-rewrite"
  runtime = "cloudfront-js-1.0"
  publish = true

  code = <<-EOF
    function handler(event) {
      var request = event.request;
      var uri     = request.uri;

      // If no file extension and not "/" or ending with "/", append .html
      if (!uri.includes('.') && uri !== '/' && !uri.endsWith('/')) {
        request.uri = uri + '.html';
      }
      return request;
    }
  EOF
}

########################################
# 3) CloudFront Distribution
########################################

resource "aws_cloudfront_distribution" "s3_distribution" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "Some comment"
  default_root_object = "index.html"
  price_class         = var.s3_distribution_price_class

  # ─── Origins ────────────────────────────────────────────────────────────────
  origin {
    domain_name              = aws_s3_bucket.images_bucket.bucket_regional_domain_name
    origin_id                = "${var.app_name}-${var.app_environment}-s3-images-origin-${random_id.app_id.hex}"
    origin_access_control_id = aws_cloudfront_origin_access_control.s3_oac.id
  }

  origin {
    domain_name = aws_s3_bucket_website_configuration.website_config.website_endpoint
    origin_id   = "${var.app_name}-${var.app_environment}-s3-website-origin-${random_id.app_id.hex}"

    custom_origin_config {
      http_port                = 80
      https_port               = 443
      origin_keepalive_timeout = 5
      origin_read_timeout      = 30
      origin_protocol_policy   = "http-only"
      origin_ssl_protocols     = ["SSLv3", "TLSv1", "TLSv1.1", "TLSv1.2"]
    }
  }

  # ─── Default Cache Behavior ─────────────────────────────────────────────────
  default_cache_behavior {
    target_origin_id       = "${var.app_name}-${var.app_environment}-s3-website-origin-${random_id.app_id.hex}"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      headers      = ["Origin"]

      cookies {
        forward = "none"
      }
    }

    # Invoke the path-rewrite function on every request
    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.path_rewrite.arn
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  # ─── Additional Cache Behavior ───────────────────────────────────────────────
  ordered_cache_behavior {
    path_pattern           = "/published/**"
    target_origin_id       = "${var.app_name}-${var.app_environment}-s3-images-origin-${random_id.app_id.hex}"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      headers      = ["Origin"]

      cookies {
        forward = "none"
      }
    }

    trusted_key_groups = [aws_cloudfront_key_group.signing_key_group.id]

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  # ─── Geo Restriction ─────────────────────────────────────────────────────────
  restrictions {
    geo_restriction {
      restriction_type = "whitelist"
      locations        = ["US"]
    }
  }

  # ─── TLS Certificate ─────────────────────────────────────────────────────────
  viewer_certificate {
    cloudfront_default_certificate = true
  }

  # ─── Tags ────────────────────────────────────────────────────────────────────
  tags = merge(
    var.additional_tags,
    {
      Name        = "${var.app_name}-${var.app_environment}-s3-distribution"
      Environment = var.app_environment
    }
  )
}
