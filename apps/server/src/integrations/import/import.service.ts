import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { MultipartFile } from '@fastify/multipart';
import { sanitize } from 'sanitize-filename-ts';
import * as path from 'path';
import {
  htmlToJson, jsonToText,
  tiptapExtensions,
} from '../../collaboration/collaboration.util';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { generateSlugId } from '../../common/helpers';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
import { TiptapTransformer } from '@hocuspocus/transformer';
import * as Y from 'yjs';
import { markdownToHtml } from "@docmost/editor-ext";

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    private readonly pageRepo: PageRepo,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  async importPage(
    filePromise: Promise<MultipartFile>,
    userId: string,
    spaceId: string,
    workspaceId: string,
  ): Promise<void> {
    const file = await filePromise;
    const fileBuffer = await file.toBuffer();
    const fileExtension = path.extname(file.filename).toLowerCase();
    const fileName = sanitize(
      path.basename(file.filename, fileExtension).slice(0, 255),
    );
    const fileContent = fileBuffer.toString();

    let prosemirrorState = null;
    let createdPage = null;

    try {
      if (fileExtension.endsWith('.md')) {
        prosemirrorState = await this.processMarkdown(fileContent);
      } else if (fileExtension.endsWith('.html')) {
        prosemirrorState = await this.processHTML(fileContent);
      }
    } catch (err) {
      const message = 'Error processing file content';
      this.logger.error(message, err);
      throw new BadRequestException(message);
    }

    if (!prosemirrorState) {
      const message = 'Failed to create ProseMirror state';
      this.logger.error(message);
      throw new BadRequestException(message);
    }

    const { title, prosemirrorJson } =
      this.extractTitleAndRemoveHeading(prosemirrorState);

    const pageTitle = title || fileName;

    if (prosemirrorJson) {
      try {
        const pagePosition = await this.getNewPagePosition(spaceId);

        // 1. Создаём страницу (без yjsSnapshot)
        createdPage = await this.pageRepo.insertPage({
          slugId: generateSlugId(),
          title: pageTitle,
          textContent: jsonToText(prosemirrorJson),
          position: pagePosition.toString(),
          spaceId: spaceId,
          creatorId: userId,
          workspaceId: workspaceId,
          lastUpdatedById: userId,
        });

        // 2. Создаём блоки для этой страницы
        if (createdPage?.id) {
          const blocks = Array.isArray(prosemirrorJson?.content) ? prosemirrorJson.content : [];
          if (blocks.length > 0) {
            const { TiptapTransformer } = require('@hocuspocus/transformer');
            for (let i = 0; i < blocks.length; i++) {
              const blockContent = blocks[i];
              if (!blockContent || typeof blockContent.type !== 'string') continue;
              
              // Проверяем, не содержит ли блок несколько параграфов
              let contentToUse = blockContent;
              if (blockContent.type === 'doc' && Array.isArray(blockContent.content)) {
                const paragraphs = blockContent.content.filter(node => 
                  typeof node === 'object' && node !== null && node.type === 'paragraph'
                );
                if (paragraphs.length > 1) {
                  // Берем только первый параграф
                  contentToUse = {
                    ...blockContent,
                    content: [paragraphs[0]]
                  };
                  this.logger.debug(`Multiple paragraphs detected in imported block ${i}, using only first paragraph`);
                }
              }
              
              const ydoc = TiptapTransformer.toYdoc(contentToUse, 'default');
              const yjsSnapshot = Buffer.from(require('yjs').encodeStateAsUpdate(ydoc));
              await this.db
                .insertInto('blocks')
                .values({
                  pageId: createdPage.id,
                  blockType: contentToUse.type,
                  content: contentToUse,
                  position: i,
                  yjsSnapshot,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                })
                .execute();
            }
          }
        }

        this.logger.debug(
          `Successfully imported "${title}${fileExtension}. ID: ${createdPage.id} - SlugId: ${createdPage.slugId}"`
        );
      } catch (err) {
        const message = 'Error inserting page or blocks';
        this.logger.error(message, err);
        throw new BadRequestException(message);
      }
    }
  }

  private async processMarkdown(fileContent: string) {
    const prosemirrorState = await markdownToHtml(fileContent);
    return prosemirrorState;
  }

  private async processHTML(fileContent: string) {
    const prosemirrorState = await htmlToJson(fileContent);
    return prosemirrorState;
  }

  private extractTitleAndRemoveHeading(prosemirrorState: any) {
    const doc = prosemirrorState.doc;
    const title = doc.attrs.title || doc.attrs.heading;
    // Возвращаем оригинальный JSON, а не строку
    const prosemirrorJson = prosemirrorState;
    return { title, prosemirrorJson };
  }

  private async getNewPagePosition(spaceId: string) {
    const lastPage = await this.pageRepo.getLatestPageBySpaceId(spaceId);
    if (lastPage) {
      return generateJitteredKeyBetween(String(lastPage.position), String(lastPage.position));
    }
    return generateJitteredKeyBetween(null, null);
  }
}