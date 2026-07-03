import { Type } from '@sinclair/typebox';

export const IdParams = Type.Object(
  {
    id: Type.String({ pattern: '^[1-9][0-9]*$', maxLength: 20 }),
  },
  { additionalProperties: false },
);

export const PaginationFields = {
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
  search: Type.Optional(Type.String({ maxLength: 200 })),
};

export const PageQuery = Type.Object(PaginationFields, {
  additionalProperties: false,
});

export const ErrorResponse = Type.Object({
  error: Type.Object({
    code: Type.String(),
    message: Type.String(),
    details: Type.Optional(Type.Unknown()),
    requestId: Type.String(),
  }),
});

export const nullableString = (maxLength: number) =>
  Type.Optional(Type.Union([Type.String({ maxLength }), Type.Null()]));
