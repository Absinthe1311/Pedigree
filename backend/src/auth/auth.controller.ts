// 定义http接口的路径和方法，接收前端请求并转交给AuthService处理
import { Controller, Post, Body } from '@nestjs/common';
import {AuthService} from './auth.service';
import {RegisterDto } from './dto/register.dto';
import {LoginDto} from './dto/login.dto';

@Controller('auth') //所有路由前缀为/auth
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    // POST /auth/register
    // @Body()自动把请求体的JSON解析并映射到RegisterDto类型
    @Post('register')
    register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }

    // POST /auth/login
    @Post('login')
    login(@Body() dto: LoginDto){
        return this.authService.login(dto);
    }
}

