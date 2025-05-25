import { Module } from '@nestjs/common';
import { PageService } from './services/page.service';
import { PageController } from './page.controller';
import { PageHistoryService } from './services/page-history.service';
import { PageMemberService } from './services/page-member.service';
import { SynchronizedPageService } from './services/synchronized-page.service';
import { SynchronizedPageRepo } from '@docmost/db/repos/page/synchronized_page.repo';
import { BlockPermissionService } from './services/block-permission.service';
import { PageBlocksService } from './services/page-blocks.service';
import { KyselyProvider } from '../../database/kysely.provider';
import { DatabaseModule } from '@docmost/db/database.module';
@Module({
  imports:[DatabaseModule],
  controllers: [PageController],
  providers: [
    KyselyProvider,
    PageBlocksService,
    PageService,
    PageHistoryService,
    PageMemberService,
    SynchronizedPageService,
    BlockPermissionService,
  ],
  exports: [
    PageBlocksService,
    KyselyProvider,
    PageService,
    PageHistoryService,
    PageMemberService,
    SynchronizedPageService,
    BlockPermissionService,
  ],
})
export class PageModule {}
