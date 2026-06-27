# Seguridad

## Controles implementados

- Contraseñas con Argon2id; nunca se devuelven ni registran.
- Access token corto y refresh token opaco, rotativo, revocable y almacenado como SHA-256.
- Refresh token en cookie `HttpOnly`, `SameSite=Strict` y `Secure` en producción.
- RBAC por ruta y verificación del estado/rol actual del usuario en cada petición.
- Límite global de peticiones y límite más estricto para el inicio de sesión.
- CORS por lista permitida, cabeceras de seguridad, límite de cuerpo y tiempos de espera.
- Esquemas de entrada cerrados (`additionalProperties: false`) para evitar mass assignment.
- SQL parametrizado por Kysely; filtros y ordenamientos no aceptan identificadores arbitrarios.
- PostgreSQL relacional: no existe un motor NoSQL ni operadores NoSQL controlables por el cliente.
- Mensajes internos y consultas se ocultan al cliente; logs redactan cookies, tokens y contraseñas.
- Restricciones, claves foráneas, `CHECK`, índices únicos y transacciones refuerzan las reglas en la base.
- Bitácora de accesos y mutaciones sensibles.

## Configuración obligatoria de producción

1. Genere `JWT_ACCESS_SECRET` aleatorio (32 bytes o más) y guárdelo en un gestor de secretos.
2. Configure `COOKIE_SECURE=true`, HTTPS extremo a extremo y `CORS_ORIGINS` exactos.
3. Use una cuenta de aplicación PostgreSQL sin permisos de superusuario y TLS con certificado verificable.
4. Restrinja `/docs` a la red administrativa si el inventario de endpoints se considera sensible.
5. Mantenga dependencias e imagen base actualizadas y ejecute `npm audit` en CI.
6. Configure copias de seguridad cifradas y pruebe restauraciones.
7. Si hay un proxy, mantenga `trustProxy` desactivado hasta definir explícitamente sus direcciones confiables.

## Reporte de vulnerabilidades

No publique credenciales o detalles explotables en un issue público. Use el canal privado de seguridad definido por la organización responsable del despliegue.
