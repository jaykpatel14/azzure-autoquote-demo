# Phase 5 — AWS Production Prompt

Prepare and deploy the application to AWS without affecting existing workloads.

Target MVP architecture:
- separate EC2 instance;
- Dockerized Next.js application;
- private RDS PostgreSQL;
- private S3 bucket;
- ECR;
- Nginx;
- Cloudflare or Route 53;
- HTTPS;
- Systems Manager Parameter Store or Secrets Manager;
- CloudWatch;
- GitHub Actions.

Tasks:
1. Create infrastructure-as-code using Terraform.
2. Use separate naming, security groups, IAM roles, buckets, repositories, and databases.
3. RDS must not be publicly accessible.
4. EC2 should use an IAM role, not static AWS keys.
5. S3 files must be private and accessed with short-lived presigned URLs.
6. Create least-privilege IAM policies.
7. Configure health checks, log rotation, backups, alarms, and budget alerts.
8. Add a GitHub Actions pipeline:
   - test;
   - lint;
   - typecheck;
   - build;
   - build Docker image;
   - scan image;
   - push ECR;
   - deploy;
   - run migrations safely;
   - verify health;
   - rollback on failure.
9. Document DNS and TLS configuration.
10. Document backup restoration and rollback.
11. Do not change or reuse resources belonging to another website.

Return a full deployment runbook and exact verification commands.
