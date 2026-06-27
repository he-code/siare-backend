import { Type, type Static } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { authenticate, authorize } from '../../http/auth-guard.js';
import { IdParams, PageQuery, nullableString } from '../../http/schemas.js';
import { ActsService } from './acts.service.js';
import { ActPdfService } from './pdf.service.js';

const Identifier = Type.String({ pattern: '^[1-9][0-9]*$', maxLength: 20 });
const EntryItem = Type.Object(
  {
    materialId: Identifier,
    quantity: Type.Number({ exclusiveMinimum: 0, maximum: 9999999999.99, multipleOf: 0.01 }),
    unitValue: Type.Number({ minimum: 0, maximum: 999999999999.99, multipleOf: 0.01 }),
    appliesVat: Type.Boolean(),
    vatPercentage: Type.Number({ minimum: 0, maximum: 100, multipleOf: 0.01 }),
    notes: nullableString(1000),
  },
  { additionalProperties: false },
);
const EntryBody = Type.Object(
  {
    acquisitionProcessId: Type.Optional(Type.Union([Identifier, Type.Null()])),
    authorizedById: Type.Optional(Type.Union([Identifier, Type.Null()])),
    actDate: Type.String({ format: 'date' }),
    concept: nullableString(3000),
    notes: nullableString(3000),
    items: Type.Array(EntryItem, { minItems: 1, maxItems: 500 }),
  },
  { additionalProperties: false },
);
const DeliveryItem = Type.Object(
  {
    materialId: Identifier,
    quantity: Type.Number({ exclusiveMinimum: 0, maximum: 9999999999.99, multipleOf: 0.01 }),
    notes: nullableString(1000),
  },
  { additionalProperties: false },
);
const DeliveryBody = Type.Object(
  {
    institutionId: Identifier,
    leaderId: Identifier,
    actDate: Type.String({ format: 'date' }),
    subject: nullableString(200),
    notes: nullableString(3000),
    items: Type.Array(DeliveryItem, { minItems: 1, maxItems: 500 }),
  },
  { additionalProperties: false },
);
const CancelBody = Type.Object(
  { reason: Type.String({ minLength: 5, maxLength: 3000 }) },
  { additionalProperties: false },
);
const ListActsQuery = Type.Intersect([
  PageQuery,
  Type.Object({
    period: Type.Optional(Type.Integer({ minimum: 2000, maximum: 2200 })),
    status: Type.Optional(
      Type.Union([Type.Literal('borrador'), Type.Literal('emitida'), Type.Literal('anulada')]),
    ),
    number: Type.Optional(Type.String({ maxLength: 100 })),
    dateFrom: Type.Optional(Type.String({ format: 'date' })),
    dateTo: Type.Optional(Type.String({ format: 'date' })),
  }),
]);

