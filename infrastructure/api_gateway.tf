locals {
  api_subnets     = aws_subnet.private_subnets[*].id
  api_vpc_id      = aws_vpc.main.id
}

resource "aws_security_group" "vpc_link_sg" {
  name        = "${var.app_name}-${var.app_environment}-vpc-link-sg"
  description = "Security group for VPC link"
  vpc_id      = local.api_vpc_id

  tags = merge(
    var.additional_tags,
    {
      "Name"        = "${var.app_name}-${var.app_environment}-vpc-link-sg",
      "Environment" = var.app_environment,
    }
  )
}

# Allow HTTPS from everywhere
resource "aws_security_group_rule" "vpc_link_allow_https" {
  type              = "ingress"
  protocol          = "tcp"
  from_port         = 443
  to_port           = 443
  security_group_id = aws_security_group.vpc_link_sg.id
  cidr_blocks       = ["0.0.0.0/0"]
  description       = "Allow HTTPS from everywhere"
}
# Allow all outbound
resource "aws_security_group_rule" "vpc_link_allow_all_outbound" {
  type              = "egress"
  protocol          = "-1"
  from_port         = 0
  to_port           = 0
  security_group_id = aws_security_group.vpc_link_sg.id
  cidr_blocks       = ["0.0.0.0/0"]
  description       = "Allow all outbound"
}

resource "aws_apigatewayv2_vpc_link" "alb_vpc_link" {
  name               = "${var.app_name}-${var.app_environment}-api-vpc-link"
  security_group_ids = [aws_security_group.vpc_link_sg.id]
  subnet_ids         = local.api_subnets

  tags = merge(
    var.additional_tags,
    {
      "Name"        = "${var.app_name}-${var.app_environment}-api-vpc-link",
      "Environment" = var.app_environment,
    }
  )

}


resource "aws_apigatewayv2_api" "http_api" {
  name          = "${var.app_name}-${var.app_environment}-api"
  protocol_type = "HTTP"
  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    allow_headers = ["*"]
    expose_headers = ["*"]
    max_age = 3600
  }
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http_api.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_apigatewayv2_integration" "alb_integration" {
  api_id           = aws_apigatewayv2_api.http_api.id
  description      = "Integration with internal ALB"
  integration_type = "HTTP_PROXY"
  integration_uri  = aws_lb_listener.alb_http_listener.arn

  integration_method = "ANY"
  connection_type    = "VPC_LINK"
  connection_id      = aws_apigatewayv2_vpc_link.alb_vpc_link.id

  # tls_config {
  #   server_name_to_verify = "example.com"
  # }

  request_parameters = {
    "append:header.authforintegration" = "$context.authorizer.authorizerResponse"
  }

  depends_on = [ aws_apigatewayv2_vpc_link.alb_vpc_link ]
}

resource "aws_apigatewayv2_authorizer" "jwt_authorizer" {
  name                       = "${var.app_name}-${var.app_environment}-jwt-authorizer"
  api_id                     = aws_apigatewayv2_api.http_api.id
  authorizer_type            = "JWT"
  identity_sources           = ["$request.header.Authorization"]

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.userpool_client.id]
    issuer   = "https://cognito-idp.${var.app_region}.amazonaws.com/${aws_cognito_user_pool.userpool.id}"
  }
}

resource "aws_apigatewayv2_route" "proxy_route" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "ANY /api/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.alb_integration.id}"

  authorizer_id       = aws_apigatewayv2_authorizer.jwt_authorizer.id
  authorization_type  = "JWT"
}

resource "aws_apigatewayv2_route" "apidocs_route" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "ANY /{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.alb_integration.id}"
}

resource "aws_apigatewayv2_route" "proxy_route_cors" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "OPTIONS /api/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.alb_integration.id}"
}