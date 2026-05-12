import { Module } from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { FamiliesModule } from '../families/families.module';
import { MembersModule } from '../members/members.module';
import {Marriage} from './marriages.entity';
import {MarriagesController} from './marriages.controller';
import {MarriagesService } from './marriages.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([Marriage]), //注册Marriage实体
        AuthModule,
        FamiliesModule,
        MembersModule,
    ],
    controllers:[MarriagesController],
    providers:[MarriagesService],
    exports:[MarriagesService]
})
export class MarriagesModule {}
