import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Role } from '../core/roles.js';
import { ForbiddenError, UnauthorizedError } from '../core/errors.js';
import { db } from '../db/database.js';

export const authenticate = async (request: FastifyRequest, _reply: FastifyReply) => {
  try {
    await request.jwtVerify();
  } catch {
    throw new UnauthorizedError('Sesión inválida o expirada');
  }

  if (request.user.type !== 'access') throw new UnauthorizedError();
  const user = await db
    .selectFrom('users')
    .select(['active', 'role'])
    .where('id', '=', request.user.sub)
    .executeTakeFirst();
  if (!user?.active) throw new UnauthorizedError('La cuenta está inactiva');
  if (user.role !== request.user.role) throw new UnauthorizedError('La sesión debe renovarse');
};

export const authorize =
  (...allowed: Role[]) =>
  async (request: FastifyRequest) => {
    if (!allowed.includes(request.user.role)) throw new ForbiddenError();
  };
