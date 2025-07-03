import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { InjectKysely } from 'nestjs-kysely'
import { KyselyDB } from '@docmost/db/types/kysely.types'
import jwt from 'jsonwebtoken'

@Injectable()
export class ShadowBlockGuard implements CanActivate {
  constructor(@InjectKysely() private db: KyselyDB) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest()
    const { blockId } = req.params
    const { t } = req.query

    if (!t) throw new ForbiddenException()

    try {
      const payload = jwt.verify(t as string, process.env.JWT_SECRET) as any
      if (payload.b !== blockId) throw new Error('block mismatch')
      req.shadow = payload
      return true
    } catch (e) {
      throw new ForbiddenException()
    }
  }
}
