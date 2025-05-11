#-------------------------------------------------------------
# ECS Cluster
#-------------------------------------------------------------
resource "aws_ecs_cluster" "app_cluster" {
  name = "${var.app_name}-${var.app_environment}-ecs-cluster"

  tags = merge(
    var.additional_tags,
    {
      Name        = "${var.app_name}-${var.app_environment}-ecs-cluster"
      Environment = var.app_environment
    }
  )
}

# Security group for ECS
resource "aws_security_group" "ecs_sg" {
  name        = "${var.app_name}-${var.app_environment}-asg-sg"
  description = "Security group for ECS tasks"
  vpc_id      = aws_vpc.main.id

  tags = merge(
    var.additional_tags,
    {
      Name        = "${var.app_name}-${var.app_environment}-asg-sg"
      Environment = var.app_environment
    }
  )
}

# Allow all outbound
resource "aws_security_group_rule" "asg_allow_all_outbound" {
  type              = "egress"
  protocol          = "-1"
  from_port         = 0
  to_port           = 0
  security_group_id = aws_security_group.ecs_sg.id
  cidr_blocks       = ["0.0.0.0/0"]
  description       = "Allow all outbound"
}

# Allow HTTP from internal load balancer
resource "aws_security_group_rule" "allow_http_from_lb" {
  type                     = "ingress"
  protocol                 = "tcp"
  from_port                = 8080
  to_port                  = 8080
  security_group_id        = aws_security_group.ecs_sg.id
  source_security_group_id = aws_security_group.alb_sg.id
  description              = "Allow HTTP from internal load balancer"
}

#-------------------------------------------------------------
# IAM Role for Fargate Tasks
#-------------------------------------------------------------
resource "aws_iam_role" "asg_instance_role" {
  name = "${var.app_name}-${var.app_environment}-asg-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = {
    Name = "${var.app_name}-${var.app_environment}-asg-role"
  }
}

resource "aws_iam_role_policy_attachment" "attach_s3_policy" {
  role       = aws_iam_role.asg_instance_role.name
  policy_arn = aws_iam_policy.s3_full_access_policy.arn
}

resource "aws_iam_role_policy_attachment" "attach_comprehend_readonly" {
  role       = aws_iam_role.asg_instance_role.name
  policy_arn = "arn:aws:iam::aws:policy/ComprehendFullAccess"
}

resource "aws_iam_role_policy_attachment" "attach_rekognition_policy" {
  role       = aws_iam_role.asg_instance_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonRekognitionFullAccess"
}

resource "aws_iam_role_policy_attachment" "ecs_cloudwatch_logging" {
  role       = aws_iam_role.asg_instance_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

#-------------------------------------------------------------
# CloudWatch Log Group
#-------------------------------------------------------------
resource "aws_cloudwatch_log_group" "ecs_app_log_group" {
  name              = "/ecs/${var.app_name}-${var.app_environment}"
  retention_in_days = 1

  tags = {
    Name        = "${var.app_name}-${var.app_environment}-log-group"
    Environment = var.app_environment
  }
}

#-------------------------------------------------------------
# ECS Task Definition
#-------------------------------------------------------------
resource "aws_ecs_task_definition" "app_task" {
  family                   = "${var.app_name}-${var.app_environment}-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.asg_instance_role.arn
  task_role_arn            = aws_iam_role.asg_instance_role.arn

  container_definitions = jsonencode([
    {
      name      = "app-container"
      image     = var.api_container_image
      essential = true
      portMappings = [{
        containerPort = 8080
        hostPort      = 8080
      }]
      environment = [
        { name = "AWS_REGION", value = var.app_region },
        { name = "AWS_DEFAULT_REGION", value = var.app_region },
        { name = "FLASK_PORT", value = "8080" },
        { name = "MONGO_HOST", value = aws_docdb_cluster.db_cluster.endpoint },
        { name = "MONGO_PORT", value = "27017" },
        { name = "MONGO_DB", value = var.app_name },
        { name = "MONGO_USERNAME", value = var.db_username },
        { name = "MONGO_PASSWORD", value = var.db_password },
        { name = "MONGO_USE_TLS", value = "true" },
        { name = "MONGO_CA_FILE", value = "global-bundle.pem" },
        { name = "MONGO_MIN_POOL_SIZE", value = "5" },
        { name = "MONGO_MAX_POOL_SIZE", value = "50" },
        { name = "COGNITO_POOL_ID", value = aws_cognito_user_pool.userpool.id },
        { name = "COGNITO_REGION", value = var.app_region },
        { name = "COGNITO_APP_CLIENT_ID", value = aws_cognito_user_pool_client.userpool_client.id },
        { name = "S3_BUCKET_NAME", value = aws_s3_bucket.images_bucket.bucket },
        { name = "CLOUDFRONT_URL", value = "https://${aws_cloudfront_distribution.s3_distribution.domain_name}/" },
        { name = "CLOUDFRONT_KEY_PAIR_ID", value = aws_cloudfront_public_key.signing_key.id },
        { name = "CLOUDFRONT_PRIVATE_KEY_PATH", value = "private_key.pem" },
        { name = "EMBEDDINGS_PROVIDER", value = var.embeddings_provider },
        { name = "EMBEDDINGS_API_KEY", value = var.embeddings_api_key },
        { name = "PRIVATE_KEY_DATA", value = tls_private_key.cloudfront_signing_key.private_key_pem },
        { name = "SCORE_THRESHOLD", value = "0.8" },
        { name = "TOP_K", value = "5" },
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = "/ecs/${var.app_name}-${var.app_environment}"
          awslogs-region        = var.app_region
          awslogs-stream-prefix = "ecs"
        }
      }
      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 10
      }
    }
  ])

  tags = merge(
    var.additional_tags,
    {
      Name        = "${var.app_name}-${var.app_environment}-task"
      Environment = var.app_environment
    }
  )

  depends_on = [aws_cloudwatch_log_group.ecs_app_log_group]
}

