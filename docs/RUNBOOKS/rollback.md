# Rollback

Argo CD tracks git. To roll the application back, revert the image tags in `helm/taskflow/values-production.yaml` and push to `dev`. Argo CD self-heals to that commit.

```sh
git revert <tag-bump-commit>
git push origin dev
```

Do not `kubectl set image` on a deployment Argo CD owns. The next sync will put the git tag back.

Platform chart upgrades are Terraform Helm releases. Roll a chart back by setting the chart version variable and running apply again. Take a Postgres backup before a Flexible Server version change.
