import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../generated/prisma';
import { hash, argon2id } from 'argon2';
import { config } from 'dotenv';
import { z } from 'zod';
config();
const env = z
  .object({ ADMIN_EMAIL: z.string().email(), ADMIN_PASSWORD: z.string().min(16).max(128) })
  .parse(process.env);
const db = new PrismaClient();
async function main() {
  const email = env.ADMIN_EMAIL.toLowerCase().trim();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== 'ADMIN')
      throw new Error('Refusing to promote an existing customer through seed');
    console.log('Admin already exists; password and profile were preserved.');
    return;
  }
  await db.$transaction(async (tx) => {
    const id = randomUUID();
    await tx.user.create({
      data: {
        id,
        email,
        passwordHash: await hash(env.ADMIN_PASSWORD, { type: argon2id }),
        firstName: 'Store',
        lastName: 'Administrator',
        role: 'ADMIN',
      },
    });
  });
  console.log('Admin account created. Credentials were not logged.');
}
main()
  .catch(() => {
    console.error('Admin seed failed; verify environment and database availability.');
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
