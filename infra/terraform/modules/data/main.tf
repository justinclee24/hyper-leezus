resource "aws_s3_bucket" "data_lake" {
  bucket = "${var.name}-data-lake"
}

resource "aws_db_subnet_group" "db" {
  name       = "${var.name}-db-subnets"
  subnet_ids = var.private_subnet_ids
}

resource "aws_db_instance" "postgres" {
  identifier           = "${var.name}-postgres"
  engine               = "postgres"
  instance_class       = "db.t4g.medium"
  allocated_storage    = 100
  username             = "postgres"
  password             = "change-me-in-secrets"
  db_name              = "hyper_leezus"
  skip_final_snapshot  = true
  db_subnet_group_name = aws_db_subnet_group.db.name
  publicly_accessible  = false
  deletion_protection  = false
}
