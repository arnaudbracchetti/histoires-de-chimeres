import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
});

// Idempotent : ne crée la convention que si la base n'en contient aucune.
if (!(await prisma.convention.findFirst())) {
  await prisma.convention.create({ data: { name: 'Histoires de Chimères' } });
}
await prisma.$disconnect();
