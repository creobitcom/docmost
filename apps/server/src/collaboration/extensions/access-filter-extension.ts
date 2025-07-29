import { Extension, onConnectPayload, beforeHandleMessagePayload } from '@hocuspocus/server';
import * as Y from 'yjs';
import { Injectable } from '@nestjs/common';
import { BlockPermissionService } from 'src/core/page/services/block-permission.service';

@Injectable()
export class AccessFilterExtension implements Extension {
  constructor(private readonly blockPermissionService: BlockPermissionService) {}

  async onConnect(payload: onConnectPayload): Promise<void> {
    const connection = (payload as any).connection;
    const document = (payload as any).document;
    if (!connection) return;
    if (!connection.context) connection.context = {};
    const user = connection.context.user;
    const documentName = document?.name;
    // Проверяем, что это блоковый документ
    if (documentName && documentName.startsWith('block.')) {
      const blockId = documentName.split('.')[1];
      if (!user || !blockId) {
        throw new Error('Unauthorized: no user or blockId');
      }
      // Получаем блок и его страницу
      const block = await this.blockPermissionService.db
        .selectFrom('blocks')
        .select(['pageId'])
        .where('id', '=', blockId)
        .executeTakeFirst();
      if (!block) {
        throw new Error('Block not found');
      }
      // Проверяем права пользователя на этот блок
      const allowedBlocks = await this.blockPermissionService.getAccessiblePageBlocks(block.pageId, user.id);
      const hasAccess = allowedBlocks.some((b) => b.id === blockId && b.hasAccess);
      if (!hasAccess) {
        throw new Error('Access denied to this block');
      }
      // Можно добавить лог: разрешён доступ к блоку
      // console.log(`[AccessFilterExtension][onConnect] user ${user.id} подключается к блоку ${blockId}`);
    }
    const pageId = document?.name?.split?.(".")[1];
    if (!user || !pageId) return;
    const userId = user.id;
    const allowedBlocks = await this.blockPermissionService.getAccessiblePageBlocks(pageId, userId);
    connection.context.allowedBlockIdsOnConnect = new Set(allowedBlocks.map(b => b.id));
    connection.context.hasFullPageAccess = await this.blockPermissionService.userHasDirectPageAccess(userId, pageId);
    if (!connection.context.hasFullPageAccess) {
      const ydoc = document.getYDoc ? document.getYDoc() : document.ydoc;
      if (ydoc) {
        const content = ydoc.getXmlFragment('content');
        const children = content.toArray();
        const visibleNodes: (Y.XmlElement | Y.XmlText)[] = [];
        for (const node of children) {
          if (node instanceof Y.XmlElement) {
            const blockId = node.getAttribute('blockId');
            if (blockId && connection.context.allowedBlockIdsOnConnect.has(blockId)) {
              visibleNodes.push(node);
            }
          } else if (node instanceof Y.XmlText) {
            visibleNodes.push(node);
          }
        }
        const tempDoc = new Y.Doc();
        const tempContent = tempDoc.getXmlFragment('content');
        tempContent.push(visibleNodes);
        const filteredUpdate = Y.encodeStateAsUpdate(tempDoc);
        // Логируем подробности фильтрации
        console.log('[AccessFilterExtension][onConnect] userId:', userId, 'pageId:', pageId, 'allowed:', Array.from(connection.context.allowedBlockIdsOnConnect), 'visibleNodes:', visibleNodes.length, 'filteredUpdate.length:', filteredUpdate.length);
        connection.send(filteredUpdate);
        connection.initialSyncSent = true;
        if (typeof connection.stopInitialSync === 'function') {
          connection.stopInitialSync();
        }
        console.log('[AccessFilterExtension][onConnect] Initial sync filtered for user', userId, 'blocks:', Array.from(connection.context.allowedBlockIdsOnConnect));
      }
    }
    return;
  }

  async beforeHandleMessage({ update, connection }: beforeHandleMessagePayload): Promise<void> {
    const user = connection.context?.user;
    const pageId = connection.document?.name.split('.')[1];
    if (!user || !pageId || !update) {
      return;
    }
    if (!(update instanceof Uint8Array) || update.length === 0) {
      // Не Yjs update — пропускаем фильтрацию
      return;
    }
    const userId = user.id;
    const hasFullPageAccess = await this.blockPermissionService.userHasDirectPageAccess(userId, pageId);
    const allowedBlocks = await this.blockPermissionService.getAccessiblePageBlocks(pageId, userId);
    const allowedBlockIds = new Set(allowedBlocks.map(b => b.id));
    const tempDoc = new Y.Doc();
    try {
      Y.applyUpdate(tempDoc, update);
    } catch (error) {
      // Не валидный Yjs update — просто пропускаем
      return;
    }
    // Только если update успешно применился — фильтруем блоки
    const content = tempDoc.getXmlFragment('content');
    const children = content.toArray();
    for (const node of children) {
      if (node instanceof Y.XmlElement) {
        const blockId = node.getAttribute('blockId');
        if (blockId && !allowedBlockIds.has(blockId) && !hasFullPageAccess) {
          console.warn('[AccessFilterExtension][beforeHandleMessage] BLOCKED: user', userId, 'tried to send update with forbidden blockId', blockId);
          throw new Error('Blocked forbidden block update');
        }
      }
    }
    // Если дошли сюда — update разрешён
    // Можно добавить лог: разрешённый update
    // console.log('[AccessFilterExtension][beforeHandleMessage] update allowed for user', userId);
  }
}

