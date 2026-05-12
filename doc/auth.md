# Pedigree · Auth 模块完整开发指南

> 技术栈：NestJS（后端）· React + TypeScript（前端）· PostgreSQL · JWT · bcrypt  
> 适用环境：WSL2 Ubuntu 22.04  
> 文档版本：v1.0

---

## 一、文件总览

开发 Auth 模块需要创建以下文件，按层级分布如下：

```
backend/src/
├── app.module.ts                   ← 根模块（需修改）
│
├── users/
│   ├── user.entity.ts              ← 数据库 users 表的 TypeScript 映射
│   ├── users.service.ts            ← 提供查询/创建用户的方法
│   └── users.module.ts             ← 注册 entity 和 service
│
└── auth/
    ├── dto/
    │   ├── register.dto.ts         ← 定义注册请求的数据格式
    │   └── login.dto.ts            ← 定义登录请求的数据格式
    ├── jwt.strategy.ts             ← 告诉 NestJS 如何验证 JWT Token
    ├── auth.guard.ts               ← 保护需要登录的接口
    ├── auth.service.ts             ← 核心业务逻辑（注册 + 登录）
    ├── auth.controller.ts          ← HTTP 路由入口
    └── auth.module.ts              ← 组装所有 auth 相关文件

frontend/src/
├── api/
│   └── client.ts                   ← axios 封装，自动携带 Token
├── pages/
│   ├── LoginPage/
│   │   └── index.tsx               ← 登录页面
│   └── RegisterPage/
│       └── index.tsx               ← 注册页面
└── App.tsx                         ← 路由配置（需修改）
```

---

## 二、每个文件的作用说明

### 后端文件

| 文件 | 作用 | 类比理解 |
|------|------|----------|
| `user.entity.ts` | 把数据库的 `users` 表映射成 TypeScript 类，TypeORM 通过它读写数据库 | 数据库表的"翻译官" |
| `users.service.ts` | 提供两个方法：按用户名查用户、创建新用户 | 专门和数据库打交道的"仓库管理员" |
| `users.module.ts` | 把 entity 和 service 注册到 NestJS，并导出给 auth 模块使用 | 给仓库管理员办"上岗证" |
| `register.dto.ts` | 定义注册时前端必须传的字段格式（userName + password） | 注册申请表的"模板" |
| `login.dto.ts` | 定义登录时前端必须传的字段格式 | 登录申请表的"模板" |
| `jwt.strategy.ts` | 定义验证 Token 的规则，Token 验证通过后提取 userId 注入请求 | Token 的"验票员" |
| `auth.guard.ts` | 一个守卫，加在接口上，未登录用户访问时自动返回 401 | 接口的"保安" |
| `auth.service.ts` | 核心文件：实现注册逻辑（查重→加密→存库）和登录逻辑（查用户→验密码→签发Token） | 业务的"大脑" |
| `auth.controller.ts` | 定义 HTTP 路由：POST /auth/register 和 POST /auth/login | 前台"接待员" |
| `auth.module.ts` | 把上述所有文件组装在一起，让 NestJS 认识这个模块 | 模块的"组织架构图" |

### 前端文件

| 文件 | 作用 |
|------|------|
| `api/client.ts` | 封装 axios，配置基础 URL，并自动在每次请求头里加上 JWT Token |
| `LoginPage/index.tsx` | 登录表单页面，提交后调用登录接口，成功则存储 Token 并跳转主页 |
| `RegisterPage/index.tsx` | 注册表单页面，提交后调用注册接口，成功则跳转登录页 |
| `App.tsx` | 配置页面路由，决定哪个路径显示哪个页面 |

---

## 三、开发顺序与完整代码

> **原则：永远先写后端，用 Postman 测试通过后再写前端。**  
> 后端每一层都依赖上一层，必须按顺序进行。

---

### Step 1：创建 User 实体

**文件路径：** `backend/src/users/user.entity.ts`

**作用：** TypeORM 通过这个类知道数据库里有一张 `users` 表，以及表里有哪些字段。

```typescript
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('users')          // 对应数据库中名为 users 的表
export class User {

  @PrimaryGeneratedColumn({ name: 'user_id' })
  userId: number;           // 对应 user_id 列，自增主键

  @Column({ name: 'user_name', unique: true, length: 50 })
  userName: string;         // 对应 user_name 列，唯一约束

  @Column({ length: 255 })
  password: string;         // 存储加密后的密码，永远不存明文
}
```

