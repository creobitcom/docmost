import { Global, Module } from '@nestjs/common';
import SpaceAbilityFactory from './abilities/space-ability.factory';
import WorkspaceAbilityFactory from './abilities/workspace-ability.factory';
import PageAbilityFactory from './abilities/page-ability.factory';
import { PermissionAbilityFactory } from './abilities/permission-ability.factory';

@Global()
@Module({
  providers: [
    WorkspaceAbilityFactory,
    SpaceAbilityFactory,
    PageAbilityFactory,
    PermissionAbilityFactory,
  ],
  exports: [
    WorkspaceAbilityFactory,
    SpaceAbilityFactory,
    PageAbilityFactory,
    PermissionAbilityFactory,
  ],
})
export class CaslModule {}
