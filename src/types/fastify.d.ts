import '@fastify/jwt';
import type { Role } from '../core/roles.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; role: Role; email: string; type: 'access' };
    user: { sub: string; role: Role; email: string; type: 'access' };
  }
}
