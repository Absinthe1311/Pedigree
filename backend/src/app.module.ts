import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { FamiliesModule } from './families/families.module';
import { MembersModule } from './members/members.module';
import { QueryModule } from './query/query.module';
import { MarriagesModule } from './marriages/marriages.module';
import { CollabModule } from './collab/collab.module';

@Module({
  imports: [
    // 加载.env文件，isGlobal让所有的模块都可以使用process.env
    ConfigModule.forRoot({ isGlobal: true}),

    // 数据库连接配置
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      // 自动扫描所有的 .entity.ts文件
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      // false表示不自动修改数据库结构
      synchronize: false,
    }),

    AuthModule, // 注册认证模块
    UsersModule, // 注册用户模块
    FamiliesModule,
    MembersModule,
    QueryModule,
    MarriagesModule,
    CollabModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
