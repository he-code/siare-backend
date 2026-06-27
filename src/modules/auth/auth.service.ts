import { createHash, randomBytes, randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import type { FastifyInstance } from 'fastify';
import { UnauthorizedError } from '../../core/errors.js';
import { normalizeEmail } from '../../core/text.js';
import { db } from '../../db/database.js';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const dummyHash = argon2.hash('SIARE-dummy-password-for-timing-only', { type: argon2.argon2id });

interface ClientContext {
  ip: string;
  userAgent: string | undefined;
}

export class AuthService {
  constructor(
    private readonly app: FastifyInstance,
    private readonly refreshDays: number,
  ) {}

  async login(emailInput: string, password: string, context: ClientContext) {
    const email = normalizeEmail(emailInput);
    const user = await db.selectFrom('users').selectAll().where('email', '=', email).executeTakeFirst();
    const valid = await argon2.verify(user?.password_hash ?? (await dummyHash), password);
    if (!user || !valid || !user.active) throw new UnauthorizedError();

    const accessToken = this.accessToken(user.id, user.role, user.email);
    const refreshToken = await this.createSession(user.id, context);
    await this.audit(user.id, 'auth.login', context.ip);
    return {
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, position: user.position },
    };
  }

  async refresh(rawToken: string | undefined, context: ClientContext) {
    if (!rawToken) throw new UnauthorizedError('Sesión de renovación inválida');
    const tokenHash = hashToken(rawToken);

    return db.transaction().execute(async (trx) => {
      const session = await trx
        .selectFrom('refresh_sessions as session')
        .innerJoin('users as user', 'user.id', 'session.user_id')
        .select([
          'session.id',
          'session.user_id',
          'session.expires_at',
          'user.email',
          'user.role',
          'user.active',
        ])
        .where('session.token_hash', '=', tokenHash)
        .forUpdate()
        .executeTakeFirst();

      if (!session || !session.active || new Date(session.expires_at) <= new Date()) {
        if (session) await trx.deleteFrom('refresh_sessions').where('id', '=', session.id).execute();
        throw new UnauthorizedError('Sesión de renovación inválida o expirada');
      }

      await trx.deleteFrom('refresh_sessions').where('id', '=', session.id).execute();
      const refreshToken = randomBytes(48).toString('base64url');
      await trx
        .insertInto('refresh_sessions')
        .values({
          id: randomUUID(),
          user_id: session.user_id,
          token_hash: hashToken(refreshToken),
          expires_at: new Date(Date.now() + this.refreshDays * 86_400_000),
          user_agent: context.userAgent?.slice(0, 500) ?? null,
          ip: context.ip,
        })
        .execute();

      return {
        accessToken: this.accessToken(session.user_id, session.role, session.email),
        refreshToken,
      };
    });
  }

  async logout(rawToken: string | undefined, userId: string | null, ip: string) {
    if (rawToken) {
      await db.deleteFrom('refresh_sessions').where('token_hash', '=', hashToken(rawToken)).execute();
    }
    await this.audit(userId, 'auth.logout', ip);
  }

  private accessToken(userId: string, role: 'administrador' | 'asistente_actas' | 'consulta', email: string) {
    return this.app.jwt.sign({ sub: userId, role, email, type: 'access' });
  }

  private async createSession(userId: string, context: ClientContext) {
    const token = randomBytes(48).toString('base64url');
    await db
      .insertInto('refresh_sessions')
      .values({
        id: randomUUID(),
        user_id: userId,
        token_hash: hashToken(token),
        expires_at: new Date(Date.now() + this.refreshDays * 86_400_000),
        user_agent: context.userAgent?.slice(0, 500) ?? null,
        ip: context.ip,
      })
      .execute();
    return token;
  }

  private async audit(userId: string | null, action: string, ip: string) {
    await db
      .insertInto('audit_logs')
      .values({ user_id: userId, action, entity_type: 'session', entity_id: null, ip, metadata: {} })
      .execute();
  }
}
