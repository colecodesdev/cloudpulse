locals {
  name = "${var.project_name}-${var.env}"
  tags = {
    Project     = var.project_name
    Environment = var.env
  }

  ecr_base       = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com"
  backend_image  = "${local.ecr_base}/cloudpulse-backend:${var.backend_image_tag}"
  frontend_image  = "${local.ecr_base}/cloudpulse-frontend:frontend-nginx-proxy-v2"
}

resource "aws_cloudwatch_log_group" "frontend" {
  name              = "/ecs/${local.name}/frontend"
  retention_in_days = var.log_retention_days
  tags              = local.tags
}

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${local.name}/backend"
  retention_in_days = var.log_retention_days
  tags              = local.tags
}

resource "aws_cloudwatch_log_group" "postgres" {
  name              = "/ecs/${local.name}/postgres"
  retention_in_days = var.log_retention_days
  tags              = local.tags
}

resource "aws_vpc" "main" {
  cidr_block           = "10.20.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags                 = merge(local.tags, { Name = "${local.name}-vpc" })
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id
  tags   = merge(local.tags, { Name = "${local.name}-igw" })
}

resource "aws_subnet" "public_a" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.20.1.0/24"
  availability_zone       = "us-east-1a"
  map_public_ip_on_launch = true
  tags                    = merge(local.tags, { Name = "${local.name}-public-a" })
}

resource "aws_subnet" "public_b" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.20.2.0/24"
  availability_zone       = "us-east-1b"
  map_public_ip_on_launch = true
  tags                    = merge(local.tags, { Name = "${local.name}-public-b" })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  tags   = merge(local.tags, { Name = "${local.name}-public-rt" })
}

resource "aws_route" "public_default" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.igw.id
}

resource "aws_route_table_association" "public_a" {
  subnet_id      = aws_subnet.public_a.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_b" {
  subnet_id      = aws_subnet.public_b.id
  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "ecs_instance" {
  name        = "${local.name}-ecs-instance-sg"
  description = "ECS instance security group"
  vpc_id      = aws_vpc.main.id
  tags        = merge(local.tags, { Name = "${local.name}-ecs-instance-sg" })
}

resource "aws_vpc_security_group_egress_rule" "ecs_all_out" {
  security_group_id = aws_security_group.ecs_instance.id
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_ingress_rule" "frontend_in" {
  security_group_id = aws_security_group.ecs_instance.id
  ip_protocol       = "tcp"
  from_port         = var.frontend_port
  to_port           = var.frontend_port
  cidr_ipv4         = "0.0.0.0/0"
}

data "aws_iam_policy_document" "ecs_instance_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_instance" {
  name               = "${local.name}-ecs-instance-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_instance_assume.json
  tags               = local.tags
}

resource "aws_iam_role_policy_attachment" "ecs_instance_ecs" {
  role       = aws_iam_role.ecs_instance.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
}

resource "aws_iam_role_policy_attachment" "ecs_instance_ssm" {
  role       = aws_iam_role.ecs_instance.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "ecs_instance" {
  name = "${local.name}-ecs-instance-profile"
  role = aws_iam_role.ecs_instance.name
}

data "aws_iam_policy_document" "task_execution_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "task_execution" {
  name               = "${local.name}-task-exec-role"
  assume_role_policy = data.aws_iam_policy_document.task_execution_assume.json
  tags               = local.tags
}

resource "aws_iam_role_policy_attachment" "task_execution_policy" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_ecs_cluster" "main" {
  name = "${local.name}-cluster"
  tags = local.tags
}

data "aws_ssm_parameter" "ecs_ami" {
  name = "/aws/service/ecs/optimized-ami/amazon-linux-2/recommended/image_id"
}

resource "aws_launch_template" "ecs" {
  name_prefix   = "${local.name}-lt-"
  image_id      = data.aws_ssm_parameter.ecs_ami.value
  instance_type = var.instance_type

  iam_instance_profile {
    name = aws_iam_instance_profile.ecs_instance.name
  }

  network_interfaces {
    device_index                = 0
    security_groups             = [aws_security_group.ecs_instance.id]
    associate_public_ip_address = true
  }

  user_data = base64encode(templatefile("${path.module}/user_data.sh.tftpl", {
    cluster_name = aws_ecs_cluster.main.name
  }))

  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      volume_size = 30
      volume_type = "gp3"
    }
  }

  tag_specifications {
    resource_type = "instance"
    tags          = merge(local.tags, { Name = "${local.name}-ecs" })
  }

  tag_specifications {
    resource_type = "volume"
    tags          = merge(local.tags, { Name = "${local.name}-ecs-root" })
  }

  tags = local.tags
}