**注意事项：**
- `@Entity('users')` 括号里的字符串必须和数据库表名完全一致
- `name: 'user_id'` 是因为数据库列名用下划线，而 TypeScript 变量名用驼峰，需要手动映射
- `password` 字段存的永远是 bcrypt 哈希值，不是用户输入的原始密码

---

### Step 2：创建 UsersService

**文件路径：** `backend/src/users/users.service.ts`

**作用：** 提供两个方法供 AuthService 调用——查找用户和创建用户。所有数据库操作集中在这里。

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    // userRepo 是 TypeORM 提供的操作 users 表的工具
    // 可以调用 findOne、save、create 等方法
  ) {}

  // 根据用户名查找用户，登录时调用
  // 找不到时返回 null，找到时返回完整用户对象（包含密码哈希）
  async findByUserName(userName: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { userName } });
  }

  // 创建新用户，注册时调用
  // hashedPassword 是已经由 bcrypt 加密过的密码
  async createUser(userName: string, hashedPassword: string): Promise<User> {
    const user = this.userRepo.create({
      userName,
      password: hashedPassword,
    });
    return this.userRepo.save(user);  // save 会执行 INSERT SQL
  }
}
```

---

### Step 3：创建 UsersModule

**文件路径：** `backend/src/users/users.module.ts`

**作用：** 把 User 实体和 UsersService 注册到 NestJS 系统，并将 UsersService 导出给其他模块（主要是 AuthModule）使用。

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),  // 告诉 TypeORM 这个模块要用 User 实体
  ],
  providers: [UsersService],           // 注册服务
  exports: [UsersService],             // 导出，让 AuthModule 可以注入使用
})
export class UsersModule {}
```

**关键点：** `exports` 里必须有 `UsersService`，否则 AuthModule 无法使用它。

---

### Step 4：创建 DTO 数据格式定义

**文件路径：** `backend/src/auth/dto/register.dto.ts`

**作用：** 规定注册接口接收的请求体必须包含哪些字段。Controller 用它来接收和验证前端传来的数据。

```typescript
export class RegisterDto {
  userName: string;   // 用户名
  password: string;   // 密码（明文，后端会加密）
}
```

**文件路径：** `backend/src/auth/dto/login.dto.ts`

```typescript
export class LoginDto {
  userName: string;
  password: string;
}
```

**说明：** DTO（Data Transfer Object）是数据传输对象，相当于一个数据格式的约定。前端发送的 JSON 必须符合这个格式，否则 TypeScript 会报类型错误。

---

### Step 5：创建 JWT 验证策略

**文件路径：** `backend/src/auth/jwt.strategy.ts`

**作用：** 定义如何从请求中提取并验证 JWT Token。每次有请求携带 Token 时，这里的 `validate` 方法会被自动调用。

```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {

  constructor() {
    super({
      // 从请求头的 Authorization: Bearer <token> 里提取 token
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,         // 过期的 Token 会被拒绝
      secretOrKey: process.env.JWT_SECRET,  // 用于验证签名的密钥
    });
  }

  // Token 签名验证通过后，这个方法被调用
  // payload 是 Token 里存的数据（登录时我们存了 sub 和 userName）
  // 返回值会被注入到 request.user 中，供 Controller 使用
  async validate(payload: { sub: number; userName: string }) {
    return { userId: payload.sub, userName: payload.userName };
  }
}
```

**数据流说明：**
```
请求到达 → 提取 Authorization 头里的 Token
         → 用 JWT_SECRET 验证签名
         → 解码 payload（{ sub: 1, userName: "alice" }）
         → 调用 validate()，返回 { userId: 1, userName: "alice" }
         → 注入到 request.user
         → Controller 里可以用 @Request() req 拿到 req.user
```

---

### Step 6：创建 JWT 守卫

**文件路径：** `backend/src/auth/auth.guard.ts`

