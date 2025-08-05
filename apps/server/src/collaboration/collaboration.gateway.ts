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
import { AccessFilterExtension } from './extensions/access-filter-extension';
import { BlockPermissionService } from 'src/core/page/services/block-permission.service';

@Injectable()
export class CollaborationGateway {
  private readonly logger = new (require('@nestjs/common').Logger)('CollaborationGateway');
  /**
   * Send a force refresh event to a specific user via WebSocket
   */
  public sendForceRefresh(userId: string, pageId: string, removedBlockIds: string[]) {
    this.logger.warn(`[GATEWAY] sendForceRefresh: userId=${userId}, pageId=${pageId}, removedBlockIds=${JSON.stringify(removedBlockIds)}`);
    // Find all active connections (WebSocket clients)
    const clients = (this.hocuspocus as any).connections || [];
    this.logger.warn(`[GATEWAY] Total clients: ${clients.length}`);
    let found = false;
    for (const conn of clients) {
      if (conn.context?.user?.id === userId && conn.socket && typeof conn.socket.send === 'function') {
        found = true;
        const payload = {
          type: 'forceRefresh',
          pageId,
          removedBlockIds,
        };
        try {
          conn.socket.send(JSON.stringify(payload));
          this.logger.warn(`[GATEWAY] Sent forceRefresh to user ${userId}`);
        } catch (err) {
          this.logger.warn(`[GATEWAY] Failed to send forceRefresh to user ${userId}: ${err}`);
        }
      }
    }
    if (!found) {
      this.logger.warn(`[GATEWAY] No client found for user ${userId}`);
    }
  }
  private hocuspocus: Hocuspocus;
  private redisConfig: RedisConfig;

  constructor(
    private authenticationExtension: AuthenticationExtension,
    private persistenceExtension: PersistenceExtension,
    private loggerExtension: LoggerExtension,
    private environmentService: EnvironmentService,
    private blockPermissionService: BlockPermissionService,
  ) {
    this.redisConfig = parseRedisUrl(this.environmentService.getRedisUrl());

    const accessFilterExtension = new AccessFilterExtension(this.blockPermissionService);

    this.hocuspocus = HocuspocusServer.configure({
      debounce: 10000,
      maxDebounce: 45000,
      unloadImmediately: true, // Документ выгружается из памяти сразу после отключения последнего клиента
      extensions: [
        this.authenticationExtension,
        this.persistenceExtension,
        this.loggerExtension,
        accessFilterExtension,
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

  handleConnection(client: WebSocket, request: IncomingMessage): any {
    this.hocuspocus.handleConnection(client, request);
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