#-------------------------------------------------------------
# Application Load Balancer Target Group
#-------------------------------------------------------------
resource "aws_lb_target_group" "app_tg" {
  name        = "${var.app_name}-${var.app_environment}-tg"
  port        = 8080
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.main.id

  health_check {
    path                = var.health_check_path
    interval            = 30
    timeout             = 10
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200"
  }

  tags = {
    Name        = "${var.app_name}-${var.app_environment}-tg"
    Environment = var.app_environment
  }
}

#-------------------------------------------------------------
# ECS Service
#-------------------------------------------------------------
resource "aws_ecs_service" "app_service" {
  name            = "${var.app_name}-${var.app_environment}-service"
  cluster         = aws_ecs_cluster.app_cluster.id
  task_definition = aws_ecs_task_definition.app_task.arn
  launch_type     = "FARGATE"
  desired_count   = 1

  enable_execute_command = true


  network_configuration {
    subnets          = aws_subnet.private_subnets[*].id
    assign_public_ip = false
    security_groups  = [aws_security_group.ecs_sg.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app_tg.arn
    container_name   = "app-container"
    container_port   = 8080
  }

  depends_on = [
    aws_iam_role.asg_instance_role,
  ]

  tags = merge(
    var.additional_tags,
    {
      Name        = "${var.app_name}-${var.app_environment}-service"
      Environment = var.app_environment
    }
  )
}

#-------------------------------------------------------------
# 1) Define AppAutoScaling Target for your ECS Service
#-------------------------------------------------------------
resource "aws_appautoscaling_target" "ecs_service" {
  service_namespace  = "ecs"
  scalable_dimension = "ecs:service:DesiredCount"
  resource_id        = "service/${aws_ecs_cluster.app_cluster.name}/${aws_ecs_service.app_service.name}"

  # scale between 1 and 4 tasks
  min_capacity = 1
  max_capacity = 4
}

#-------------------------------------------------------------
# 2) CPU‑based Target Tracking Scaling Policy
#-------------------------------------------------------------
resource "aws_appautoscaling_policy" "cpu_target_tracking" {
  name               = "${var.app_name}-${var.app_environment}-cpu-autoscale"
  service_namespace  = aws_appautoscaling_target.ecs_service.service_namespace
  resource_id        = aws_appautoscaling_target.ecs_service.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs_service.scalable_dimension
  policy_type        = "TargetTrackingScaling"

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 300
  }
}

resource "aws_appautoscaling_policy" "memory_target_tracking" {
  name               = "${var.app_name}-${var.app_environment}-memory-autoscale"
  service_namespace  = aws_appautoscaling_target.ecs_service.service_namespace
  resource_id        = aws_appautoscaling_target.ecs_service.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs_service.scalable_dimension
  policy_type        = "TargetTrackingScaling"

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    # aim to keep average memory ~75% across tasks
    target_value       = 75.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 300
  }
}
