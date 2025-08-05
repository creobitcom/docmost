import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import {
  InsertablePageMember,
  InsertableSpaceMember,
  PageMember,
  SpaceMember,
  UpdatablePageMember,
  UpdatableSpaceMember,
} from '@docmost/db/types/entity.types';
import { PaginationOptions } from '../../pagination/pagination-options';
import { MemberInfo, UserPageRole } from './types';
import { executeWithPagination } from '@docmost/db/pagination/pagination';
import { GroupRepo } from '@docmost/db/repos/group/group.repo';
import { PageRepo } from './page.repo';

@Injectable()
export class PageMemberRepo {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly groupRepo: GroupRepo,
    private readonly pageRepo: PageRepo,
  ) {}

  async insertPageMember(
    insertablePageMember: InsertablePageMember,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .insertInto('page_members')
      .values(insertablePageMember)
      .returningAll()
      .execute();
  }

  /*
   * we want to get a user's role in a space.
   * they user can be a member either directly or via a group
   * we will pass the user id and space id to return the user's roles
   * if the user is a member of the space via multiple groups
   * if the user has no space permission it should return an empty array,
   * maybe we should throw an exception?
   */
  async getUserPageRoles(
    userId: string,
    pageId: string,
  ): Promise<UserPageRole[]> {
    const roles = await this.db
      .selectFrom('page_members')
      .select(['userId', 'role'])
      .where('userId', '=', userId)
      .where('pageId', '=', pageId)
      .unionAll(
        this.db
          .selectFrom('page_members')
          .innerJoin('groupUsers', 'groupUsers.groupId', 'page_members.groupId')
          .select(['groupUsers.userId', 'page_members.role'])
          .where('groupUsers.userId', '=', userId)
          .where('page_members.pageId', '=', pageId),
      )
      .execute();

    if (!roles || roles.length === 0) {
      return undefined;
    }
    return roles;
  }

  async getPageMembersPaginated(pageId: string, pagination: PaginationOptions) {
    let query = this.db
      .selectFrom('page_members')
      .leftJoin('users', 'users.id', 'page_members.userId')
      .leftJoin('groups', 'groups.id', 'page_members.groupId')
      .select([
        'users.id as userId',
        'users.name as userName',
        'users.avatarUrl as userAvatarUrl',
        'users.email as userEmail',
        'groups.id as groupId',
        'groups.name as groupName',
        'groups.isDefault as groupIsDefault',
        'page_members.role',
        'page_members.createdAt',
      ])
      .select((eb) => this.groupRepo.withMemberCount(eb))
      .where('page_members.pageId', '=', pageId)
      .orderBy('page_members.createdAt', 'asc');

    if (pagination.query) {
      query = query.where((eb) =>
        eb('users.name', 'ilike', `%${pagination.query}%`).or(
          'groups.name',
          'ilike',
          `%${pagination.query}%`,
        ),
      );
    }

    const result = await executeWithPagination(query, {
      page: pagination.page,
      perPage: pagination.limit,
    });

    let memberInfo: MemberInfo;

    const members = result.items.map((member) => {
      if (member.userId) {
        memberInfo = {
          id: member.userId,
          name: member.userName,
          email: member.userEmail,
          avatarUrl: member.userAvatarUrl,
          type: 'user',
        };
      } else if (member.groupId) {
        memberInfo = {
          id: member.groupId,
          name: member.groupName,
          memberCount: member.memberCount as number,
          isDefault: member.groupIsDefault,
          type: 'group',
        };
      }

      return {
        ...memberInfo,
        role: member.role,
        createdAt: member.createdAt,
      };
    });

    result.items = members as any;

    return result;
  }

  async roleCountByPageId(role: string, pageId: string): Promise<number> {
    const { count } = await this.db
      .selectFrom('page_members')
      .select((eb) => eb.fn.count('role').as('count'))
      .where('role', '=', role)
      .where('pageId', '=', pageId)
      .executeTakeFirst();

    return count as number;
  }

  async updatePageMember(
    updatablePageMember: UpdatablePageMember,
    pageMemberId: string,
    pageId: string,
  ): Promise<void> {
    await this.db
      .updateTable('page_members')
      .set(updatablePageMember)
      .where('id', '=', pageMemberId)
      .where('pageId', '=', pageId)
      .execute();
  }

  async getPageMemberByTypeId(
    pageId: string,
    opts: {
      userId?: string;
      groupId?: string;
    },
    trx?: KyselyTransaction,
  ): Promise<PageMember> {
    const db = dbOrTx(this.db, trx);
    let query = db
      .selectFrom('page_members')
      .selectAll()
      .where('pageId', '=', pageId);
    if (opts.userId) {
      query = query.where('userId', '=', opts.userId);
    } else if (opts.groupId) {
      query = query.where('groupId', '=', opts.groupId);
    } else {
      throw new BadRequestException('Please provide a userId or groupId');
    }
    return query.executeTakeFirst();
  }

  async removePageMemberById(
    memberId: string,
    pageId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('page_members')
      .where('id', '=', memberId)
      .where('pageId', '=', pageId)
      .execute();
  }
}
