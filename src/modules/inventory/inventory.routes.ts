import { Type, type Static } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { authenticate, authorize } from '../../http/auth-guard.js';
import { PageQuery } from '../../http/schemas.js';
import { InventoryService } from './inventory.service.js';

const MovementsQuery = Type.Intersect([
  PageQuery,
  Type.Object({
    materialId: Type.Optional(Type.String({ pattern: '^[1-9][0-9]*$' })),
    type: Type.Optional(
      Type.Union([
        Type.Literal('entrada'),
        Type.Literal('salida'),
        Type.Literal('ajuste'),
        Type.Literal('anulacion'),
      ]),
    ),
    dateFrom: Type.Optional(Type.String({ format: 'date' })),
    dateTo: Type.Optional(Type.String({ format: 'date' })),
  }),
]);
const AdjustmentBody = Type.Object(
  {
    materialId: Type.String({ pattern: '^[1-9][0-9]*$' }),
    difference: Type.Number({ minimum: -9999999999.99, maximum: 9999999999.99, multipleOf: 0.01 }),
    reason: Type.String({ minLength: 5, maxLength: 2000 }),
  },
  { additionalProperties: false },
);

export const inventoryRoutes = async (app: FastifyInstance) => {
  const service = new InventoryService();
  app.get<{ Querystring: Static<typeof MovementsQuery> }>('/movimientos', {
    preHandler: [authenticate, authorize('administrador', 'consulta')],
    schema: {
      tags: ['Inventario'],
      summary: 'Consultar historial inmutable de movimientos',
      security: [{ bearerAuth: [] }],
      querystring: MovementsQuery,
    },
    handler: (request) => service.listMovements(request.query),
  });
  app.get('/resumen', {
    preHandler: [authenticate, authorize('administrador', 'asistente_actas', 'consulta')],
    schema: {
      tags: ['Inventario'],
      summary: 'Obtener resumen de inventario',
      security: [{ bearerAuth: [] }],
    },
    handler: async () => ({ data: await service.summary() }),
  });
  app.post<{ Body: Static<typeof AdjustmentBody> }>('/ajustes', {
    preHandler: [authenticate, authorize('administrador')],
    schema: {
      tags: ['Inventario'],
      summary: 'Registrar ajuste trazable de stock',
      security: [{ bearerAuth: [] }],
      body: AdjustmentBody,
    },
    handler: async (request, reply) =>
      reply.code(201).send({
        data: await service.adjust(
          request.body.materialId,
          request.body.difference,
          request.body.reason,
          request.user.sub,
          request.ip,
        ),
      }),
  });
};
