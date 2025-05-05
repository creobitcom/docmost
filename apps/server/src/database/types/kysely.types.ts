import { DB } from './db';
import { Kysely, Transaction } from 'kysely';

export type KyselyDB = Kysely<DB>;
export type KyselyTransaction = Transaction<DB>;
export type Json = {
    type: 'doc';
    content: TiptapNode[];
  };

  export type TiptapNode = {
    type: string;
    attrs?: Record<string, any>;
    content?: TiptapNode[];
    marks?: {
      type: string;
      attrs?: Record<string, any>;
    }[];
    text?: string;
  };
