resource "aws_eks_cluster" "this" {
  name     = var.name
  role_arn = var.cluster_role_arn
  version  = "1.31"

  vpc_config {
    subnet_ids = var.private_subnet_ids
  }
}