resource "aws_autoscaling_group" "ecs" {
  name                = "${local.name}-asg"
  min_size            = 1
  max_size            = 1
  desired_capacity    = 1
  vpc_zone_identifier = [aws_subnet.public_a.id, aws_subnet.public_b.id]

  launch_template {
    id      = aws_launch_template.ecs.id
    version = "$Latest"
  }

  tag {
    key                 = "Name"
    value               = "${local.name}-ecs"
    propagate_at_launch = true
  }

  dynamic "tag" {
    for_each = local.tags
    content {
      key                 = tag.key
      value               = tag.value
      propagate_at_launch = true
    }
  }
}

resource "aws_ecs_capacity_provider" "asg" {
  name = "${local.name}-cp"
  auto_scaling_group_provider {
    auto_scaling_group_arn         = aws_autoscaling_group.ecs.arn
    managed_termination_protection = "DISABLED"
    managed_scaling {
      status                    = "DISABLED"
      target_capacity           = 100
      minimum_scaling_step_size = 1
      maximum_scaling_step_size = 1
    }
  }
  tags = local.tags
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = [aws_ecs_capacity_provider.asg.name]
  default_capacity_provider_strategy {
    capacity_provider = aws_ecs_capacity_provider.asg.name
    weight            = 1
    base              = 1
  }
}

resource "aws_budgets_budget" "monthly" {
  name         = "${local.name}-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.budget_email]
  }
}

output "account_id" {
  value = data.aws_caller_identity.current.account_id
}

output "region" {
  value = data.aws_region.current.name
}

resource "aws_ecs_task_definition" "app" {
  family                   = "${local.name}-app"
  requires_compatibilities = ["EC2"]
  network_mode             = "host"
  cpu                      = "256"
  memory                   = "896"
  execution_role_arn       = aws_iam_role.task_execution.arn
  tags                     = local.tags

  container_definitions = jsonencode([
    {
      name      = "postgres"
      image     = var.postgres_image
      essential = true
      portMappings = [
        { containerPort = 5432, hostPort = 5432, protocol = "tcp" }
      ]
      environment = [
        { name = "POSTGRES_DB", value = var.postgres_db },
        { name = "POSTGRES_USER", value = var.postgres_user },
        { name = "POSTGRES_PASSWORD", value = var.postgres_password }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-region        = data.aws_region.current.name
          awslogs-group         = aws_cloudwatch_log_group.postgres.name
          awslogs-stream-prefix = "ecs"
        }
      }
      mountPoints = [
        { sourceVolume = "pgdata", containerPath = "/var/lib/postgresql/data", readOnly = false }
      ]
      healthCheck = {
        command     = ["CMD-SHELL", "pg_isready -U ${var.postgres_user} -d ${var.postgres_db}"]
        interval    = 10
        timeout     = 5
        retries     = 10
        startPeriod = 20
      }
    },
    {
      name      = "backend"
      image     = local.backend_image
      essential = true
      portMappings = [
        { containerPort = var.backend_port, hostPort = var.backend_port, protocol = "tcp" }
      ]
      environment = [
        { name = "SPRING_DATASOURCE_URL", value = "jdbc:postgresql://127.0.0.1:5432/${var.postgres_db}" },
        { name = "SPRING_DATASOURCE_USERNAME", value = var.postgres_user },
        { name = "SPRING_DATASOURCE_PASSWORD", value = var.postgres_password }
      ]
      dependsOn = [
        { containerName = "postgres", condition = "HEALTHY" }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-region        = data.aws_region.current.name
          awslogs-group         = aws_cloudwatch_log_group.backend.name
          awslogs-stream-prefix = "ecs"
        }
      }
    },
    {
      name      = "frontend"
      image     = local.frontend_image
      essential = true
      portMappings = [
        { containerPort = var.frontend_port, hostPort = var.frontend_port, protocol = "tcp" }
      ]
      dependsOn = [
        { containerName = "backend", condition = "START" }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-region        = data.aws_region.current.name
          awslogs-group         = aws_cloudwatch_log_group.frontend.name
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])

  volume {
    name      = "pgdata"
    host_path = "/opt/cloudpulse/pgdata"
  }
}

resource "aws_ecs_service" "app" {
  name            = "${local.name}-app"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 1
  launch_type     = "EC2"
  tags            = local.tags
  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100
  availability_zone_rebalancing = "DISABLED"
}