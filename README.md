<div align="center">

# SIARE Backend

**Institutional Educational Resource Administration System**

API REST segura, modular y escalable para gestion de inventario y actas administrativas.

[![CI](https://github.com/he-code/siare-backend/actions/workflows/ci.yml/badge.svg)](https://github.com/he-code/siare-backend/actions/workflows/ci.yml)
![Node](https://img.shields.io/badge/node-22%2B-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-6%2B-3178C6?logo=typescript&logoColor=white)
![Fastify](https://img.shields.io/badge/fastify-5-000000?logo=fastify&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/postgresql-17-4169E1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/docker-ready-2496ED?logo=docker&logoColor=white)
![OpenAPI](https://img.shields.io/badge/openapi-3.1-6BA539?logo=openapi-initiative&logoColor=white)

</div>

## Overview

SIARE digitaliza procesos administrativos educativos: control de materiales, movimientos de inventario, emision de actas oficiales y generacion de PDF. API REST independiente del frontend, prioriza seguridad, integridad de datos y mantenibilidad.

> Frontend: [siare-frontend](https://github.com/he-code/siare-frontend) | Demo: [siare-frontend.vercel.app](https://siare-frontend.vercel.app/)

## Key Features

- **Auth & Sessions** — JWT + refresh tokens rotativos y revocables (SHA-256), Argon2id, cookies HttpOnly/SameSite/Secure
- **RBAC** — 3 roles (`administrador`, `asistente_actas`, `consulta`) verificados por ruta
- **Inventory Management** — Control de existencias, alertas de stock bajo, movimientos trazables
- **Acts (Receipt/Delivery)** — Borradores, emision con transacciones SERIALIZABLE, anulacion con movimientos compensatorios
- **PDF Generation** — Documentos oficiales con PDFKit
- **Audit Trail** — Bitacora de accesos y mutaciones sensibles
- **API Documentation** — OpenAPI interactiva en `/docs`

## Architecture

```
src/
├── modules/
│   ├── auth/        Autenticacion y sesiones
│   ├── users/       Gestion de usuarios
│   ├── acts/        Actas de ingreso y entrega
│   ├── inventory/   Inventario y movimientos
│   └── catalogs/    Categorias, unidades, instituciones
├── core/            Roles, paginacion, errores
├── http/            Guards, esquemas de validacion
├── db/              Conexion y tipos de base de datos
├── config/          Variables de entorno
└── app/             Bootstrap de Fastify
```

API REST desacoplada con modulos independientes por dominio. Base de datos como fuente de verdad con PostgreSQL relacional.

## Tech Stack

| Layer          | Technology                                                                         |
| -------------- | ---------------------------------------------------------------------------------- |
| **Runtime**    | Node.js 22+                                                                        |
| **Language**   | TypeScript (strict mode, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) |
| **Framework**  | Fastify 5                                                                          |
| **Database**   | PostgreSQL 17 + Kysely (query builder tipado)                                      |
| **Validation** | TypeBox (schemas cerrados, `additionalProperties: false`)                          |
| **Auth**       | @fastify/jwt, @fastify/cookie, Argon2id                                            |
| **PDF**        | PDFKit                                                                             |
| **Testing**    | Vitest                                                                             |
| **Linting**    | ESLint 10 + typescript-eslint                                                      |
| **Formatting** | Prettier                                                                           |
| **Infra**      | Docker, GitHub Actions CI                                                          |
| **Deploy**     | Railway                                                                            |

**CI Pipeline:** `format:check` -> `typecheck` -> `lint` -> `test` -> `build` -> `audit`

## Security

- Passwords hashed with Argon2id — never logged or returned
- Access JWT (short-lived) + opaque refresh tokens (rotative, revocable, SHA-256 stored)
- HttpOnly, SameSite=Strict cookies; Secure in production
- Rate limiting global (120 req/min) + stricter for login
- CORS whitelist-based; closed validation schemas prevent mass assignment
- SQL injection prevented by Kysely parameterized queries
- Internal errors hidden from client; sensitive data redacted from logs
- SERIALIZABLE isolation for critical inventory operations

## Getting Started

### Prerequisites

- Node.js 22+, PostgreSQL 17 (or Docker), npm

### Quick Start

```bash
git clone https://github.com/he-code/siare-backend.git
cd siare-backend
npm install
cp .env.example .env
# Edit .env with your database credentials
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

### Available Scripts

| Script                 | Description                                         |
| ---------------------- | --------------------------------------------------- |
| `npm run dev`          | Start dev server with hot reload                    |
| `npm run build`        | Compile TypeScript                                  |
| `npm start`            | Start production server                             |
| `npm run test`         | Run tests                                           |
| `npm run lint`         | Lint codebase                                       |
| `npm run format:check` | Check formatting                                    |
| `npm run typecheck`    | Type-check without emitting                         |
| `npm run check`        | Full quality gate (typecheck + lint + test + build) |
| `npm run db:migrate`   | Run database migrations                             |
| `npm run db:seed`      | Seed admin user                                     |

## API Documentation

Interactive OpenAPI docs at `/docs`:

- **Production:** [siare-backend-production.up.railway.app/docs](https://siare-backend-production.up.railway.app/docs)
- **Local:** `http://localhost:3000/docs`

## Deployment

| Service  | Platform | URL                                                                                             |
| -------- | -------- | ----------------------------------------------------------------------------------------------- |
| Backend  | Railway  | [siare-backend-production.up.railway.app](https://siare-backend-production.up.railway.app/docs) |
| Frontend | Vercel   | [siare-frontend.vercel.app](https://siare-frontend.vercel.app/)                                 |
