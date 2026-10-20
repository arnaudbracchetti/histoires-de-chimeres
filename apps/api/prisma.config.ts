import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // process.env plutôt que env() : `prisma generate` doit marcher sans DATABASE_URL (build Docker).
    url: process.env['DATABASE_URL'],
  },
});