export const actsRoutes = async (app: FastifyInstance) => {
  const service = new ActsService();
  const pdf = new ActPdfService(service);
  const readers = authorize('administrador', 'asistente_actas', 'consulta');
  const entryWriter = authorize('administrador');
  const deliveryWriter = authorize('administrador', 'asistente_actas');

  app.get<{ Querystring: Static<typeof ListActsQuery> }>('/actas-ingreso', {
    preHandler: [authenticate, readers],
    schema: {
      tags: ['Actas de ingreso'],
      summary: 'Consultar actas de ingreso',
      security: [{ bearerAuth: [] }],
      querystring: ListActsQuery,
    },
    handler: (request) => service.listEntries(request.query),
  });
  app.get<{ Params: Static<typeof IdParams> }>('/actas-ingreso/:id', {
    preHandler: [authenticate, readers],
    schema: {
      tags: ['Actas de ingreso'],
      summary: 'Ver detalle de acta de ingreso',
      security: [{ bearerAuth: [] }],
      params: IdParams,
    },
    handler: async (request) => ({ data: await service.getEntry(request.params.id) }),
  });
  app.post<{ Body: Static<typeof EntryBody> }>('/actas-ingreso', {
    preHandler: [authenticate, entryWriter],
    schema: {
      tags: ['Actas de ingreso'],
      summary: 'Crear borrador de ingreso',
      security: [{ bearerAuth: [] }],
      body: EntryBody,
    },
    handler: async (request, reply) =>
      reply.code(201).send({ data: await service.createEntry(request.body, request.user.sub, request.ip) }),
  });
  app.put<{ Params: Static<typeof IdParams>; Body: Static<typeof EntryBody> }>('/actas-ingreso/:id', {
    preHandler: [authenticate, entryWriter],
    schema: {
      tags: ['Actas de ingreso'],
      summary: 'Reemplazar borrador de ingreso',
      security: [{ bearerAuth: [] }],
      params: IdParams,
      body: EntryBody,
    },
    handler: async (request) => ({
      data: await service.updateEntry(request.params.id, request.body, request.user.sub, request.ip),
    }),
  });
  app.post<{ Params: Static<typeof IdParams> }>('/actas-ingreso/:id/emitir', {
    preHandler: [authenticate, entryWriter],
    schema: {
      tags: ['Actas de ingreso'],
      summary: 'Emitir acta y aumentar stock',
      security: [{ bearerAuth: [] }],
      params: IdParams,
    },
    handler: async (request) => ({
      data: await service.emitEntry(request.params.id, request.user.sub, request.ip),
    }),
  });
  app.post<{ Params: Static<typeof IdParams>; Body: Static<typeof CancelBody> }>(
    '/actas-ingreso/:id/anular',
    {
      preHandler: [authenticate, entryWriter],
      schema: {
        tags: ['Actas de ingreso'],
        summary: 'Anular acta y revertir stock',
        security: [{ bearerAuth: [] }],
        params: IdParams,
        body: CancelBody,
      },
      handler: async (request) => ({
        data: await service.cancelEntry(request.params.id, request.body.reason, request.user.sub, request.ip),
      }),
    },
  );
  app.get<{ Params: Static<typeof IdParams> }>('/actas-ingreso/:id/pdf', {
    preHandler: [authenticate, readers],
    schema: {
      tags: ['Actas de ingreso'],
      summary: 'Generar PDF de ingreso',
      security: [{ bearerAuth: [] }],
      params: IdParams,
    },
    handler: async (request, reply) => pdf.sendEntry(request.params.id, reply),
  });

  app.get<{ Querystring: Static<typeof ListActsQuery> }>('/actas-entrega', {
    preHandler: [authenticate, readers],
    schema: {
      tags: ['Actas de entrega'],
      summary: 'Consultar actas de entrega',
      security: [{ bearerAuth: [] }],
      querystring: ListActsQuery,
    },
    handler: (request) => service.listDeliveries(request.query),
  });
  app.get<{ Params: Static<typeof IdParams> }>('/actas-entrega/:id', {
    preHandler: [authenticate, readers],
    schema: {
      tags: ['Actas de entrega'],
      summary: 'Ver detalle de acta de entrega',
      security: [{ bearerAuth: [] }],
      params: IdParams,
    },
    handler: async (request) => ({ data: await service.getDelivery(request.params.id) }),
  });
  app.post<{ Body: Static<typeof DeliveryBody> }>('/actas-entrega', {
    preHandler: [authenticate, deliveryWriter],
    schema: {
      tags: ['Actas de entrega'],
      summary: 'Crear borrador de entrega',
      security: [{ bearerAuth: [] }],
      body: DeliveryBody,
    },
    handler: async (request, reply) =>
      reply
        .code(201)
        .send({ data: await service.createDelivery(request.body, request.user.sub, request.ip) }),
  });
  app.put<{ Params: Static<typeof IdParams>; Body: Static<typeof DeliveryBody> }>('/actas-entrega/:id', {
    preHandler: [authenticate, deliveryWriter],
    schema: {
      tags: ['Actas de entrega'],
      summary: 'Reemplazar borrador de entrega',
      security: [{ bearerAuth: [] }],
      params: IdParams,
      body: DeliveryBody,
    },
    handler: async (request) => ({
      data: await service.updateDelivery(request.params.id, request.body, request.user.sub, request.ip),
    }),
  });
  app.post<{ Params: Static<typeof IdParams> }>('/actas-entrega/:id/emitir', {
    preHandler: [authenticate, deliveryWriter],
    schema: {
      tags: ['Actas de entrega'],
      summary: 'Emitir acta y descontar stock',
      security: [{ bearerAuth: [] }],
      params: IdParams,
    },
    handler: async (request) => ({
      data: await service.emitDelivery(request.params.id, request.user.sub, request.ip),
    }),
  });
  app.post<{ Params: Static<typeof IdParams>; Body: Static<typeof CancelBody> }>(
    '/actas-entrega/:id/anular',
    {
      preHandler: [authenticate, entryWriter],
      schema: {
        tags: ['Actas de entrega'],
        summary: 'Anular acta y devolver stock',
        security: [{ bearerAuth: [] }],
        params: IdParams,
        body: CancelBody,
      },
      handler: async (request) => ({
        data: await service.cancelDelivery(
          request.params.id,
          request.body.reason,
          request.user.sub,
          request.ip,
        ),
      }),
    },
  );
  app.get<{ Params: Static<typeof IdParams> }>('/actas-entrega/:id/pdf', {
    preHandler: [authenticate, readers],
    schema: {
      tags: ['Actas de entrega'],
      summary: 'Generar PDF de entrega',
      security: [{ bearerAuth: [] }],
      params: IdParams,
    },
    handler: async (request, reply) => pdf.sendDelivery(request.params.id, reply),
  });
};
