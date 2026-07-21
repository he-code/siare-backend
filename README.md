<div align="center">

# SIARE Backend

**Institutional Educational Resource Administration System**

API REST segura, modular y escalable para la gestión de inventario y actas administrativas.

[![CI](https://github.com/he-code/siare-backend/actions/workflows/ci.yml/badge.svg)](https://github.com/he-code/siare-backend/actions/workflows/ci.yml)
![Node](https://img.shields.io/badge/node-22%2B-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-6%2B-3178C6?logo=typescript&logoColor=white)
![Fastify](https://img.shields.io/badge/fastify-5-000000?logo=fastify&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/postgresql-17-4169E1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/docker-ready-2496ED?logo=docker&logoColor=white)
![OpenAPI](https://img.shields.io/badge/openapi-3.1-6BA539?logo=openapi-initiative&logoColor=white)

</div>

---

## 📋 Overview

SIARE digitaliza procesos administrativos educativos: control de materiales, movimientos de inventario, emisión de actas oficiales y generación de documentos PDF. Construido como una **API REST independiente del frontend**, prioriza **seguridad, integridad de datos y mantenibilidad**.

> Frontend: [siare-frontend](https://github.com/he-code/siare-frontend) | Demo: [siare-frontend.vercel.app](https://siare-frontend.vercel.app/)

---

## ✨ Key Features

| Feature | Details |
|---------|---------|
| **Auth & Sessions** | JWT access tokens + refresh tokens rotativos y revocables (SHA-256), contraseñas con Argon2id, cookies HttpOnly/SameSite/Secure |
| **RBAC** | 3 roles (`administrador`, `asistente_actas`, `consulta`) verificados por ruta |
| **Inventory Management** | Control de existencias con alertas de stock bajo, movimientos trazables |
| **Acts (Receipt/Delivery)** | Borradores, emisión con transacciones SERIALIZABLE, anulación con movimientos compensatorios |
| **PDF Generation** | Documentos oficiales formateados con PDFKit |
| **Audit Trail** | Bitácora de accesos y mutaciones sensibles |
| **API Documentation** | OpenAPI interactiva en `/docs` |

---

## 🏗 Architecture

```
src/
├── modules/
│   ├── auth/        🔐 Autenticación y sesiones
│   ├── users/       👥 Gestión de usuarios
│   ├── acts/        📄 Actas de ingreso y entrega
│   ├── inventory/   📦 Inventario y movimientos
│   └── catalogs/    📁 Categorías, unidades, instituciones
├── core/            ⚙️ Roles, paginación, errores
├── http/            🛡️ Guards, esquemas de validación
├── db/              🗄️ Conexión y tipos de base de datos
├── config/          🔧 Variables de entorno
└── app/             🚀 Bootstrap de Fastify
```

API REST desacoplada con módulos independientes por dominio. Base de datos como fuente de verdad con PostgreSQL relacional.

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js 22+ |
| **Language** | TypeScript (strict mode, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) |
| **Framework** | Fastify 5 |
| **Database** | PostgreSQL 17 + Kysely (query builder tipado) |
| **Validation** | TypeBox (schemas cerrados, `additionalProperties: false`) |
| **Auth** | @fastify/jwt, @fastify/cookie, Argon2id |
| **PDF** | PDFKit |
| **Testing** | Vitest |
| **Linting** | ESLint 10 + typescript-eslint |
| **Formatting** | Prettier |
| **Infra** | Docker, GitHub Actions CI |
| **Deploy** | Railway |

**CI Pipeline:** `format:check` → `typecheck` → `lint` → `test` → `build` → `audit`

---

## 🔐 Security Highlights

- **Passwords:** Argon2id — never logged or returned
- **Tokens:** Access (short-lived JWT) + Refresh (opaque, rotative, revocable, stored as SHA-256)
- **Cookies:** HttpOnly, SameSite=Strict, Secure in production
- **Rate Limiting:** Global (120 req/min) + stricter for login
- **CORS:** Whitelist-based
- **Input Validation:** Closed schemas prevent mass assignment
- **SQL Injection:** Prevented by Kysely parameterized queries
- **Error Handling:** Internal errors hidden from client; sensitive data redacted from logs
- **Database:** Foreign keys, CHECK constraints, unique indexes, transactions, SERIALIZABLE isolation for critical operations

---

## 📦 Getting Started

### Prerequisites

- Node.js 22+
- PostgreSQL 17 (or Docker)
- npm

### Quick Start

```bash
# Clone
git clone https://github.com/he-code/siare-backend.git
cd siare-backend

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your database credentials and secrets

# Start PostgreSQL (optional — Docker)
docker compose up -d

# Run migrations
npm run db:migrate

# Seed admin user
npm run db:seed

# Start development server
npm run dev
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript |
| `npm start` | Start production server |
| `npm run test` | Run tests |
| `npm run lint` | Lint codebase |
| `npm run format:check` | Check formatting |
| `npm run typecheck` | Type-check without emitting |
| `npm run check` | Full quality gate (typecheck + lint + test + build) |
| `npm run db:migrate` | Run database migrations |
| `npm run db:seed` | Seed admin user |

---

## 🐳 Docker

```bash
docker compose up -d    # Start PostgreSQL
docker build -t siare-backend . && docker run -p 3000:3000 siare-backend
```

---

## 📄 API Documentation

Interactive OpenAPI docs available at:

- **Production:** [siare-backend-production.up.railway.app/docs](https://siare-backend-production.up.railway.app/docs)
- **Local:** `http://localhost:3000/docs`

### API Modules

- `POST /api/v1/auth/login` — Login with email & password
- `POST /api/v1/auth/refresh` — Rotate refresh token
- `POST /api/v1/auth/logout` — Revoke refresh token
- `GET  /api/v1/auth/me` — Current user profile
- `CRUD /api/v1/users` — User management (admin only)
- `CRUD /api/v1/instituciones` — Institutions
- `CRUD /api/v1/lideres` — Leaders
- `CRUD /api/v1/materiales` — Materials
- `POST /api/v1/actas-ingreso/:id/emitir` — Issue receipt act
- `POST /api/v1/actas-entrega/:id/emitir` — Issue delivery act
- `GET  /api/v1/inventario/existencias` — Current stock
- `GET  /api/v1/inventario/alertas-bajo-stock` — Low stock alerts

---

## 🧪 Testing

```bash
npm run test
```

Covers PDF generation, PDF format validation, page count verification, and critical service logic.

---

## 🚀 Deployment

| Service | Platform | URL |
|---------|----------|-----|
| Backend | Railway | [siare-backend-production.up.railway.app](https://siare-backend-production.up.railway.app/docs) |
| Frontend | Vercel | [siare-frontend.vercel.app](https://siare-frontend.vercel.app/) |

---

## 🗺 Roadmap

- [ ] Increase test coverage
- [ ] Monitoring & metrics
- [ ] New administrative modules
- [ ] Performance optimization for large datasets

---

<div align="center">
  Built with ❤️ for educational administration
</div>
