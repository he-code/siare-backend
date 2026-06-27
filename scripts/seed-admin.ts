import argon2 from 'argon2';
import { db, closeDatabase } from '../src/db/database.js';
import { normalizeEmail } from '../src/core/text.js';

const email = normalizeEmail(process.env['ADMIN_EMAIL'] ?? '');
const name = process.env['ADMIN_NAME']?.trim() ?? '';
const password = process.env['ADMIN_PASSWORD'] ?? '';

if (!email || !name || password.length < 12) {
  throw new Error('ADMIN_NAME, ADMIN_EMAIL y ADMIN_PASSWORD (mínimo 12 caracteres) son obligatorios');
}

const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
const existing = await db.selectFrom('users').select('id').where('email', '=', email).executeTakeFirst();
if (!existing) {
  await db
    .insertInto('users')
    .values({ name, email, password_hash: passwordHash, role: 'administrador', position: null, active: true })
    .execute();
}

console.info(`Administrador inicial listo: ${email}`);
await closeDatabase();
