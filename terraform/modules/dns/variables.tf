variable "zone_name" {
  type        = string
  description = "Public DNS zone. Pass the real domain at apply time. example.com is an example only."
}

variable "resource_group_name" {
  type        = string
  description = "Resource group for the DNS zone."
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to the zone."
  default     = {}
}
