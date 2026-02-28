variable "project_name" {
  type    = string
  default = "cloudpulse"
}

variable "env" {
  type    = string
  default = "dev"
}

variable "instance_type" {
  type    = string
  default = "t3.micro"
}

variable "monthly_budget_usd" {
  type    = number
  default = 15
}

variable "budget_email" {
  type    = string
  default = "coltonmreilly@gmail.com"
}

variable "postgres_db" {
  type    = string
  default = "cloudpulse"
}

variable "postgres_user" {
  type    = string
  default = "cloudpulse"
}

variable "postgres_password" {
  type      = string
  sensitive = true
}

variable "backend_port" {
  type    = number
  default = 8080
}

variable "frontend_port" {
  type    = number
  default = 80
}

variable "frontend_image_tag" {
  type    = string
  default = "latest"
}

variable "backend_image_tag" {
  type    = string
  default = "latest"
}

variable "postgres_image" {
  type    = string
  default = "postgres:16"
}

variable "log_retention_days" {
  type    = number
  default = 3
}