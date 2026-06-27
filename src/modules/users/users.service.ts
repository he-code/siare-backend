import argon2 from 'argon2';
import { sql } from 'kysely';
import { BadRequestError, ConflictError, NotFoundError } from '../../core/errors.js';
import { pageOf, paginated, type PageInput } from '../../core/pagination.js';
import type { Role } from '../../core/roles.js';
import { cleanOptional, normalizeEmail } from '../../core/text.js';
import { db } from '../../db/database.js';

interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: Role;
  position?: string | null;
  active?: boolean;
}

interface UpdateUserInput {
  name?: string;
  email?: string;
  password?: string;
  role?: Role;
  position?: string | null;
  active?: boolean;
}

export class UsersService {
  async list(input: PageInput & { search?: string; active?: boolean }) {
    const { page, pageSize, offset } = pageOf(input);
    let query = db.selectFrom('users');
    if (input.search) {
      const search = `%${input.search.trim().replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
      query = query.where((expression) =>
        expression.or([expression('name', 'ilike', search), expression('email', 'ilike', search)]),
      );
    }
    if (input.active !== undefined) query = query.where('active', '=', input.active);

    const [data, count] = await Promise.all([
      query
        .select(['id', 'name', 'email', 'role', 'position', 'active', 'created_at', 'updated_at'])
        .orderBy('name')
        .limit(pageSize)
        .offset(offset)
        .execute(),
      query.select(sql<number>`count(*)::int`.as('total')).executeTakeFirstOrThrow(),
    ]);
    return paginated(data, count.total, page, pageSize);
  }

  async get(id: string) {
    const user = await db
      .selectFrom('users')
      .select(['id', 'name', 'email', 'role', 'position', 'active', 'created_at', 'updated_at'])
      .where('id', '=', id)
      .executeTakeFirst();
    if (!user) throw new NotFoundError('Usuario');
    return user;
  }

  async create(input: CreateUserInput, actorId: string, ip: string) {
    const email = normalizeEmail(input.email);
    const duplicate = await db.selectFrom('users').select('id').where('email', '=', email).executeTakeFirst();
    if (duplicate) throw new ConflictError('El correo ya está registrado', 'EMAIL_ALREADY_EXISTS');

    return db.transaction().execute(async (trx) => {
      const user = await trx
        .insertInto('users')
        .values({
          name: input.name.trim(),
          email,
          password_hash: await argon2.hash(input.password, { type: argon2.argon2id }),
          role: input.role,
          position: cleanOptional(input.position),
          active: input.active ?? true,
        })
        .returning(['id', 'name', 'email', 'role', 'position', 'active', 'created_at'])
        .executeTakeFirstOrThrow();
      await trx
        .insertInto('audit_logs')
        .values({
          user_id: actorId,
          action: 'users.create',
          entity_type: 'user',
          entity_id: user.id,
          ip,
          metadata: { role: user.role },
        })
        .execute();
      return user;
    });
  }

  async update(id: string, input: UpdateUserInput, actorId: string, ip: string) {
    if (!Object.keys(input).length) throw new BadRequestError('Debe enviar al menos un campo');

    return db.transaction().execute(async (trx) => {
      const current = await trx
        .selectFrom('users')
        .selectAll()
        .where('id', '=', id)
        .forUpdate()
        .executeTakeFirst();
      if (!current) throw new NotFoundError('Usuario');

      const willRemainAdmin =
        (input.role ?? current.role) === 'administrador' && (input.active ?? current.active);
      if (current.role === 'administrador' && current.active && !willRemainAdmin) {
        const count = await trx
          .selectFrom('users')
          .select(sql<number>`count(*)::int`.as('total'))
          .where('role', '=', 'administrador')
          .where('active', '=', true)
          .executeTakeFirstOrThrow();
        if (count.total <= 1) throw new ConflictError('Debe existir al menos un administrador activo');
      }
      if (id === actorId && input.active === false)
        throw new ConflictError('No puede desactivar su propia cuenta');

      const passwordHash = input.password
        ? await argon2.hash(input.password, { type: argon2.argon2id })
        : current.password_hash;
      const email = input.email ? normalizeEmail(input.email) : current.email;
      const user = await trx
        .updateTable('users')
        .set({
          name: input.name?.trim() ?? current.name,
          email,
          password_hash: passwordHash,
          role: input.role ?? current.role,
          position: input.position === undefined ? current.position : cleanOptional(input.position),
          active: input.active ?? current.active,
        })
        .where('id', '=', id)
        .returning(['id', 'name', 'email', 'role', 'position', 'active', 'updated_at'])
        .executeTakeFirstOrThrow();
      await trx
        .insertInto('audit_logs')
        .values({
          user_id: actorId,
          action: 'users.update',
          entity_type: 'user',
          entity_id: id,
          ip,
          metadata: { changed: Object.keys(input) },
        })
        .execute();
      return user;
    });
  }
}
