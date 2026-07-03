import { Type, type Static } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { ForbiddenError } from '../../core/errors.js';
import { authenticate, authorize } from '../../http/auth-guard.js';
import { PageQuery, PaginationFields } from '../../http/schemas.js';
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
const StockQuery = Type.Object(
  {
    ...PaginationFields,
    search: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
    categoryId: Type.Optional(Type.String({ pattern: '^[1-9][0-9]*$' })),
    active: Type.Optional(Type.Boolean()),
    lowStock: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

const LowStockAlertsQuery = Type.Object(
  {
    ...PaginationFields,
    search: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
    categoryId: Type.Optional(Type.String({ pattern: '^[1-9][0-9]*$' })),
  },
  { additionalProperties: false },
);

export const inventoryRoutes = async (app: FastifyInstance) => {
  const service = new InventoryService();

  app.get<{ Querystring: Static<typeof StockQuery> }>('/existencias', {
    preHandler: [authenticate, authorize('administrador', 'asistente_actas', 'consulta')],
    schema: {
      tags: ['Inventario'],
      summary: 'Consultar existencias actuales de materiales',
      security: [{ bearerAuth: [] }],
      querystring: StockQuery,
    },
    handler: (request) => service.listStock(request.query),
  });

  app.get<{ Querystring: Static<typeof LowStockAlertsQuery> }>('/alertas-bajo-stock', {
    preHandler: [authenticate, authorize('administrador', 'asistente_actas', 'consulta')],
    schema: {
      tags: ['Inventario'],
      summary: 'Consultar materiales activos con stock bajo o agotado',
      security: [{ bearerAuth: [] }],
      querystring: LowStockAlertsQuery,
    },
    handler: (request) => service.listLowStockAlerts(request.query),
  });

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
  app.post('/ajustes', {
    preHandler: [authenticate, authorize('administrador')],
    schema: {
      tags: ['Inventario'],
      summary: 'Ajuste manual deshabilitado por seguridad',
      security: [{ bearerAuth: [] }],
    },
    handler: async () => {
      throw new ForbiddenError(
        'Los ajustes manuales de stock están deshabilitados. Use actas de ingreso o actas de entrega para modificar existencias.',
      );
    },
  });
};
