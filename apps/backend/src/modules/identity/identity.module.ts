// =====================================================
// 域 1: identity - 用户/部门管理
// =====================================================

import { Module } from '@nestjs/common';

import { AuthModule } from '../../common/auth/auth.module';

import { DepartmentsController } from './departments.controller';
import { DepartmentsService } from './departments.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';


@Module({
  imports: [AuthModule],
  controllers: [UsersController, DepartmentsController],
  providers: [UsersService, DepartmentsService],
  exports: [UsersService, DepartmentsService],
})
export class IdentityModule {}