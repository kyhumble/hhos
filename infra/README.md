# Infrastructure

Terraform stubs for AWS HIPAA-eligible deployment.

**Do not deploy production with real ePHI until:**

1. AWS BAA is executed  
2. Security review complete  
3. `AUTH_PROVIDER=cognito` (or equivalent)  
4. Compliance checklist signed  

## Planned modules (later)

- VPC (private subnets, no public RDS)  
- RDS PostgreSQL encrypted  
- S3 + KMS (block public access)  
- ECS Fargate for API  
- Cognito user pool  
- CloudWatch (PHI-scrubbed logs)  
- Secrets Manager  
