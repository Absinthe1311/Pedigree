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
    ConfigModule.forRoot({ isGlobal: true}),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: false,
    }),
    AuthModule,
    UsersModule,
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
