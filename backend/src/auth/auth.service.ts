//实现注册和登录的完整业务逻辑，是整个Auth模块最核心的文件
import {
    Injectable,
    ConflictException,
    UnauthorizedException,
} from '@nestjs/common';
import {JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import {UsersService} from '../users/users.service';
import {RegisterDto} from './dto/register.dto';
import {LoginDto} from './dto/login.dto';
import { use } from 'passport';

@Injectable()
export class AuthService {

    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
    ){}

    // 注册逻辑
    async register(dto: RegisterDto) {
        // 第一步：检查用户名是否被占用
        const existing = await this.usersService.findByUserName(dto.userName);
        if(existing){
            // ConflictException 会自动返回 HTTP 409状态码
            throw new ConflictException('用户已存在');
        }

        //第二步：用 bcrypt 加密密码
        //10是加密轮数 bcrypt会自动生成随机盐值并混入哈希结果，所以每次结构都不同
        const hashedPassword = await bcrypt.hash(dto.password, 10);

        //第三步：写入数据库
        const user = await this.usersService.createUser(
            dto.userName,
            hashedPassword,
        );

        //第四步：返回成功信息（不返回密码字段)
        return {
            message:'注册成功',
            userId: user.userId,
        };
    }

    // 登录逻辑
    async login(dto: LoginDto) {
        // 第一步，根据用户名查找用户
        const user = await this.usersService.findByUserName(dto.userName);
        if(!user){
            //这里不应该提示用户不存在，可以说用户名或者密码错误
            throw new UnauthorizedException('用户名或者密码错误');
        }

        //第二步：验证密码
        // bcrypt.compare会把用户输入的明文和数据库的哈希值对比
        const isMatch = await bcrypt.compare(dto.password, user.password);
        if(!isMatch){
            throw new UnauthorizedException('用户名或密码错误');
        }

        //第三步，签发JWT Token
        //sub是JWT标准字段，表示主题（通常存用户ID）
        const payload = {
            sub:user.userId,
            userName: user.userName,
        };
        const token = this.jwtService.sign(payload);

        //第四步，返回token给前端
        return {token};
    }

}