import { Hocuspocus, Server as HocuspocusServer } from '@hocuspocus/server';
import { IncomingMessage } from 'http';
import WebSocket from 'ws';
import { AuthenticationExtension } from './extensions/authentication.extension';
import { PersistenceExtension } from './extensions/persistence.extension';
import { Injectable } from '@nestjs/common';
import { Redis } from '@hocuspocus/extension-redis';
import { EnvironmentService } from '../integrations/environment/environment.service';
import {
  createRetryStrategy,
  parseRedisUrl,
  RedisConfig,
} from '../common/helpers';
import { LoggerExtension } from './extensions/logger.extension';
import jwt from 'jsonwebtoken'

@Injectable()
export class CollaborationGateway {
  private hocuspocus: Hocuspocus;
  private redisConfig: RedisConfig;

  constructor(
    private authenticationExtension: AuthenticationExtension,
    private persistenceExtension: PersistenceExtension,
    private loggerExtension: LoggerExtension,
    private environmentService: EnvironmentService,
  ) {
    this.redisConfig = parseRedisUrl(this.environmentService.getRedisUrl());

    this.hocuspocus = HocuspocusServer.configure({
      debounce: 10000,
      maxDebounce: 45000,
      unloadImmediately: false,
      extensions: [
        this.authenticationExtension,
        this.persistenceExtension,
        this.loggerExtension,
        ...(this.environmentService.isCollabDisableRedis()
          ? []
          : [
              new Redis({
                host: this.redisConfig.host,
                port: this.redisConfig.port,
                options: {
                  password: this.redisConfig.password,
                  db: this.redisConfig.db,
                  family: this.redisConfig.family,
                  retryStrategy: createRetryStrategy(),
                },
              }),
            ]),
      ],
    });
  }

  async handleConnection(client: WebSocket, request: IncomingMessage) {
    const { searchParams, pathname } = new URL(request.url!, `ws://${request.headers.host}`)
    const roomName = pathname.replace(/^\/collab\/?/, '') // убираем prefix /collab

    // Shadow блоки
    if (roomName.startsWith('shadow-block:')) {
      const token = searchParams.get('t')
      const [, blockId] = roomName.split(':')
      if (!token) return client.close()
      try {
        const payload: any = jwt.verify(token, process.env.JWT_SECRET!)
        if (payload.b !== blockId) return client.close()
      } catch {
        return client.close()
      }
    }

    // Проксируем в y-websocket
    // setupWSConnection(client, request, { docName: roomName })
  }

  getConnectionCount() {
    return this.hocuspocus.getConnectionsCount();
  }

  getDocumentCount() {
    return this.hocuspocus.getDocumentsCount();
  }

  async destroy(): Promise<void> {
    await this.hocuspocus.destroy();
  }
}