**作用：** 用 `@UseGuards(JwtAuthGuard)` 装饰器保护接口。未登录用户（没有 Token 或 Token 无效）访问时，自动返回 401 Unauthorized，不会进入 Controller 逻辑。

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  // 直接继承 passport-jwt 守卫，无需额外逻辑
  // 'jwt' 对应的就是 JwtStrategy 里注册的策略名称
}
```

**使用方式（在其他 Controller 里）：**

```typescript
@UseGuards(JwtAuthGuard)    // 加这一行，该接口就需要登录才能访问
@Get('profile')
getProfile(@Request() req) {
  return req.user;           // { userId: 1, userName: "alice" }
}
```

---

### Step 7：创建 AuthService（核心业务逻辑）

**文件路径：** `backend/src/auth/auth.service.ts`

**作用：** 实现注册和登录的完整业务逻辑，是整个 Auth 模块最核心的文件。

```typescript
import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  // ── 注册逻辑 ────────────────────────────────────────────
  async register(dto: RegisterDto) {

    // 第一步：检查用户名是否已被占用
    const existing = await this.usersService.findByUserName(dto.userName);
    if (existing) {
      // ConflictException 会自动返回 HTTP 409 状态码
      throw new ConflictException('用户名已存在');
    }

    // 第二步：用 bcrypt 加密密码
    // 10 是加密轮数（cost factor），数字越大越慢越安全，10 是推荐值
    // bcrypt 会自动生成随机盐值并混入哈希结果，所以每次结果都不同
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // 第三步：写入数据库
    const user = await this.usersService.createUser(
      dto.userName,
      hashedPassword,
    );

    // 第四步：返回成功信息（不返回密码字段）
    return {
      message: '注册成功',
      userId: user.userId,
    };
  }

  // ── 登录逻辑 ────────────────────────────────────────────
  async login(dto: LoginDto) {

    // 第一步：根据用户名查找用户
    const user = await this.usersService.findByUserName(dto.userName);
    if (!user) {
      // 注意：不要说"用户名不存在"，而是说"用户名或密码错误"
      // 这样可以防止攻击者探测哪些用户名已被注册
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 第二步：验证密码
    // bcrypt.compare 会把用户输入的明文和数据库里的哈希值对比
    // 内部自动处理盐值提取，直接返回 true/false
    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 第三步：签发 JWT Token
    // sub 是 JWT 标准字段，表示主题（通常存用户ID）
    const payload = {
      sub: user.userId,
      userName: user.userName,
    };
    const token = this.jwtService.sign(payload);

    // 第四步：返回 Token 给前端
    return { token };
  }
}
```

**注册流程总结：**
```
接收 { userName, password }
  → 查数据库：用户名是否已存在？
  → 存在 → 抛出 409 错误
  → 不存在 → bcrypt.hash(password, 10) 得到哈希值
  → INSERT INTO users (user_name, password) VALUES (...)
  → 返回 { message: "注册成功", userId: 1 }
```

**登录流程总结：**
```
接收 { userName, password }
  → 查数据库：SELECT * FROM users WHERE user_name = ?
  → 找不到 → 抛出 401 错误
  → 找到 → bcrypt.compare(明文密码, 数据库哈希值)
  → 不匹配 → 抛出 401 错误
  → 匹配 → jwtService.sign({ sub: userId, userName })
  → 返回 { token: "eyJ..." }
```

---

### Step 8：创建 AuthController（路由）

**文件路径：** `backend/src/auth/auth.controller.ts`

**作用：** 定义 HTTP 接口的路径和方法，接收前端请求并转交给 AuthService 处理。

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')         // 所有路由前缀为 /auth
export class AuthController {

  constructor(private readonly authService: AuthService) {}

  // POST /auth/register
  // @Body() 自动把请求体的 JSON 解析并映射到 RegisterDto 类型
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // POST /auth/login
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
```

**接口说明：**

| 方法 | 路径 | 请求体 | 成功响应 | 失败响应 |
|------|------|--------|----------|----------|
| POST | /auth/register | `{ "userName": "alice", "password": "123456" }` | `{ "message": "注册成功", "userId": 1 }` | 409 用户名已存在 |
| POST | /auth/login | `{ "userName": "alice", "password": "123456" }` | `{ "token": "eyJ..." }` | 401 用户名或密码错误 |

---

### Step 9：创建 AuthModule（组装所有文件）

**文件路径：** `backend/src/auth/auth.module.ts`

**作用：** 把 AuthController、AuthService、JwtStrategy、JwtAuthGuard 组装在一起，并引入所需的外部模块（UsersModule、JwtModule）。

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './auth.guard';

