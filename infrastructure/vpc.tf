# Reference: https://spacelift.io/blog/terraform-aws-vpc
# https://www.youtube.com/watch?v=pvhdT6Z92QU
resource "aws_vpc" "main" {
  cidr_block = var.vpc_cidr

  tags = merge(
    var.additional_tags,
    {
      "Name"        = "${var.app_name}-${var.app_environment}-vpc",
      "Environment" = var.app_environment,
    }
  )
}

resource "aws_subnet" "public_subnets" {
  count             = length(var.public_subnet_cidrs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = element(var.public_subnet_cidrs, count.index)
  availability_zone = element(var.azs, count.index)

  tags = merge(
    var.additional_tags,
    {
      "Name"        = "${var.app_name}-${var.app_environment}-public-subnet-${count.index}",
      "Environment" = var.app_environment,
    }
  )
}

resource "aws_subnet" "private_subnets" {
  count             = length(var.private_subnet_cidrs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = element(var.private_subnet_cidrs, count.index)
  availability_zone = element(var.azs, count.index)

  tags = merge(
    var.additional_tags,
    {
      "Name"        = "${var.app_name}-${var.app_environment}-private-subnet-${count.index}",
      "Environment" = var.app_environment,
    }
  )
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id

  tags = merge(
    var.additional_tags,
    {
      "Name"        = "${var.app_name}-${var.app_environment}-igw",
      "Environment" = var.app_environment,
    }
  )
}

resource "aws_route_table" "public_subnets_rt" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }

  tags = merge(
    var.additional_tags,
    {
      "Name"        = "${var.app_name}-${var.app_environment}-public-subnets-rt",
      "Environment" = var.app_environment,
    }
  )
}

resource "aws_route_table_association" "public_subnet_asso" {
  count          = length(var.public_subnet_cidrs)
  subnet_id      = element(aws_subnet.public_subnets[*].id, count.index)
  route_table_id = aws_route_table.public_subnets_rt.id
}

resource "aws_eip" "nat_eips" {
  count  = length(var.public_subnet_cidrs)
  domain = "vpc"

  tags = {
    Name        = "${var.app_name}-${var.app_environment}-nat-eip-${count.index}",
    Environment = var.app_environment,
  }
}

resource "aws_nat_gateway" "nat_gws" {
  count         = length(var.public_subnet_cidrs)
  allocation_id = aws_eip.nat_eips[count.index].id
  subnet_id     = aws_subnet.public_subnets[count.index].id

  tags = {
    Name        = "${var.app_name}-${var.app_environment}-nat-gateway-${count.index}",
    Environment = var.app_environment,
  }

  depends_on = [aws_internet_gateway.igw]
}

resource "aws_route_table" "private_rts" {
  count  = length(var.private_subnet_cidrs)
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.nat_gws[count.index].id
  }

  tags = {
    Name        = "${var.app_name}-${var.app_environment}-private-rt-${count.index}",
    Environment = var.app_environment,
  }
}

resource "aws_route_table_association" "private_asso" {
  count          = length(var.private_subnet_cidrs)
  subnet_id      = aws_subnet.private_subnets[count.index].id
  route_table_id = aws_route_table.private_rts[count.index].id
}
