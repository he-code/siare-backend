# SIARE Backend

API de **SIARE — Sistema de Inventario y Actas de Recepción y Entrega**, construida a partir del documento funcional de la Unidad Distrital Administrativa de la Dirección Distrital 02D02 Chillanes-Educación.

## Alcance

- Autenticación segura, renovación de sesión y roles `administrador`, `asistente_actas` y `consulta`.
- Usuarios, autoridades distritales, instituciones, líderes, categorías, unidades, materiales y procesos de adquisición.
- Actas de ingreso y entrega con ciclo `borrador → emitida → anulada`.
- Numeración anual e independiente: `MINEDUC-CZ5-UDA-{ING|ENT}-001-2026`.
- Inventario transaccional, ajustes trazables e historial inmutable.
- Cálculo decimal de subtotal, IVA y total por línea.
- PDF institucional generado en memoria para actas emitidas.
- OpenAPI interactivo en `/docs`.

## Tecnología y estructura

- Node.js 22+, TypeScript estricto y Fastify.
- PostgreSQL y Kysely; no se concatena entrada del usuario en SQL.
- Arquitectura modular: rutas HTTP → servicios de negocio → acceso tipado a datos.
- Migraciones SQL versionadas, Docker, pruebas unitarias, lint y formateo reproducible.

```text
src/
├── config/          configuración validada
├── core/            errores, roles y utilidades puras
├── db/              conexión y tipos de PostgreSQL
├── http/            validación y controles de acceso
└── modules/
    ├── auth/
    ├── users/
    ├── catalogs/
    ├── acts/
    └── inventory/
```

La explicación de decisiones y transacciones está en [docs/architecture.md](docs/architecture.md). La cobertura del documento funcional está en [docs/requirements-traceability.md](docs/requirements-traceability.md).

## Inicio local

Requisitos: Node.js 22 o superior y Docker.

```bash
cp .env.example .env
docker compose up -d postgres
npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

Antes de ejecutar `db:seed`, cambie `ADMIN_PASSWORD` en `.env`. La API se publica en `http://localhost:3000`, su salud en `/health` y la documentación en `/docs`.

## Comandos

```bash
npm run dev          # desarrollo con recarga
npm run db:migrate   # aplica migraciones pendientes una sola vez
npm run db:seed      # crea el administrador inicial si no existe
npm run check        # tipos + lint + pruebas + compilación
npm start            # ejecuta la compilación de producción
```

## Flujo HTTP esencial

1. `POST /api/v1/auth/login` devuelve un access token; el refresh token queda en cookie `HttpOnly`.
2. Enviar `Authorization: Bearer <token>` en rutas privadas.
3. Crear borrador con `POST /api/v1/actas-ingreso` o `/actas-entrega`.
4. Emitir con `POST /api/v1/{tipo}/:id/emitir`. Solo aquí se asigna número y cambia stock.
5. Anular con `POST /api/v1/{tipo}/:id/anular` y un motivo. El registro y su número se conservan.
6. Descargar el PDF con `GET /api/v1/{tipo}/:id/pdf`.

La especificación completa de cuerpos, filtros y respuestas se mantiene automáticamente en OpenAPI.

## Despliegue

Use secretos aleatorios de al menos 32 caracteres, HTTPS, una cuenta PostgreSQL con permisos mínimos y un origen CORS explícito. Ejecute las migraciones como una tarea previa al despliegue. El contenedor de la aplicación corre sin privilegios y no incluye dependencias de desarrollo.

Consulte [SECURITY.md](SECURITY.md) antes de exponer el servicio a Internet.
