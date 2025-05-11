# generate random id for application deployment
resource "random_id" "app_id" {
  byte_length = 2
}
