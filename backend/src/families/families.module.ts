import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { FamilyTree } from './families.entity'
import {FamiliesController } from './families.controller'
import { FamiliesService } from './families.service'
@Module({
    imports: [
        TypeOrmModule.forFeature([FamilyTree]), //注册FamilyTree实体
        AuthModule,                             // 引入AuthModule使用 JwtAuthGuard
    ],
    controllers: [FamiliesController],
    providers: [FamiliesService],
    exports: [FamiliesService],
})
export class FamiliesModule {}
