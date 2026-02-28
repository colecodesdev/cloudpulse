terraform {
  backend "s3" {
    bucket         = "cloudpulse-tfstate-413576439231-us-east-1"
    key            = "app/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "cloudpulse-tfstate-lock-us-east-1"
    encrypt        = true
  }
}