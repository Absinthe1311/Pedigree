// 用@UseGuards(JwtAuthGuard)装饰器保护接口。未登录用户（没有Token或者Token无效）
// 访问时，自动返回401 Unauthorized，不会进入Controller逻辑
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    // 直接继承passport-jwt守卫，无需额外逻辑
}