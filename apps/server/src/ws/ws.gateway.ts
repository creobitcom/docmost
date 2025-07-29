import {
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { TokenService } from '../core/auth/services/token.service';
import { JwtPayload, JwtType } from '../core/auth/dto/jwt-payload';
import { OnModuleDestroy, Injectable } from '@nestjs/common';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import * as cookie from 'cookie';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';

@WebSocketGateway({
  cors: { origin: '*' },
  transports: ['websocket'],
})
export class WsGateway implements OnGatewayConnection, OnModuleDestroy {
  @WebSocketServer()
  server: Server;
  constructor(
    private tokenService: TokenService,
    private spaceMemberRepo: SpaceMemberRepo,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  async handleConnection(client: Socket, ...args: any[]): Promise<void> {
    try {
      const cookies = cookie.parse(client.handshake.headers.cookie || '');
      const token: JwtPayload = await this.tokenService.verifyJwt(
        cookies['authToken'],
        JwtType.ACCESS,
      );

      const userId = token.sub;
      const workspaceId = token.workspaceId;

      // Сохраняем userId в объекте client для дальнейшего использования
      client.data = client.data || {};
      client.data.userId = userId;

      const userSpaceIds = await this.spaceMemberRepo.getUserSpaceIds(userId);

      const workspaceRoom = `workspace-${workspaceId}`;
      const spaceRooms = userSpaceIds.map((id) => this.getSpaceRoomName(id));

      client.join([workspaceRoom, ...spaceRooms]);

      // Получаем все страницы с полным доступом для пользователя
      const pagesWithFullAccess = await this.db
      .selectFrom('pageMembers')
        .select(['pageId'])
      .where('userId', '=', userId)
        .where('source', '=', 'manual')
      .where('deletedAt', 'is', null)
        .execute();

      // Присоединяем пользователя к комнатам страниц с полным доступом
      for (const page of pagesWithFullAccess) {
        const fullAccessRoom = this.getFullAccessPageRoomName(page.pageId);
        client.join(fullAccessRoom);
  }
    } catch (err) {
      client.emit('Unauthorized');
      client.disconnect();
    }
  }

  @SubscribeMessage('message')
  async handleMessage(client: Socket, data: any): Promise<void> {
    const spaceEvents = [
      'updateOne',
      'addTreeNode',
      'moveTreeNode',
      'deleteTreeNode',
    ];

    if (spaceEvents.includes(data?.operation) && data?.spaceId) {
      const room = this.getSpaceRoomName(data.spaceId);

      // Проверка доступа для addTreeNode (новые блоки)
      if (data?.operation === 'addTreeNode') {
        const pageId = data.payload?.data?.pageId;
        if (pageId) {
          // Получаем всех пользователей с полным доступом к странице
          const pageMembers = await this.db
            .selectFrom('pageMembers')
            .select(['userId'])
            .where('pageId', '=', pageId)
            .where('source', '=', 'manual')
            .where('deletedAt', 'is', null)
            .execute();
          for (const member of pageMembers) {
            const targetRoom = this.getFullAccessPageRoomName(pageId);
            this.server.to(targetRoom).emit('message', data);
          }
          return;
        }
      }

      // Для других событий — фильтрация по доступу к блоку (пример для updateOne)
      if (data?.operation === 'updateOne' && data?.payload?.data?.blockId) {
        const blockId = data.payload.data.blockId;
        // Получаем pageId для блока
        const pageRow = await this.db
          .selectFrom('blocks')
          .select(['pageId'])
          .where('id', '=', blockId)
          .executeTakeFirst();
        if (pageRow) {
          const pageId = pageRow.pageId;
          const pageMembers = await this.db
            .selectFrom('pageMembers')
            .select(['userId'])
            .where('pageId', '=', pageId)
            .where('source', '=', 'manual')
            .where('deletedAt', 'is', null)
            .execute();
          for (const member of pageMembers) {
            const targetRoom = this.getFullAccessPageRoomName(pageId);
            this.server.to(targetRoom).emit('message', data);
          }
          return;
        }
      }

      // Для остальных событий — отправляем только в комнату space
      this.server.to(room).emit('message', data);
      return;
    }

    // По умолчанию не рассылаем всем, только в рабочие комнаты
    // client.broadcast.emit('message', data);
  }

  @SubscribeMessage('join-room')
  handleJoinRoom(client: Socket, @MessageBody() roomName: string): void {
    // if room is a space, check if user has permissions
    //client.join(roomName);
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(client: Socket, @MessageBody() roomName: string): void {
    client.leave(roomName);
}

  onModuleDestroy() {
    if (this.server) {
      this.server.close();
    }
  }

  getSpaceRoomName(spaceId: string): string {
    return `space-${spaceId}`;
  }

  getFullAccessPageRoomName(pageId: string): string {
    return `page-full-access-${pageId}`;
  }
}

