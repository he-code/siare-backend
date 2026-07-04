# SIARE Backend

API REST de **SIARE - Sistema de Inventario y Actas de Recepción y Entrega**, construida con Node.js, TypeScript, Fastify y PostgreSQL.

Este backend expone la lógica de negocio para inventario institucional, actas documentales, catálogos administrativos, usuarios, roles, autenticación y generación de PDF. La API ya está desplegada en Railway y puede ser consumida por el frontend Vue de [siare-frontend](https://github.com/he-code/siare-frontend).

## Enlaces

| Recurso | URL |
|---|---|
| Repositorio backend | https://github.com/he-code/siare-backend |
| Repositorio frontend | https://github.com/he-code/siare-frontend |
| API desplegada | https://siare-backend-production.up.railway.app |
| Health check | https://siare-backend-production.up.railway.app/health |
| OpenAPI / Swagger | https://siare-backend-production.up.railway.app/docs |

## Alcance

- Autenticación con access token, refresh token en cookie `HttpOnly` y roles `administrador`, `asistente_actas` y `consulta`.
- Usuarios, autoridades distritales, instituciones, líderes, categorías, unidades de medida, materiales y procesos de adquisición.
- Actas de ingreso y actas de entrega-recepción con ciclo `borrador -> emitida -> anulada`.
- Numeración anual e independiente: `MINEDUC-CZ5-UDA-{ING|ENT}-001-2026`.
- Inventario transaccional con existencias, alertas de bajo stock e historial inmutable.
- Bloqueo de ajustes manuales de stock por seguridad.
- Cálculo decimal de subtotal, IVA y total por línea.
- PDF institucional generado en memoria para actas emitidas.
- OpenAPI interactivo en `/docs`.

## Tecnologías

- Node.js 22+
- TypeScript estricto
- Fastify
- PostgreSQL
- Kysely
- Docker
- Vitest
- ESLint y Prettier
- PDFKit

## Arquitectura

```txt
src/
|-- config/          # Configuración validada por entorno
|-- core/            # Errores, roles y utilidades puras
|-- db/              # Conexión y tipos de PostgreSQL
|-- http/            # Validación y controles HTTP
`-- modules/
    |-- auth/
    |-- users/
    |-- catalogs/
    |-- acts/
    `-- inventory/
```

La explicación de decisiones y transacciones está en [docs/architecture.md](docs/architecture.md). La cobertura del documento funcional está en [docs/requirements-traceability.md](docs/requirements-traceability.md).

## Inicio local

Requisitos:

- Node.js 22 o superior
- Docker
- npm

```bash
git clone https://github.com/he-code/siare-backend.git
cd siare-backend
cp .env.example .env
docker compose up -d postgres
npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

Antes de ejecutar `db:seed`, cambiar `ADMIN_PASSWORD` en `.env`. La API local queda en:

```txt
http://localhost:3000
```

Rutas útiles:

```txt
http://localhost:3000/health
http://localhost:3000/docs
http://localhost:3000/api/v1
```

## Variables de entorno

| Variable | Uso |
|---|---|
| `NODE_ENV` | Entorno de ejecución |
| `HOST` | Host donde escucha Fastify |
| `PORT` | Puerto HTTP |
| `LOG_LEVEL` | Nivel de logs |
| `DATABASE_URL` | Conexión PostgreSQL |
| `DATABASE_POOL_MAX` | Máximo de conexiones del pool |
| `JWT_ACCESS_SECRET` | Secreto JWT de al menos 32 caracteres |
| `ACCESS_TOKEN_TTL` | Duración del access token |
| `REFRESH_TOKEN_DAYS` | Duración del refresh token |
| `COOKIE_SECURE` | Cookies solo sobre HTTPS en producción |
| `CORS_ORIGINS` | Orígenes permitidos, separados por coma |
| `ADMIN_NAME` | Nombre del administrador inicial |
| `ADMIN_EMAIL` | Email del administrador inicial |
| `ADMIN_PASSWORD` | Password inicial para `db:seed` |

Ejemplo local:

```env
NODE_ENV=development
HOST=0.0.0.0
PORT=3000
DATABASE_URL=postgresql://siare:siare@localhost:5432/siare
JWT_ACCESS_SECRET=replace-with-at-least-32-random-characters
COOKIE_SECURE=false
CORS_ORIGINS=http://localhost:5173
ADMIN_EMAIL=admin@siare.local
ADMIN_PASSWORD=replace-with-a-strong-password
```

En producción, usar secretos reales, `COOKIE_SECURE=true`, una base PostgreSQL administrada y `CORS_ORIGINS` con la URL pública exacta del frontend.

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Desarrollo con recarga usando `tsx watch` |
| `npm run build` | Compila TypeScript a `dist/` |
| `npm start` | Ejecuta la compilación de producción |
| `npm run typecheck` | Valida tipos |
| `npm run lint` | Ejecuta ESLint |
| `npm run test` | Ejecuta pruebas con Vitest |
| `npm run db:migrate` | Aplica migraciones pendientes |
| `npm run db:seed` | Crea el administrador inicial si no existe |
| `npm run check` | Tipos, lint, pruebas y build |

Antes de desplegar cambios:

```bash
npm run check
```

## Flujo HTTP esencial

1. `POST /api/v1/auth/login` devuelve access token y deja refresh token en cookie `HttpOnly`.
2. Enviar `Authorization: Bearer <token>` en rutas privadas.
3. Crear borradores con `POST /api/v1/actas-ingreso` o `POST /api/v1/actas-entrega`.
4. Emitir con `POST /api/v1/{tipo}/:id/emitir`; solo al emitir se asigna número y cambia el stock.
5. Anular con `POST /api/v1/{tipo}/:id/anular` y un motivo. El registro y su número se conservan.
6. Consultar existencias con `GET /api/v1/inventario/existencias`.
7. Consultar alertas con `GET /api/v1/inventario/alertas-bajo-stock`.
8. Descargar PDF con `GET /api/v1/{tipo}/:id/pdf`.

La especificación completa de cuerpos, filtros y respuestas se mantiene en Swagger.

## Despliegue en Railway

La API productiva está publicada en:

```txt
https://siare-backend-production.up.railway.app
```

Configuración recomendada:

- Build: `npm ci && npm run build`
- Start: `npm start`
- Migraciones: ejecutar `npm run db:migrate` antes de exponer una nueva versión.
- Health check: `/health`
- Documentación: `/docs`
- Base URL para el frontend: `https://siare-backend-production.up.railway.app/api/v1`

Checklist de producción:

- `DATABASE_URL` apunta a PostgreSQL productivo.
- `JWT_ACCESS_SECRET` es aleatorio y tiene al menos 32 caracteres.
- `COOKIE_SECURE=true`.
- `CORS_ORIGINS` contiene la URL exacta del frontend desplegado.
- `ADMIN_PASSWORD` no usa valores de ejemplo.
- Las migraciones se ejecutaron correctamente.

## Seguridad del inventario

El material es un maestro único del inventario. Si se compra o recibe el mismo material desde otro proveedor, orden de compra o proceso de adquisición, se reutiliza el mismo material en el acta de ingreso para sumar existencias.

El proveedor, la orden y el proceso pertenecen al proceso/adquisición y al acta; no crean un material nuevo. El backend bloquea duplicados activos por código y por combinación de nombre normalizado, categoría y unidad de medida.

Consultar [SECURITY.md](SECURITY.md) antes de exponer o modificar configuraciones de producción.

## Autor

Desarrollado por **he-code** como proyecto de portafolio.
