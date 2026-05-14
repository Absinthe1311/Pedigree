import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Collab } from './collab.entity';
import { FamilyTree } from '../families/families.entity';
import { AuthModule } from '../auth/auth.module';
import {User} from '../users/user.entity'
import {CollabService} from './collab.service'
import { CollabController } from './collab.controller';

@Module({
    imports:[
        TypeOrmModule.forFeature([Collab, FamilyTree, User]),
        AuthModule,
    ],
    controllers: [CollabController],
    providers: [CollabService],
})
export class CollabModule {}
