terraform {
  required_version = ">= 1.7.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.80"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

module "network" {
  source     = "../../modules/network"
  name       = "hyper-leezus-dev"
  aws_region = var.aws_region
}

module "data" {
  source             = "../../modules/data"
  name               = "hyper-leezus-dev"
  private_subnet_ids = module.network.private_subnet_ids
}

module "eks" {
  source             = "../../modules/eks"
  name               = "hyper-leezus-dev"
  private_subnet_ids = module.network.private_subnet_ids
}
