import { Type, type Static, type TSchema } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { authenticate, authorize } from '../../http/auth-guard.js';
import { IdParams, PageQuery, nullableString } from '../../http/schemas.js';
import { CatalogsService } from './catalogs.service.js';

const ListWithActive = Type.Intersect([PageQuery, Type.Object({ active: Type.Optional(Type.Boolean()) })]);
const ListLeaders = Type.Intersect([
  PageQuery,
  Type.Object({
    institutionId: Type.Optional(Type.String({ pattern: '^[1-9][0-9]*$' })),
    active: Type.Optional(Type.Boolean()),
  }),
]);
const ListMaterials = Type.Intersect([
  PageQuery,
  Type.Object({
    categoryId: Type.Optional(Type.String({ pattern: '^[1-9][0-9]*$' })),
    active: Type.Optional(Type.Boolean()),
  }),
]);

const NamedBody = Type.Object(
  {
    name: Type.String({ minLength: 2, maxLength: 100 }),
    description: nullableString(2000),
    active: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);
const UnitBody = Type.Object(
  { name: Type.String({ minLength: 1, maxLength: 100 }), abbreviation: nullableString(20) },
  { additionalProperties: false },
);
const AuthorityBody = Type.Object(
  {
    nationalId: nullableString(20),
    firstNames: Type.String({ minLength: 2, maxLength: 100 }),
    lastNames: Type.String({ minLength: 2, maxLength: 100 }),
    position: Type.String({ minLength: 2, maxLength: 150 }),
    active: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);
const InstitutionBody = Type.Object(
  {
    amieCode: nullableString(30),
    name: Type.String({ minLength: 2, maxLength: 200 }),
    circuit: nullableString(50),
    canton: nullableString(100),
    parish: nullableString(100),
    address: nullableString(1000),
    phone: nullableString(30),
    active: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);
const LeaderBody = Type.Object(
  {
    institutionId: Type.String({ pattern: '^[1-9][0-9]*$' }),
    nationalId: Type.String({ minLength: 5, maxLength: 20 }),
    firstNames: Type.String({ minLength: 2, maxLength: 100 }),
    lastNames: Type.String({ minLength: 2, maxLength: 100 }),
    position: Type.Union([Type.Literal('rector'), Type.Literal('director')]),
    active: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);
const MaterialBody = Type.Object(
  {
    categoryId: Type.String({ pattern: '^[1-9][0-9]*$' }),
    measurementUnitId: Type.String({ pattern: '^[1-9][0-9]*$' }),
    code: nullableString(50),
    name: Type.String({ minLength: 2, maxLength: 200 }),
    description: nullableString(2000),
    minimumStock: Type.Optional(
      Type.Union([Type.Number({ minimum: 0, maximum: 9999999999.99 }), Type.Null()]),
    ),
    active: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);
const AcquisitionBody = Type.Object(
  {
    processCode: nullableString(100),
    processType: nullableString(100),
    purchaseObject: nullableString(3000),
    awardDate: Type.Optional(Type.Union([Type.String({ format: 'date' }), Type.Null()])),
    supplierName: nullableString(200),
    supplierTaxId: nullableString(20),
    supportDocument: nullableString(150),
    portalUrl: Type.Optional(Type.Union([Type.String({ format: 'uri', maxLength: 2000 }), Type.Null()])),
    notes: nullableString(3000),
  },
  { additionalProperties: false },
);

type RouteOptions<T extends TSchema> = {
  path: string;
  tag: string;
  body: T;
  listQuery: TSchema;
  list: (query: never) => Promise<unknown>;
  create: (body: never, actorId: string, ip: string) => Promise<unknown>;
  update: (id: string, body: never, actorId: string, ip: string) => Promise<unknown>;
  readRoles?: ('administrador' | 'asistente_actas' | 'consulta')[];
};

export const catalogsRoutes = async (app: FastifyInstance) => {
  const service = new CatalogsService();
  const admin = authorize('administrador');

  const registerCrud = <T extends TSchema>(options: RouteOptions<T>) => {
    const updateBody = Type.Partial(options.body, { additionalProperties: false });
    const readers = options.readRoles ?? ['administrador', 'asistente_actas', 'consulta'];

    app.get(options.path, {
      preHandler: [authenticate, authorize(...readers)],
      schema: {
        tags: [options.tag],
        summary: `Listar ${options.tag.toLowerCase()}`,
        security: [{ bearerAuth: [] }],
        querystring: options.listQuery,
      },
      handler: (request) => options.list(request.query as never),
    });
    app.post(options.path, {
      preHandler: [authenticate, admin],
      schema: {
        tags: [options.tag],
        summary: `Registrar ${options.tag.toLowerCase()}`,
        security: [{ bearerAuth: [] }],
        body: options.body,
      },
      handler: async (request, reply) =>
        reply
          .code(201)
          .send({ data: await options.create(request.body as never, request.user.sub, request.ip) }),
    });
    app.patch(`${options.path}/:id`, {
      preHandler: [authenticate, admin],
      schema: {
        tags: [options.tag],
        summary: `Actualizar ${options.tag.toLowerCase()}`,
        security: [{ bearerAuth: [] }],
        params: IdParams,
        body: updateBody,
      },
      handler: async (request) => {
        const params = request.params as Static<typeof IdParams>;
        return { data: await options.update(params.id, request.body as never, request.user.sub, request.ip) };
      },
    });
  };

  registerCrud({
    path: '/categorias',
    tag: 'Categorías',
    body: NamedBody,
    listQuery: ListWithActive,
    list: (query) => service.listCategories(query),
    create: (body, actorId, ip) => service.createCategory(body, actorId, ip),
    update: (id, body, actorId, ip) => service.updateCategory(id, body, actorId, ip),
  });
  registerCrud({
    path: '/unidades-medida',
    tag: 'Unidades de medida',
    body: UnitBody,
    listQuery: PageQuery,
    list: (query) => service.listUnits(query),
    create: (body, actorId, ip) => service.createUnit(body, actorId, ip),
    update: (id, body, actorId, ip) => service.updateUnit(id, body, actorId, ip),
  });
  registerCrud({
    path: '/autoridades-distritales',
    tag: 'Autoridades distritales',
    body: AuthorityBody,
    listQuery: ListWithActive,
    readRoles: ['administrador'],
    list: (query) => service.listAuthorities(query),
    create: (body, actorId, ip) => service.createAuthority(body, actorId, ip),
    update: (id, body, actorId, ip) => service.updateAuthority(id, body, actorId, ip),
  });
  registerCrud({
    path: '/instituciones',
    tag: 'Instituciones',
    body: InstitutionBody,
    listQuery: ListWithActive,
    list: (query) => service.listInstitutions(query),
    create: (body, actorId, ip) => service.createInstitution(body, actorId, ip),
    update: (id, body, actorId, ip) => service.updateInstitution(id, body, actorId, ip),
  });
  registerCrud({
    path: '/lideres',
    tag: 'Líderes',
    body: LeaderBody,
    listQuery: ListLeaders,
    list: (query) => service.listLeaders(query),
    create: (body, actorId, ip) => service.createLeader(body, actorId, ip),
    update: (id, body, actorId, ip) => service.updateLeader(id, body, actorId, ip),
  });
  registerCrud({
    path: '/materiales',
    tag: 'Materiales',
    body: MaterialBody,
    listQuery: ListMaterials,
    list: (query) => service.listMaterials(query),
    create: (body, actorId, ip) => service.createMaterial(body, actorId, ip),
    update: (id, body, actorId, ip) => service.updateMaterial(id, body, actorId, ip),
  });
  registerCrud({
    path: '/procesos-adquisicion',
    tag: 'Procesos de adquisición',
    body: AcquisitionBody,
    listQuery: PageQuery,
    readRoles: ['administrador'],
    list: (query) => service.listAcquisitions(query),
    create: (body, actorId, ip) => service.createAcquisition(body, actorId, ip),
    update: (id, body, actorId, ip) => service.updateAcquisition(id, body, actorId, ip),
  });
};
