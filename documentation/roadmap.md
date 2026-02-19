# CloudPulse Roadmap

## MVP (Local Full Stack Running)
- [x] Spring Boot backend created
- [x] React frontend created
- [x] PostgreSQL running in Docker Compose
- [x] Backend connects to DB
- [x] API returns list of services
- [x] Frontend displays services
- [x] Frontend can create services
- [x] Frontend uses env-based API base URL
- [x] API calls centralized in frontend API module
- [x] Backend Dockerfile created
- [x] Frontend Dockerfile created
- [x] Full stack runs via Docker Compose (db + backend + frontend)
- [x] Backend CORS is env configurable

## Phase 2 (AWS + Terraform)
- [ ] Terraform VPC setup
- [ ] ECS cluster setup
- [ ] Deploy sample service
- [ ] CloudWatch logging enabled

## Phase 3 (Monitoring Dashboard)
- [ ] Service health checks
- [ ] Logs view
- [ ] Metrics view

## Phase 4 (CI/CD)
- [x] GitHub Actions build/test
- [x] CI builds Docker images
- [x] CI pushes Docker images to ECR
- [ ] GitHub Actions deploy
