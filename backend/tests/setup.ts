import dotenv from 'dotenv';

dotenv.config({ path: '.env.test', override: true });

if (!process.env.DATABASE_URL?.includes('access_portal_test')) {
  throw new Error(
    'Refusing to run tests: DATABASE_URL must point at access_portal_test. See .env.test.example.',
  );
}
