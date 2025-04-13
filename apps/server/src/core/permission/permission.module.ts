import { Module } from '@nestjs/common';
import { PermissionController } from './permission.controller';
import { PermissionAbilityFactory } from '../casl/abilities/permission-ability.factory';
import { PermissionRepo } from '@docmost/db/repos/permissions/permissions.repo';
import { PermissionService } from './services/permission.service';

@Module({
  controllers: [PermissionController],
  providers: [PermissionService, PermissionRepo],
  exports: [PermissionService, PermissionRepo],
})
export class PermissionModule {}
