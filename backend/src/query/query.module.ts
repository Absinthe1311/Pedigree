import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Member } from '../members/members.entity';
import { AuthModule } from '../auth/auth.module';
import { FamiliesModule } from '../families/families.module';
import {Marriage} from '../marriages/marriages.entity';
import {QueryController} from './query.controller';
import {QueryService} from './query.service';

@Module({
    imports:[
        TypeOrmModule.forFeature([Member, Marriage]),
        AuthModule,
        FamiliesModule,
    ],
    controllers: [QueryController],
    providers:[QueryService],
})
export class QueryModule {}
