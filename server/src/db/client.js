import 'dotenv/config';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

let db = null;
let pool = null;

if (connectionString) {
  pool = new Pool({ connectionString });
  db = drizzle(pool, { schema });
}

export const getDb = () => db;
export const getPool = () => pool;
export { schema };
