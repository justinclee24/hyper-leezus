variable "name" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "cluster_role_arn" {
  type    = string
  default = "arn:aws:iam::123456789012:role/eks-cluster-role"
}
