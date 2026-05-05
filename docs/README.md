# Docs

This folder contains documentation, deployment guides, public assets, and architecture diagrams for AccessCore.

## Start Here

- [Getting Started](./getting-started.md) - Local setup, configuration, and deployment basics

## Diagrams

Architecture and flow diagrams (Mermaid format, renderable on GitHub):

- [System Architecture](./diagrams/system-architecture.md) - High-level component diagram and responsibilities
- [Authentication & Authorization Flow](./diagrams/auth-flow.md) - Login flow, session lifecycle, RBAC matrix
- [Data Flow](./diagrams/data-flow.md) - User lifecycle, Google sync, certificate ops, CCD push
- [Network & Security Architecture](./diagrams/network-security.md) - Production network topology, security boundaries, threat model
- [API Routes Map](./diagrams/api-routes.md) - All API endpoints organized by access level
- [Database Schema](./diagrams/database-schema.md) - Entity relationship diagram for all Prisma models

## Guides

- [Getting Started](./getting-started.md) - Installation, local development, and cloud deployment
- [AWS Secure Deployment](./aws-secure-deployment.md) - Production architecture on AWS with ALB + Google OIDC authentication
- [Security Audit 2026-04-24](./security/security-audit-2026-04-24.md) - Security Ops audit findings, fixes, and verification checklist
- [Screenshots](./screenshots/README.md) - Screenshot library and UI assets used in documentation
