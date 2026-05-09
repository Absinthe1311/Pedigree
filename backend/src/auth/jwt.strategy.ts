// 定义如何从请求中提取并验证 JWT Token。每次有请求携带Token时，这里的validate方法就会被调用
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {

    constructor() {
        super({
            // 从请求头的 Authorizationi: Bearer <token> 里提取token
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,    // 过期的token被拒绝
            secretOrKey: process.env.JWT_SECRET, // 用于验证签名的密钥
        });
    }

    // Token 签名验证通过后，这个方法被调用
    // payload是 Token里面存储的数据（登陆时我们村存了 sub和 userName)
    // 返回值会被注入到request.user中，供Controller使用
    async validate(payload: { sub: number; userName: string}) {
        return {userId: payload.sub, userName: payload.userName};
    }
}