variable "TAG" {
  default = "latest"
}

group "default" {
  targets = ["all"]
}

# Single image: Express API + built SPA. Pushed to Docker Hub as l7rith.
target "all" {
  context    = "."
  dockerfile = "Dockerfile"
  tags = [
    "deidinedocker/l7rith:latest",
    "deidinedocker/l7rith:${TAG}",
  ]
}
