// 提供创建用户以及查找用户的函数
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {

    constructor(
        @InjectRepository(User)
        private readonly userRepo : Repository<User>,

        // userRepo 是 TypeORM 提供的操作 users 表的工具
        // 可以调用 findOne、 save、 create等方法
    ){}

    // 根据用户名查找用户，登录时调用
    // 找不到返回null,找到返回完整的对象用户（包含密码哈希）
    async findByUserName(userName: string) : Promise<User | null>{
        return this.userRepo.findOne({where:{userName}});
    }

    // 创建新用户，注册时调用
    // hashedPassword是由bcrypt加密之后的密码
    async createUser(userName: string, hasedPassword: string):
    Promise<User> {
        const user = this.userRepo.create({
            userName,
            password: hasedPassword,
        });
        return this.userRepo.save(user);
    }

}