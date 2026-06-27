import { Type, type Static } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { env } from '../../config/env.js';
import { authenticate } from '../../http/auth-guard.js';
import { db } from '../../db/database.js';
import { AuthService } from './auth.service.js';

const LoginBody = Type.Object(
  {
    email: Type.String({ format: 'email', maxLength: 150 }),
    password: Type.String({ minLength: 8, maxLength: 200 }),
  },
  { additionalProperties: false },
);

const cookieName = 'siare_refresh';
const cookieOptions = {
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: 'strict' as const,
  path: '/api/v1/auth',
  maxAge: env.refreshTokenDays * 86_400,
};

export const authRoutes = async (app: FastifyInstance) => {
  const service = new AuthService(app, env.refreshTokenDays);

  app.post<{ Body: Static<typeof LoginBody> }>('/login', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    schema: { tags: ['Autenticación'], summary: 'Iniciar sesión', body: LoginBody },
    handler: async (request, reply) => {
      const result = await service.login(request.body.email, request.body.password, {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });
      reply.setCookie(cookieName, result.refreshToken, cookieOptions);
      return { accessToken: result.accessToken, tokenType: 'Bearer', user: result.user };
    },
  });

  app.post('/refresh', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    schema: { tags: ['Autenticación'], summary: 'Rotar tokens de sesión' },
    handler: async (request, reply) => {
      const result = await service.refresh(request.cookies[cookieName], {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });
      reply.setCookie(cookieName, result.refreshToken, cookieOptions);
      return { accessToken: result.accessToken, tokenType: 'Bearer' };
    },
  });

  app.post('/logout', {
    schema: { tags: ['Autenticación'], summary: 'Cerrar sesión' },
    handler: async (request, reply) => {
      let userId: string | null = null;
      try {
        await request.jwtVerify();
        userId = request.user.sub;
      } catch {
        // El cierre de sesión es idempotente aunque el access token haya expirado.
      }
      await service.logout(request.cookies[cookieName], userId, request.ip);
      reply.clearCookie(cookieName, { path: cookieOptions.path });
      return { message: 'Sesión cerrada' };
    },
  });

  app.get('/me', {
    preHandler: [authenticate],
    schema: {
      tags: ['Autenticación'],
      summary: 'Obtener usuario autenticado',
      security: [{ bearerAuth: [] }],
    },
    handler: async (request) => {
      const user = await db
        .selectFrom('users')
        .select(['id', 'name', 'email', 'role', 'position', 'active'])
        .where('id', '=', request.user.sub)
        .executeTakeFirstOrThrow();
      return { data: user };
    },
  });
};
