import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';
import { sql } from 'kysely';
import { env } from './config/env.js';
import { AppError } from './core/errors.js';
import { db } from './db/database.js';
import { actsRoutes } from './modules/acts/acts.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { catalogsRoutes } from './modules/catalogs/catalogs.routes.js';
import { inventoryRoutes } from './modules/inventory/inventory.routes.js';
import { usersRoutes } from './modules/users/users.routes.js';

export const buildApp = async () => {
  const app = Fastify({
    logger: {
      level: env.logLevel,
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'request.headers.authorization',
          'request.headers.cookie',
          '*.password',
          '*.accessToken',
          '*.refreshToken',
        ],
        censor: '[REDACTED]',
      },
    },
    bodyLimit: 1_048_576,
    requestTimeout: 20_000,
    connectionTimeout: 10_000,
    keepAliveTimeout: 72_000,
    routerOptions: { maxParamLength: 100 },
    trustProxy: false,
    ajv: {
      customOptions: {
        removeAdditional: false,
        coerceTypes: 'array',
        useDefaults: true,
        allErrors: false,
      },
    },
  });

  await app.register(helmet, { global: true, contentSecurityPolicy: false });
  await app.register(cors, {
    credentials: true,
    origin: (origin, callback) => {
      if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'OPTIONS'],
  });
  await app.register(cookie);
  await app.register(jwt, { secret: env.jwtAccessSecret, sign: { expiresIn: env.accessTokenTtl } });
  await app.register(rateLimit, { global: true, max: 120, timeWindow: '1 minute', ban: 3 });
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'SIARE API',
        description: 'API del Sistema de Inventario y Actas de Recepción y Entrega',
        version: '1.0.0',
      },
      servers: [{ url: '/api/v1', description: 'API v1' }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
      tags: [
        { name: 'Autenticación' },
        { name: 'Usuarios' },
        { name: 'Autoridades distritales' },
        { name: 'Instituciones' },
        { name: 'Líderes' },
        { name: 'Categorías' },
        { name: 'Unidades de medida' },
        { name: 'Materiales' },
        { name: 'Procesos de adquisición' },
        { name: 'Actas de ingreso' },
        { name: 'Actas de entrega' },
        { name: 'Inventario' },
      ],
    },
  });
  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true },
  });

  app.get('/health', {
    schema: { hide: true },
    handler: async () => {
      await db.selectNoFrom(sql<number>`1`.as('ok')).executeTakeFirstOrThrow();
      return { status: 'ok', service: 'siare-api', timestamp: new Date().toISOString() };
    },
  });

  app.setNotFoundHandler((request, reply) =>
    reply
      .code(404)
      .send({ error: { code: 'ROUTE_NOT_FOUND', message: 'Ruta no encontrada', requestId: request.id } }),
  );
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
          requestId: request.id,
        },
      });
    }
    const validation = (error as { validation?: unknown }).validation;
    if (validation) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Los datos enviados no son válidos',
          details: validation,
          requestId: request.id,
        },
      });
    }
    const postgresCode = (error as { code?: string }).code;
    if (postgresCode === '23505')
      return reply.code(409).send({
        error: {
          code: 'DUPLICATE_VALUE',
          message: 'Ya existe un registro con esos datos',
          requestId: request.id,
        },
      });
    if (postgresCode === '23503')
      return reply.code(400).send({
        error: {
          code: 'INVALID_RELATION',
          message: 'Uno de los registros relacionados no existe o está en uso',
          requestId: request.id,
        },
      });
    if (postgresCode === '23514' || postgresCode === '22P02')
      return reply.code(400).send({
        error: {
          code: 'INVALID_VALUE',
          message: 'Uno de los valores no cumple las reglas del sistema',
          requestId: request.id,
        },
      });
    if (postgresCode === '40001' || postgresCode === '40P01')
      return reply.code(409).send({
        error: {
          code: 'CONCURRENT_UPDATE',
          message: 'Otro proceso modificó los mismos datos; intente nuevamente',
          requestId: request.id,
        },
      });
    request.log.error({ err: error }, 'Unhandled request error');
    return reply.code(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error interno', requestId: request.id },
    });
  });

  // Los plugins de rutas heredan el manejador seguro definido arriba.
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(usersRoutes, { prefix: '/api/v1/users' });
  await app.register(catalogsRoutes, { prefix: '/api/v1' });
  await app.register(actsRoutes, { prefix: '/api/v1' });
  await app.register(inventoryRoutes, { prefix: '/api/v1/inventario' });

  return app;
};
