import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {User} from './user.entity';
import { UsersService } from './users.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([User]), // 告诉 TypeORM 这个模块要使用User实体
    ],
    providers: [UsersService], // 注册服务
    exports: [UsersService], // 导出，让接下来的 AuthModule 可以注入使用
})
export class UsersModule {}
