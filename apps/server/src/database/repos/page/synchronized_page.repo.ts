import { InsertableSynchronizedPage } from '@docmost/db/types/entity.types';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';

@Injectable()
export class SynchronizedPageRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async insert(page: InsertableSynchronizedPage, trx?: KyselyTransaction) {
    const db = dbOrTx(this.db, trx);
    await db.insertInto('synchronizedPages').values(page).execute();
  }
}
