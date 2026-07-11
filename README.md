````md
# SIARE Backend

API REST para la gestión institucional de inventario y actas administrativas.

SIARE (Sistema Institucional de Administración de Recursos Educativos) es una solución Full Stack orientada a digitalizar procesos relacionados con el control de materiales, movimientos de inventario y generación de documentación administrativa.

El backend proporciona servicios para gestionar usuarios, permisos, instituciones, materiales y actas, manteniendo una arquitectura desacoplada del frontend y aplicando controles de seguridad, validación y trazabilidad.

---

## 🚀 Características principales

- Gestión de usuarios y autenticación.
- Control de acceso basado en roles (RBAC).
- Administración de instituciones.
- Gestión de materiales e inventario.
- Registro de actas de ingreso.
- Registro de actas de entrega-recepción.
- Generación de documentos PDF.
- Control de movimientos administrativos.
- Validación estricta de datos de entrada.
- Registro de acciones sensibles mediante bitácora.
- API documentada mediante OpenAPI.

---

## 🏗 Arquitectura

SIARE Backend está construido como una API REST independiente del frontend, permitiendo una arquitectura desacoplada y escalable.

La aplicación está organizada por módulos funcionales:

```text
src/
├── modules/
│   ├── auth/
│   ├── users/
│   ├── materials/
│   ├── institutions/
│   ├── acts/
│   └── ...
├── database/
├── middleware/
├── utils/
└── app/
```

El frontend consume los servicios mediante endpoints REST.

---

## 🛠 Tecnologías utilizadas

### Backend

- Node.js 22+
- TypeScript (modo estricto)
- Fastify

### Base de datos

- PostgreSQL
- Kysely (SQL Query Builder)

### Generación de documentos

- PDFKit

### Calidad y pruebas

- Vitest
- ESLint
- Prettier

### Infraestructura

- Docker

---

## 🔐 Seguridad

El sistema implementa múltiples capas de seguridad para proteger la información y garantizar la integridad de los datos.

### Autenticación

- Contraseñas protegidas mediante **Argon2id**.
- Access Tokens de corta duración.
- Refresh Tokens opacos, rotativos y revocables.
- Refresh Tokens almacenados como **SHA-256**.
- Cookies **HttpOnly**, **SameSite=Strict** y **Secure** en producción.

### Autorización

El sistema implementa **RBAC (Role-Based Access Control)**.

| Rol | Descripción |
|------|-------------|
| `admin` | Administración completa del sistema. |
| `asistente_actas` | Gestión operativa de actas e inventario. |
| `consulta` | Acceso de solo lectura. |

Cada petición verifica el estado y permisos actuales del usuario.

### Protección de la API

- Rate limiting global.
- Rate limiting específico para autenticación.
- CORS mediante lista blanca.
- Cabeceras HTTP de seguridad.
- Límite del tamaño de las peticiones.
- Validación estricta de esquemas (`additionalProperties: false`).
- Prevención de Mass Assignment.
- Consultas SQL parametrizadas mediante Kysely.
- Ocultamiento de errores internos.
- Redacción automática de cookies, tokens y contraseñas en los logs.

### Integridad de datos

La base de datos utiliza:

- Claves foráneas.
- Restricciones `CHECK`.
- Índices únicos.
- Transacciones.
- Restricciones de integridad referencial.

---

## 📚 Documentación de la API

La API cuenta con documentación interactiva mediante OpenAPI.

**Producción**

https://siare-backend-production.up.railway.app/docs

---

## 📄 Generación de documentos

El sistema genera documentos oficiales en formato PDF mediante **PDFKit**.

Actualmente soporta:

- Actas de ingreso.
- Actas de entrega-recepción.

Los documentos mantienen un formato consistente y validado para procesos administrativos.

---

## 🧪 Pruebas automatizadas

El proyecto utiliza **Vitest** para validar procesos críticos.

Entre las pruebas implementadas se encuentran:

- Generación correcta de documentos PDF.
- Validación del formato PDF.
- Verificación del número de páginas generadas.
- Pruebas de servicios críticos del sistema.

Ejecutar pruebas:

```bash
npm run test
```

---

## ⚙️ Instalación

### Requisitos

- Node.js 22 o superior.
- PostgreSQL.
- Docker (opcional).

### Clonar el repositorio

```bash
git clone https://github.com/he-code/siare-backend.git

cd siare-backend
```

### Instalar dependencias

```bash
npm install
```

### Configurar variables de entorno

Crear un archivo `.env`.

Ejemplo:

```env
DATABASE_URL=
JWT_ACCESS_SECRET=
COOKIE_SECURE=false
CORS_ORIGINS=
```

---

## ▶️ Ejecutar el proyecto

Modo desarrollo:

```bash
npm run dev
```

Compilar:

```bash
npm run build
```

Producción:

```bash
npm start
```

---

## 🐳 Docker

El proyecto incluye configuración para ejecutar la aplicación mediante Docker, facilitando la creación de entornos consistentes entre desarrollo y producción.

---

## 🚀 Despliegue

### Backend

Railway

https://siare-backend-production.up.railway.app/docs

### Frontend relacionado

Repositorio:

https://github.com/he-code/siare-frontend

Aplicación:

https://siare-frontend.vercel.app/

---

## 📌 Hoja de ruta

Algunas mejoras previstas para futuras versiones:

- Incrementar la cobertura de pruebas automatizadas.
- Incorporar monitoreo y métricas.
- Nuevos módulos administrativos.
- Optimización del rendimiento para grandes volúmenes de información.

---
