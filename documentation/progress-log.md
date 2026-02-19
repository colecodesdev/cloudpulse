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