@Module({
  imports: [
    UsersModule,          // 引入 UsersModule，才能注入 UsersService
    PassportModule,       // Passport 认证框架
    JwtModule.register({
      secret: process.env.JWT_SECRET,           // 签名密钥，来自 .env 文件
      signOptions: {
        expiresIn: process.env.JWT_EXPIRES_IN,  // Token 有效期，如 "7d"
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard],
  exports: [JwtAuthGuard],   // 导出守卫，让其他模块可以直接使用
})
export class AuthModule {}
```

---

### Step 10：修改根模块 AppModule

**文件路径：** `backend/src/app.module.ts`

**作用：** 将 AuthModule 和 UsersModule 注册到应用根模块，NestJS 启动时才会加载这些模块。

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // 加载 .env 文件，isGlobal 让所有模块都可以用 process.env
    ConfigModule.forRoot({ isGlobal: true }),

    // 数据库连接配置
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      // 自动扫描所有 .entity.ts 文件
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      // false 表示不自动修改数据库结构（我们用手写 SQL 管理表结构）
      synchronize: false,
    }),

    AuthModule,    // 注册认证模块
    UsersModule,   // 注册用户模块
  ],
})
export class AppModule {}
```

---

### Step 11：用 Postman 测试后端

**在继续写前端之前，必须先确认后端接口正常工作。**

启动后端：

```bash
cd ~/Pedigree/backend
sudo service postgresql start
npm run start:dev
# 看到 Application is running on: http://[::1]:3000 即成功
```

**测试注册接口：**

```
方法：POST
URL：http://localhost:3000/auth/register
Headers：Content-Type: application/json
Body（raw JSON）：
{
  "userName": "alice",
  "password": "123456"
}

期望响应（200）：
{
  "message": "注册成功",
  "userId": 1
}
```

**测试重复注册（应返回 409）：**

```
再次发送相同的注册请求
期望响应（409）：
{
  "statusCode": 409,
  "message": "用户名已存在"
}
```

**测试登录接口：**

```
方法：POST
URL：http://localhost:3000/auth/login
Body：
{
  "userName": "alice",
  "password": "123456"
}

期望响应（200）：
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**测试密码错误（应返回 401）：**

```
Body：{ "userName": "alice", "password": "wrong" }
期望响应（401）：
{
  "statusCode": 401,
  "message": "用户名或密码错误"
}
```

三个测试全部通过后，再开始写前端。

---

### Step 12：前端——封装 API 请求

**文件路径：** `frontend/src/api/client.ts`

**作用：** 统一管理所有 HTTP 请求，自动注入 Token，统一处理 401 错误。

```typescript
import axios from 'axios';

const client = axios.create({
  baseURL: 'http://localhost:3000',  // 后端地址
  timeout: 10000,                    // 10 秒超时
});

// 请求拦截器：每次发请求前自动在 Header 里加上 Token
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：统一处理 401（Token 失效或未登录）
client.interceptors.response.use(
  (response) => response,      // 正常响应直接返回
  (error) => {
    if (error.response?.status === 401) {
      // Token 失效，清除本地存储并跳转到登录页
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default client;
```

---

### Step 13：前端——注册页面

**文件路径：** `frontend/src/pages/RegisterPage/index.tsx`

**作用：** 用户填写用户名和密码，提交后调用注册接口，成功后跳转到登录页。

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';

export default function RegisterPage() {
  const navigate = useNavigate();

  // 表单状态
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async () => {
    // 简单的前端验证
    if (!userName || !password) {
      setError('用户名和密码不能为空');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await client.post('/auth/register', { userName, password });
      // 注册成功，跳转到登录页
      navigate('/login');
    } catch (err: any) {
      // 从后端错误响应里提取错误信息
      setError(err.response?.data?.message || '注册失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: '100px auto', padding: '0 16px' }}>
      <h2>注册账号</h2>

      <div style={{ marginBottom: 12 }}>
        <label>用户名</label>
        <input
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          style={{ display: 'block', width: '100%', padding: 8, marginTop: 4 }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label>密码</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ display: 'block', width: '100%', padding: 8, marginTop: 4 }}
        />
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{ width: '100%', padding: 10, marginTop: 8 }}
      >
        {loading ? '注册中...' : '注册'}
      </button>

      <p style={{ marginTop: 16, textAlign: 'center' }}>
        已有账号？
        <span
          onClick={() => navigate('/login')}
          style={{ color: 'blue', cursor: 'pointer' }}
        >
          去登录
        </span>
      </p>
    </div>
  );
}
```

---

### Step 14：前端——登录页面

**文件路径：** `frontend/src/pages/LoginPage/index.tsx`

**作用：** 用户填写用户名和密码，提交后调用登录接口，成功后把 Token 存入 localStorage 并跳转主页。

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';

export default function LoginPage() {
  const navigate = useNavigate();

  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async () => {
    if (!userName || !password) {
      setError('用户名和密码不能为空');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await client.post('/auth/login', { userName, password });

      // 把 Token 存到 localStorage
      // 之后每次 API 请求，client.ts 里的拦截器会自动带上它
      localStorage.setItem('token', res.data.token);

      // 登录成功，跳转到主页面
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || '登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: '100px auto', padding: '0 16px' }}>
      <h2>登录</h2>

      <div style={{ marginBottom: 12 }}>
        <label>用户名</label>
        <input
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          style={{ display: 'block', width: '100%', padding: 8, marginTop: 4 }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label>密码</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ display: 'block', width: '100%', padding: 8, marginTop: 4 }}
        />
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{ width: '100%', padding: 10, marginTop: 8 }}
      >
        {loading ? '登录中...' : '登录'}
      </button>

      <p style={{ marginTop: 16, textAlign: 'center' }}>
        没有账号？
        <span
          onClick={() => navigate('/register')}
          style={{ color: 'blue', cursor: 'pointer' }}
        >
          去注册
        </span>
      </p>
    </div>
  );
}
```

---

### Step 15：配置前端路由

**文件路径：** `frontend/src/App.tsx`

**作用：** 定义 URL 路径和页面组件的对应关系。

```typescript
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

export default function App() {
  return (
    <Routes>
      {/* 根路径重定向到登录页 */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* 后续开发中逐步添加其他页面 */}
      {/* <Route path="/dashboard" element={<DashboardPage />} /> */}
    </Routes>
  );
}
```

确认 `frontend/src/main.tsx` 已经包含 `BrowserRouter`（第一阶段已配置）：

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
```

---

## 四、完整测试清单

前后端都启动后（后端 :3000，前端 :5173），按以下顺序验证：

### 后端测试（Postman）

- [ ] POST /auth/register 返回 `{ message: "注册成功", userId: 1 }`
- [ ] 重复注册同一用户名返回 409
- [ ] POST /auth/login 返回 `{ token: "eyJ..." }`
- [ ] 密码错误返回 401
- [ ] 在 PostgreSQL 里 `SELECT * FROM users;` 能看到刚注册的用户
- [ ] 数据库里的 password 字段是哈希值（不是明文 "123456"）

### 前端测试（浏览器）

- [ ] 访问 `http://localhost:5173` 自动跳转到 `/login`
- [ ] 点击"去注册"跳转到注册页面
- [ ] 填写用户名和密码，点击注册，成功后跳转到登录页
- [ ] 用刚注册的账号登录，成功后跳转到 `/dashboard`（暂时是空页面）
- [ ] 打开浏览器 DevTools → Application → Local Storage，可以看到存储的 token
- [ ] 用错误密码登录，页面显示"用户名或密码错误"

---

## 五、常见错误及解决方法

| 错误信息 | 原因 | 解决方法 |
|----------|------|----------|
| `Cannot connect to database` | PostgreSQL 没有启动 | `sudo service postgresql start` |
| `relation "users" does not exist` | 数据库表还没创建 | 执行 `schema.sql` 建表 |
| `JWT_SECRET is not defined` | `.env` 文件不存在或未加载 | 检查 `backend/.env` 文件内容 |
| `401 Unauthorized` 但密码正确 | Token 过期或格式错误 | 重新登录获取新 Token |
| `409 Conflict` | 用户名已存在 | 换一个用户名注册 |
| CORS 错误（前端请求被拒绝） | 后端没有配置跨域 | 在 `main.ts` 里加 `app.enableCors()` |

### 解决 CORS 问题

如果前端请求后端时浏览器报 CORS 错误，编辑 `backend/src/main.ts`：

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();   // 开发阶段允许所有来源，生产环境需要配置具体域名
  await app.listen(3000);
}
bootstrap();
```

---

## 六、目录结构速查

完成所有步骤后，你的项目结构应该是：

```
Pedigree/
├── backend/
│   ├── .env                          ← 环境变量（不提交到 git）
│   └── src/
│       ├── app.module.ts             ← Step 10 修改
│       ├── main.ts                   ← CORS 配置
│       ├── auth/
│       │   ├── dto/
│       │   │   ├── register.dto.ts   ← Step 4
│       │   │   └── login.dto.ts      ← Step 4
│       │   ├── jwt.strategy.ts       ← Step 5
│       │   ├── auth.guard.ts         ← Step 6
│       │   ├── auth.service.ts       ← Step 7
│       │   ├── auth.controller.ts    ← Step 8
│       │   └── auth.module.ts        ← Step 9
│       └── users/
│           ├── user.entity.ts        ← Step 1
│           ├── users.service.ts      ← Step 2
│           └── users.module.ts       ← Step 3
│
└── frontend/
    └── src/
        ├── App.tsx                   ← Step 15 修改
        ├── main.tsx                  ← 已配置 BrowserRouter
        ├── api/
        │   └── client.ts             ← Step 12
        └── pages/
            ├── LoginPage/
            │   └── index.tsx         ← Step 14
            └── RegisterPage/
                └── index.tsx         ← Step 13
```

---

*文档版本：v1.0 · 模块：Auth · 项目：Pedigree*