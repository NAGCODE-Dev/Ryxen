import pg from 'pg';
import 'dotenv/config';

import { DATABASE_URL } from './config.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: DATABASE_URL,
});
