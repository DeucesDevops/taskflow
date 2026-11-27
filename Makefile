ENV ?= production

.PHONY: validate plan apply kubeconfig teardown

validate:
	./scripts/terraform-validate.sh

plan:
	./scripts/apply-environment.sh $(ENV) plan

apply:
	./scripts/apply-environment.sh $(ENV) apply

kubeconfig:
	./scripts/update-kubeconfig.sh $(ENV)

teardown:
	./scripts/teardown-environment.sh $(ENV)
