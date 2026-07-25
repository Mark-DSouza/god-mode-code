# Provider configuration.

provider "aws" {
  region = var.region

  # Every resource carries these. The budget action that halts compute selects
  # instances by id, but the tags are how spend is attributed and how anything
  # created here is recognisable as belonging to this project.
  default_tags {
    tags = {
      Project     = "god-mode-code"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
