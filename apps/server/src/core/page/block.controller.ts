import { Body, Controller, Get, NotFoundException, Param, UseGuards, Post, Req } from "@nestjs/common"
import { ShadowBlockGuard } from "src/common/guards/shadow-block.guard"
import { PageService } from "./services/page.service"



@Controller()
export class BlockController {
  constructor(private readonly pageService: PageService) {}

  @Get('block/:blockId')
  @UseGuards(ShadowBlockGuard)
  async getSharedBlock(
    @Param('blockId') blockId: string,
    @Req() req: any,
  ) {
    const block = await this.pageService.getBlockById(blockId)
    if (!block) throw new NotFoundException()
    return { block, permission: req.shadow.p, showMeta: req.shadow.sm }
  }
}

