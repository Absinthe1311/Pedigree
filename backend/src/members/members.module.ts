import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Member } from './members.entity'
import { FamiliesModule } from '../families/families.module';
import { MembersController } from './members.controller';
import { MembersService } from './members.service'

@Module({
    imports:[
        TypeOrmModule.forFeature([Member]), //注册member
        AuthModule, // 引入AuthModule来使用JwtAuthGuard
        FamiliesModule, // 引入FamiliesModule来使用里面的FamiliesService
    ],
    controllers: [MembersController],
    providers: [MembersService],
    exports:[MembersService],
})
export class MembersModule {}
