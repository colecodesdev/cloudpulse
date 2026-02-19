# CloudPulse Progress Log

## Day 1
- Repo created
- Folder structure created
- README created

## Day 2
- Created Spring Boot backend scaffold
- Added /api/health endpoint
- Created React + TypeScript frontend scaffold using Vite
- Connected frontend to backend health endpoint
- Resolved CORS configuration

- Added PostgreSQL via Docker Compose
- Configured Spring Boot datasource for Postgres
- Implemented ServiceInstance entity + repository
- Added GET /api/services and POST /api/services
- Verified persistence via curl

- Implemented frontend services list using GET /api/services
- Added create service form that POSTs to /api/services
- Verified persistence by refreshing and confirming DB-backed results

- Added frontend env-based API configuration using VITE_API_BASE_URL
- Centralized API calls and shared types into src/api.ts
- Refactored App.tsx to use API module for GET/POST services

- Dockerized backend with multi-stage Dockerfile
- Dockerized frontend with Nginx serving production build
- Updated docker-compose.yml to run db + backend + frontend together
- Implemented env-driven backend datasource configuration
- Implemented centralized configurable CORS configuration
- Verified full stack runs locally via Docker Compose
- Verified persistence through UI and DB

- Added GitHub Actions CI workflow
- Workflow builds backend (Maven) and frontend (Vite)
- Verified CI runs successfully on push

- Updated GitHub Actions CI to build backend Docker image
- Updated GitHub Actions CI to build frontend Docker image
- Verified Docker builds succeed in CI