import { Type, type Static } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { authenticate, authorize } from '../../http/auth-guard.js';
import { IdParams, PageQuery, nullableString } from '../../http/schemas.js';
import { UsersService } from './users.service.js';

const RoleSchema = Type.Union([
  Type.Literal('administrador'),
  Type.Literal('asistente_actas'),
  Type.Literal('consulta'),
]);

const CreateUserBody = Type.Object(
  {
    name: Type.String({ minLength: 2, maxLength: 150 }),
    email: Type.String({ format: 'email', maxLength: 150 }),
    password: Type.String({ minLength: 12, maxLength: 200 }),
    role: RoleSchema,
    position: nullableString(150),
    active: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);
const UpdateUserBody = Type.Partial(CreateUserBody, { additionalProperties: false });
const ListUsersQuery = Type.Intersect([
  PageQuery,
  Type.Object({ active: Type.Optional(Type.Boolean()) }, { additionalProperties: false }),
]);

export const usersRoutes = async (app: FastifyInstance) => {
  const service = new UsersService();
  const guards = [authenticate, authorize('administrador')];

  app.get<{ Querystring: Static<typeof ListUsersQuery> }>('/', {
    preHandler: guards,
    schema: {
      tags: ['Usuarios'],
      summary: 'Listar usuarios',
      security: [{ bearerAuth: [] }],
      querystring: ListUsersQuery,
    },
    handler: (request) => service.list(request.query),
  });

  app.get<{ Params: Static<typeof IdParams> }>('/:id', {
    preHandler: guards,
    schema: {
      tags: ['Usuarios'],
      summary: 'Consultar usuario',
      security: [{ bearerAuth: [] }],
      params: IdParams,
    },
    handler: async (request) => ({ data: await service.get(request.params.id) }),
  });

  app.post<{ Body: Static<typeof CreateUserBody> }>('/', {
    preHandler: guards,
    schema: {
      tags: ['Usuarios'],
      summary: 'Crear usuario',
      security: [{ bearerAuth: [] }],
      body: CreateUserBody,
    },
    handler: async (request, reply) => {
      const user = await service.create(request.body, request.user.sub, request.ip);
      return reply.code(201).send({ data: user });
    },
  });

  app.patch<{ Params: Static<typeof IdParams>; Body: Static<typeof UpdateUserBody> }>('/:id', {
    preHandler: guards,
    schema: {
      tags: ['Usuarios'],
      summary: 'Actualizar, activar o desactivar usuario',
      security: [{ bearerAuth: [] }],
      params: IdParams,
      body: UpdateUserBody,
    },
    handler: async (request) => ({
      data: await service.update(request.params.id, request.body, request.user.sub, request.ip),
    }),
  });
};
