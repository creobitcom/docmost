import { Injectable } from '@nestjs/common';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { DB } from '../types/db';

@Injectable()
export class DbService {
  public readonly db: Kysely<DB>;

  constructor() {
    this.db = new Kysely<DB>({
      dialect: new PostgresDialect({
        pool: new Pool({
          host: process.env.DB_HOST,
          port: +process.env.DB_PORT!,
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME,
        }),
      }),
    });
  }
}
