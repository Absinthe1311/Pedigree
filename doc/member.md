# Pedigree · Members 模块完整开发指南

> 技术栈：NestJS（后端）· React + TypeScript（前端）· PostgreSQL · JWT  
> 适用环境：WSL2 Ubuntu 22.04  
> 前置条件：Auth 模块 + Families 模块已完成并测试通过  
> 文档版本：v1.0

---

## 一、文件总览

开发 Members 模块需要创建以下文件：

```
backend/src/
├── app.module.ts                         ← 根模块（需修改，添加 MembersModule）
│
└── members/
    ├── dto/
    │   ├── create-member.dto.ts          ← 定义创建成员请求的数据格式
    │   └── update-member.dto.ts          ← 定义修改成员请求的数据格式
    ├── member.entity.ts                  ← 数据库 members 表的 TypeScript 映射
    ├── members.service.ts                ← 核心业务逻辑（增删改查 + 模糊搜索 + 权限控制）
    ├── members.controller.ts             ← HTTP 路由入口
    └── members.module.ts                 ← 组装所有 members 相关文件

frontend/src/
├── api/
│   └── members.ts                        ← 封装成员相关的 API 请求函数
└── pages/
    └── MemberPage/
        └── index.tsx                     ← 成员管理页（查看、新建、编辑、删除、搜索）
```

---

## 二、每个文件的作用说明

### 后端文件

| 文件 | 作用 | 类比理解 |
|------|------|----------|
| `member.entity.ts` | 把数据库的 `members` 表映射成 TypeScript 类 | 数据库表的"翻译官" |
| `create-member.dto.ts` | 定义创建成员时前端必须/可以传的字段 | 入户申请表的"模板" |
| `update-member.dto.ts` | 定义修改成员时可以传的字段（全部可选） | 信息修改表的"模板" |
| `members.service.ts` | 核心文件：增删改查成员，模糊搜索姓名，校验用户对族谱的访问权限 | 业务的"大脑" |
| `members.controller.ts` | 定义 HTTP 路由，所有接口都需要登录后才能访问 | 前台"接待员" |
| `members.module.ts` | 把上述所有文件组装在一起，并引入 FamiliesModule 做权限复用 | 模块的"组织架构图" |

### 前端文件

| 文件 | 作用 |
|------|------|
| `api/members.ts` | 封装所有成员相关的 API 调用，统一管理请求 |
| `MemberPage/index.tsx` | 展示某个族谱下的成员列表，支持新建、编辑、删除、模糊搜索 |

---

## 三、接口设计总览

所有接口均需要在请求头携带 JWT Token（由 `client.ts` 的拦截器自动完成）。  
所有接口的路径均以 `/families/:treeId/members` 为前缀，表示"某个族谱下的成员"。

| 方法 | 路径 | 说明 | 权限要求 |
|------|------|------|----------|
| POST | `/families/:treeId/members` | 在指定族谱中新增成员 | 已登录 + 是族谱创建者 |
| GET | `/families/:treeId/members` | 获取族谱内所有成员（支持按姓名模糊搜索） | 已登录 + 是族谱创建者 |
| GET | `/families/:treeId/members/:memberId` | 获取单个成员详情 | 已登录 + 是族谱创建者 |
| PATCH | `/families/:treeId/members/:memberId` | 修改成员信息 | 已登录 + 是族谱创建者 |
| DELETE | `/families/:treeId/members/:memberId` | 删除成员 | 已登录 + 是族谱创建者 |

---

## 四、开发顺序与完整代码

> **原则：永远先写后端，用 Postman 测试通过后再写前端。**

---

### Step 1：创建 Member 实体

**文件路径：** `backend/src/members/member.entity.ts`

**作用：** TypeORM 通过这个类知道数据库里有一张 `members` 表，以及表里有哪些字段。

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FamilyTree } from '../families/family.entity';

@Entity('members')    // 对应数据库中名为 members 的表
export class Member {

  @PrimaryGeneratedColumn({ name: 'member_id' })
  memberId: number;

  // 外键：关联到 family_trees 表的 tree_id
  @Column({ name: 'tree_id' })
  treeId: number;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 10, nullable: true })
  gender: string;     // '男' | '女' | 'unknown'

  @Column({ type: 'date', nullable: true })
  birth: string;      // 格式：'YYYY-MM-DD'

  @Column({ type: 'date', nullable: true })
  death: string;      // 格式：'YYYY-MM-DD'，在世成员为 null

  @Column({ type: 'text', nullable: true })
  bio: string;        // 人物简介

  // 父亲的 member_id，自引用外键
  @Column({ name: 'father_id', nullable: true })
  fatherId: number;

  // 母亲的 member_id，自引用外键
  @Column({ name: 'mother_id', nullable: true })
  motherId: number;

  @Column({ nullable: true })
  generation: number;  // 世代，第1代、第2代……

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;
}
```

**注意事项：**
- `fatherId` / `motherId` 是自引用外键，指向同一张 `members` 表，用来构建父子关系
- `birth` / `death` 使用 `'date'` 类型，TypeORM 会将其映射为字符串（`'YYYY-MM-DD'`）
- `gender` 使用字符串而非枚举，方便扩展，业务层校验合法值

---

### Step 2：创建 DTO 数据格式定义

**文件路径：** `backend/src/members/dto/create-member.dto.ts`

**作用：** 规定创建成员接口接收的请求体字段。`name` 为必填，其余均为可选。

```typescript
export class CreateMemberDto {
  name: string;          // 必填：姓名
  gender?: string;       // 可选：'男' | '女' | 'unknown'
  birth?: string;        // 可选：出生日期，格式 'YYYY-MM-DD'
  death?: string;        // 可选：死亡日期，格式 'YYYY-MM-DD'
  bio?: string;          // 可选：人物简介
  fatherId?: number;     // 可选：父亲的 memberId
  motherId?: number;     // 可选：母亲的 memberId
  generation?: number;   // 可选：世代数
}
```

**文件路径：** `backend/src/members/dto/update-member.dto.ts`

**作用：** 规定修改成员接口接收的请求体格式。所有字段均为可选，只传需要修改的字段。

```typescript
export class UpdateMemberDto {
  name?: string;
  gender?: string;
  birth?: string;
  death?: string;
  bio?: string;
  fatherId?: number;
  motherId?: number;
  generation?: number;
}
```

---

### Step 3：创建 MembersService（核心业务逻辑）

**文件路径：** `backend/src/members/members.service.ts`

**作用：** 实现成员的增删改查与模糊搜索，所有写操作前均需校验当前用户是否是该族谱的创建者。

```typescript
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Member } from './member.entity';
import { FamiliesService } from '../families/families.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

@Injectable()
export class MembersService {

  constructor(
    @InjectRepository(Member)
    private readonly memberRepo: Repository<Member>,

    // 复用 FamiliesService 的 findOne 方法来做权限校验
    private readonly familiesService: FamiliesService,
  ) {}

  // ── 校验用户对族谱的访问权限（内部辅助方法）─────────────
  // 直接调用 FamiliesService.findOne，若用户无权访问则会抛出 403
  private async verifyFamilyAccess(treeId: number, userId: number) {
    await this.familiesService.findOne(treeId, userId);
  }

  // ── 创建成员 ─────────────────────────────────────────────
  async create(
    treeId: number,
    dto: CreateMemberDto,
    userId: number,
  ): Promise<Member> {
    await this.verifyFamilyAccess(treeId, userId);

    const member = this.memberRepo.create({
      treeId,
      ...dto,
    });
    return this.memberRepo.save(member);
  }

  // ── 查询族谱内所有成员（支持姓名模糊搜索）──────────────
  async findAll(
    treeId: number,
    userId: number,
    name?: string,   // 可选的搜索关键字
  ): Promise<Member[]> {
    await this.verifyFamilyAccess(treeId, userId);

    return this.memberRepo.find({
      where: {
        treeId,
        // 如果传了 name 参数，则模糊匹配；否则查全部
        ...(name ? { name: Like(`%${name}%`) } : {}),
      },
      order: { generation: 'ASC', name: 'ASC' },
    });
  }

  // ── 查询单个成员详情 ────────────────────────────────────
  async findOne(
    treeId: number,
    memberId: number,
    userId: number,
  ): Promise<Member> {
    await this.verifyFamilyAccess(treeId, userId);

    const member = await this.memberRepo.findOne({
      where: { memberId, treeId },
    });

    if (!member) {
      throw new NotFoundException('成员不存在');
    }

    return member;
  }

  // ── 修改成员信息 ─────────────────────────────────────────
  async update(
    treeId: number,
    memberId: number,
    dto: UpdateMemberDto,
    userId: number,
  ): Promise<Member> {
    // findOne 内部已做权限校验，复用即可
    const member = await this.findOne(treeId, memberId, userId);

    // 只更新传入的字段
    Object.assign(member, dto);

    return this.memberRepo.save(member);
  }

  // ── 删除成员 ─────────────────────────────────────────────
  async remove(
    treeId: number,
    memberId: number,
    userId: number,
  ): Promise<{ message: string }> {
    const member = await this.findOne(treeId, memberId, userId);

    await this.memberRepo.remove(member);

    return { message: '成员已删除' };
  }
}
```

**权限设计说明：**
```
所有操作
  → 先调用 verifyFamilyAccess(treeId, userId)
  → 内部调用 FamiliesService.findOne，若非创建者则抛出 403
  → 通过则继续执行成员操作

复用 FamiliesService 的好处：
  权限逻辑集中在 Families 模块，Members 不重复实现，
  后续 Collab 模块上线后只需修改 FamiliesService.findOne，
  Members 模块的权限逻辑自动跟随更新。
```

---

### Step 4：创建 MembersController（路由）

**文件路径：** `backend/src/members/members.controller.ts`

**作用：** 定义 HTTP 接口，路由嵌套在 `/families/:treeId/members` 下，体现成员从属于族谱的层级关系。

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { MembersService } from './members.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { JwtAuthGuard } from '../auth/auth.guard';

@Controller('families/:treeId/members')
@UseGuards(JwtAuthGuard)   // 整个 Controller 所有接口都需要登录
export class MembersController {

  constructor(private readonly membersService: MembersService) {}

  // POST /families/:treeId/members
  // 在指定族谱中新增成员
  @Post()
  create(
    @Param('treeId', ParseIntPipe) treeId: number,
    @Body() dto: CreateMemberDto,
    @Request() req,
  ) {
    return this.membersService.create(treeId, dto, req.user.userId);
  }

  // GET /families/:treeId/members?name=张
  // 获取族谱内所有成员，可选传 name 参数进行模糊搜索
  @Get()
  findAll(
    @Param('treeId', ParseIntPipe) treeId: number,
    @Query('name') name: string,   // 从 URL 查询参数中读取，如 ?name=张
    @Request() req,
  ) {
    return this.membersService.findAll(treeId, req.user.userId, name);
  }

  // GET /families/:treeId/members/:memberId
  // 获取单个成员详情
  @Get(':memberId')
  findOne(
    @Param('treeId', ParseIntPipe) treeId: number,
    @Param('memberId', ParseIntPipe) memberId: number,
    @Request() req,
  ) {
    return this.membersService.findOne(treeId, memberId, req.user.userId);
  }

  // PATCH /families/:treeId/members/:memberId
  // 修改成员信息
  @Patch(':memberId')
  update(
    @Param('treeId', ParseIntPipe) treeId: number,
    @Param('memberId', ParseIntPipe) memberId: number,
    @Body() dto: UpdateMemberDto,
    @Request() req,
  ) {
    return this.membersService.update(treeId, memberId, dto, req.user.userId);
  }

  // DELETE /families/:treeId/members/:memberId
  // 删除成员
  @Delete(':memberId')
  remove(
    @Param('treeId', ParseIntPipe) treeId: number,
    @Param('memberId', ParseIntPipe) memberId: number,
    @Request() req,
  ) {
    return this.membersService.remove(treeId, memberId, req.user.userId);
  }
}
```

---

### Step 5：创建 MembersModule（组装）

**文件路径：** `backend/src/members/members.module.ts`

**作用：** 把 Member 实体、MembersService、MembersController 组装在一起，并引入 FamiliesModule 以复用其权限校验逻辑。

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Member } from './member.entity';
import { MembersService } from './members.service';
import { MembersController } from './members.controller';
import { AuthModule } from '../auth/auth.module';
import { FamiliesModule } from '../families/families.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Member]),  // 注册 Member 实体
    AuthModule,                           // 引入 AuthModule 才能使用 JwtAuthGuard
    FamiliesModule,                       // 引入 FamiliesModule 才能注入 FamiliesService
  ],
  controllers: [MembersController],
  providers: [MembersService],
  exports: [MembersService],   // 导出，供后续 marriages、query 模块使用
})
export class MembersModule {}
```

> **注意：** FamiliesModule 的 `exports` 中必须包含 `FamiliesService`（已在 Families 模块开发时完成），否则这里的注入会报错。

---

### Step 6：修改根模块 AppModule

**文件路径：** `backend/src/app.module.ts`

**作用：** 将 MembersModule 注册到应用根模块。

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { FamiliesModule } from './families/families.module';
import { MembersModule } from './members/members.module';   // 新增

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

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
    MembersModule,   // 新增
  ],
})
export class AppModule {}
```

---

### Step 7：用 Postman 测试后端

**启动后端：**

```bash
cd ~/Pedigree/backend
sudo service postgresql start
npm run start:dev
```

**前置准备：登录并创建一个族谱**

```
1. POST /auth/login
   Body：{ "userName": "testuser", "password": "Test@1234" }
   → 复制 access_token，存入 Postman 环境变量 token

2. POST /families
   Authorization: Bearer {{token}}
   Body：{ "treeName": "张氏族谱", "surname": "张" }
   → 记录返回的 treeId（假设为 1），存入环境变量 treeId
```

---

#### 测试 7.1：新增成员（基础信息）

```
方法：POST
URL：http://localhost:3000/families/{{treeId}}/members
Authorization：Bearer {{token}}
Body（raw JSON）：
{
  "name": "张大山",
  "gender": "男",
  "birth": "1950-03-15",
  "generation": 1
}

期望响应（201）：
{
  "memberId": 1,
  "treeId": 1,
  "name": "张大山",
  "gender": "男",
  "birth": "1950-03-15",
  "death": null,
  "bio": null,
  "fatherId": null,
  "motherId": null,
  "generation": 1,
  "createTime": "...",
  "updateTime": "..."
}
```

在 Tests 脚本中自动保存 memberId：

```javascript
pm.test("状态码为 201", () => pm.response.to.have.status(201));
pm.test("返回 memberId", () => {
    const json = pm.response.json();
    pm.expect(json).to.have.property("memberId");
    pm.environment.set("memberId", json.memberId);
});
```

---

#### 测试 7.2：新增成员（含父子关联）

```
方法：POST
URL：http://localhost:3000/families/{{treeId}}/members
Authorization：Bearer {{token}}
Body：
{
  "name": "张小山",
  "gender": "男",
  "birth": "1980-06-20",
  "generation": 2,
  "fatherId": {{memberId}}
}

期望响应（201）：返回的 fatherId 与上一步的 memberId 一致
```

---

#### 测试 7.3：获取全部成员

```
方法：GET
URL：http://localhost:3000/families/{{treeId}}/members
Authorization：Bearer {{token}}

期望响应（200）：包含两条记录的数组，按 generation ASC 排序
```

---

#### 测试 7.4：姓名模糊搜索

```
方法：GET
URL：http://localhost:3000/families/{{treeId}}/members?name=小
Authorization：Bearer {{token}}

期望响应（200）：只返回"张小山"，不返回"张大山"
```

---

#### 测试 7.5：获取单个成员详情

```
方法：GET
URL：http://localhost:3000/families/{{treeId}}/members/{{memberId}}
Authorization：Bearer {{token}}

期望响应（200）：张大山的完整信息
```

---

#### 测试 7.6：修改成员信息

```
方法：PATCH
URL：http://localhost:3000/families/{{treeId}}/members/{{memberId}}
Authorization：Bearer {{token}}
Body：
{
  "bio": "族谱第一代，生于四川，务农为生。",
  "death": "2020-11-01"
}

期望响应（200）：bio 和 death 字段已更新，其余字段不变
```

---

#### 测试 7.7：删除成员

```
方法：DELETE
URL：http://localhost:3000/families/{{treeId}}/members/{{memberId}}
Authorization：Bearer {{token}}

期望响应（200）：{ "message": "成员已删除" }

再次 GET /families/{{treeId}}/members/{{memberId}}
→ 期望返回 404 Not Found
```

---

#### 测试 7.8：异常测试用例

| 测试名称 | 方法 | URL | 说明 | 预期状态码 |
|----------|------|-----|------|------------|
| 无 Token 访问 | GET | `/families/1/members` | 不加 Authorization | `401` |
| 访问他人族谱的成员 | GET | `/families/1/members` | 换另一个账号的 Token | `403` |
| 族谱不存在 | GET | `/families/99999/members` | treeId 不存在 | `403` 或 `404` |
| 成员不存在 | GET | `/families/{{treeId}}/members/99999` | memberId 不存在 | `404` |
| treeId 非数字 | GET | `/families/abc/members` | ParseIntPipe 拦截 | `400` |
| memberId 非数字 | GET | `/families/1/members/abc` | ParseIntPipe 拦截 | `400` |
| 缺少必填字段 | POST | `/families/{{treeId}}/members` | Body 中不传 `name` | `400` 或 `500` |

五项主流程测试全部通过后，再开始写前端。

---

### Step 8：前端——封装成员 API

**文件路径：** `frontend/src/api/members.ts`

**作用：** 把所有成员相关的 HTTP 请求封装成独立函数，页面组件直接调用，不用关心请求细节。

```typescript
import client from './client';

// 成员对象的 TypeScript 类型定义
export interface Member {
  memberId: number;
  treeId: number;
  name: string;
  gender: string | null;
  birth: string | null;
  death: string | null;
  bio: string | null;
  fatherId: number | null;
  motherId: number | null;
  generation: number | null;
  createTime: string;
  updateTime: string;
}

export interface CreateMemberData {
  name: string;
  gender?: string;
  birth?: string;
  death?: string;
  bio?: string;
  fatherId?: number;
  motherId?: number;
  generation?: number;
}

export interface UpdateMemberData {
  name?: string;
  gender?: string;
  birth?: string;
  death?: string;
  bio?: string;
  fatherId?: number;
  motherId?: number;
  generation?: number;
}

// 新增成员
export const createMember = (treeId: number, data: CreateMemberData) =>
  client.post<Member>(`/families/${treeId}/members`, data).then((res) => res.data);

// 获取成员列表（可选姓名关键字）
export const getMembers = (treeId: number, name?: string) =>
  client
    .get<Member[]>(`/families/${treeId}/members`, { params: name ? { name } : {} })
    .then((res) => res.data);

// 获取单个成员详情
export const getMember = (treeId: number, memberId: number) =>
  client.get<Member>(`/families/${treeId}/members/${memberId}`).then((res) => res.data);

// 修改成员
export const updateMember = (treeId: number, memberId: number, data: UpdateMemberData) =>
  client
    .patch<Member>(`/families/${treeId}/members/${memberId}`, data)
    .then((res) => res.data);

// 删除成员
export const deleteMember = (treeId: number, memberId: number) =>
  client
    .delete<{ message: string }>(`/families/${treeId}/members/${memberId}`)
    .then((res) => res.data);
```

---

### Step 9：前端——成员管理页面

**文件路径：** `frontend/src/pages/MemberPage/index.tsx`

**作用：** 展示某个族谱内的成员列表，支持新建成员、编辑成员信息、删除成员、姓名模糊搜索。

```typescript
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  getMembers,
  createMember,
  updateMember,
  deleteMember,
  Member,
  CreateMemberData,
} from '../../api/members';

// 空的新建表单初始值
const EMPTY_FORM: CreateMemberData = {
  name: '',
  gender: '',
  birth: '',
  death: '',
  bio: '',
  generation: undefined,
  fatherId: undefined,
  motherId: undefined,
};

export default function MemberPage() {
  // 从 URL 参数中读取 treeId（路由：/families/:treeId/members）
  const { treeId } = useParams<{ treeId: string }>();
  const numericTreeId = Number(treeId);

  // 成员列表
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  // 搜索
  const [searchName, setSearchName] = useState('');

  // 新建/编辑表单
  const [showForm, setShowForm]     = useState(false);
  const [editingId, setEditingId]   = useState<number | null>(null); // null 表示新建
  const [form, setForm]             = useState<CreateMemberData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // 页面加载时拉取成员列表
  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async (name?: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await getMembers(numericTreeId, name);
      setMembers(data);
    } catch {
      setError('加载成员列表失败，请刷新重试');
    } finally {
      setLoading(false);
    }
  };

  // 搜索（回车或点击搜索按钮时触发）
  const handleSearch = () => {
    loadMembers(searchName.trim() || undefined);
  };

  // 打开新建表单
  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  // 打开编辑表单（回填当前成员数据）
  const handleOpenEdit = (member: Member) => {
    setEditingId(member.memberId);
    setForm({
      name:       member.name,
      gender:     member.gender ?? '',
      birth:      member.birth ?? '',
      death:      member.death ?? '',
      bio:        member.bio ?? '',
      generation: member.generation ?? undefined,
      fatherId:   member.fatherId ?? undefined,
      motherId:   member.motherId ?? undefined,
    });
    setShowForm(true);
  };

  // 提交表单（新建或编辑）
  const handleSubmit = async () => {
    if (!form.name.trim()) {
      alert('姓名不能为空');
      return;
    }
    setSubmitting(true);

    // 清理空字符串为 undefined，避免覆盖数据库中的 null
    const payload = Object.fromEntries(
      Object.entries(form).filter(([, v]) => v !== '' && v !== undefined),
    ) as CreateMemberData;

    try {
      if (editingId === null) {
        // 新建
        const newMember = await createMember(numericTreeId, payload);
        setMembers([...members, newMember]);
      } else {
        // 编辑
        const updated = await updateMember(numericTreeId, editingId, payload);
        setMembers(members.map((m) => (m.memberId === editingId ? updated : m)));
      }
      setShowForm(false);
    } catch (err: any) {
      alert(err.response?.data?.message || '操作失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  // 删除成员
  const handleDelete = async (member: Member) => {
    if (!window.confirm(`确定要删除成员"${member.name}"吗？`)) return;
    try {
      await deleteMember(numericTreeId, member.memberId);
      setMembers(members.filter((m) => m.memberId !== member.memberId));
    } catch (err: any) {
      alert(err.response?.data?.message || '删除失败');
    }
  };

  // ── 渲染 ─────────────────────────────────────────────────
  if (loading) return <div style={{ padding: 32 }}>加载中...</div>;

  return (
    <div style={{ maxWidth: 900, margin: '40px auto', padding: '0 16px' }}>

      {/* 页头 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>成员管理</h2>
        <button onClick={handleOpenCreate}>+ 新增成员</button>
      </div>

      {/* 搜索栏 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="按姓名搜索…"
          style={{ flex: 1, padding: 8, border: '1px solid #ddd', borderRadius: 4 }}
        />
        <button onClick={handleSearch}>搜索</button>
        {searchName && (
          <button onClick={() => { setSearchName(''); loadMembers(); }}>
            清除
          </button>
        )}
      </div>

      {/* 新建/编辑表单 */}
      {showForm && (
        <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 24 }}>
          <h3 style={{ marginTop: 0 }}>{editingId === null ? '新增成员' : '编辑成员'}</h3>

          {[
            { label: '姓名 *', key: 'name', placeholder: '例：张大山' },
            { label: '性别', key: 'gender', placeholder: '男 / 女 / unknown' },
            { label: '出生日期', key: 'birth', placeholder: 'YYYY-MM-DD' },
            { label: '死亡日期', key: 'death', placeholder: 'YYYY-MM-DD（在世留空）' },
            { label: '世代', key: 'generation', placeholder: '数字，如 1' },
            { label: '父亲 ID', key: 'fatherId', placeholder: '父亲的 memberId' },
            { label: '母亲 ID', key: 'motherId', placeholder: '母亲的 memberId' },
          ].map(({ label, key, placeholder }) => (
            <div key={key} style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4 }}>{label}</label>
              <input
                value={(form as any)[key] ?? ''}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                placeholder={placeholder}
                style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}
              />
            </div>
          ))}

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>人物简介</label>
            <textarea
              value={form.bio ?? ''}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="简要描述生平、职业、事迹等"
              rows={3}
              style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSubmit} disabled={submitting}>
              {submitting ? '提交中...' : editingId === null ? '确认新增' : '保存修改'}
            </button>
            <button onClick={() => setShowForm(false)}>取消</button>
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* 成员列表 */}
      {members.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#999', padding: 48 }}>
          还没有成员，点击"新增成员"开始录入
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              {['ID', '姓名', '性别', '出生', '死亡', '世代', '操作'].map((h) => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid #eee' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.memberId} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '10px 12px', color: '#999' }}>{m.memberId}</td>
                <td style={{ padding: '10px 12px', fontWeight: 500 }}>{m.name}</td>
                <td style={{ padding: '10px 12px' }}>{m.gender ?? '—'}</td>
                <td style={{ padding: '10px 12px' }}>{m.birth ?? '—'}</td>
                <td style={{ padding: '10px 12px' }}>{m.death ?? '在世'}</td>
                <td style={{ padding: '10px 12px' }}>{m.generation != null ? `第 ${m.generation} 代` : '—'}</td>
                <td style={{ padding: '10px 12px' }}>
                  <button onClick={() => handleOpenEdit(m)} style={{ marginRight: 8 }}>编辑</button>
                  <button onClick={() => handleDelete(m)} style={{ color: 'red', borderColor: 'red' }}>删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

---

### Step 10：更新前端路由

**文件路径：** `frontend/src/App.tsx`

添加成员管理页的路由：

```typescript
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import FamilyListPage from './pages/FamilyListPage';
import MemberPage from './pages/MemberPage';   // 新增

export default function App() {
  return (
    <Routes>
      <Route path="/"          element={<Navigate to="/login" replace />} />
      <Route path="/login"     element={<LoginPage />} />
      <Route path="/register"  element={<RegisterPage />} />
      <Route path="/dashboard" element={<FamilyListPage />} />
      <Route path="/families/:treeId/members" element={<MemberPage />} />   {/* 新增 */}
    </Routes>
  );
}
```

此时 `FamilyListPage` 中的"进入管理"按钮（`navigate('/families/${id}/members')`）将正确跳转到成员管理页，无需修改。

---

## 五、完整测试清单

### 后端测试（Postman）

- [ ] 无 Token 访问任意 members 接口返回 401
- [ ] POST `/families/:treeId/members` 成功创建，返回包含 memberId 的对象
- [ ] POST 时传入 fatherId，返回的 fatherId 与传入值一致
- [ ] GET `/families/:treeId/members` 返回当前族谱的成员数组
- [ ] GET 时传入 `?name=小`，只返回姓名中含"小"的成员
- [ ] GET 时不传 name 参数，返回全部成员
- [ ] GET `/families/:treeId/members/:memberId` 成功返回对应成员
- [ ] 用其他账号的 Token 访问该族谱的成员返回 403
- [ ] PATCH 成功修改，响应中对应字段已更新，未传字段保持不变
- [ ] DELETE 成功删除，再次 GET 该成员返回 404
- [ ] 在 PostgreSQL 里确认数据变更：`SELECT * FROM members;`

### 前端测试（浏览器）

- [ ] 从族谱列表点击"进入管理"，正确跳转到成员管理页
- [ ] 成员列表正常展示，字段显示正确（在世成员 death 列显示"在世"）
- [ ] 点击"新增成员"展开表单，填写后点击"确认新增"，新成员出现在列表中
- [ ] 点击"编辑"按钮，表单正确回填当前成员数据
- [ ] 保存编辑后，列表中对应行数据即时更新
- [ ] 搜索框输入姓名后回车或点击"搜索"，列表过滤正确
- [ ] 点击"清除"后，搜索框清空并恢复完整列表
- [ ] 点击"删除"弹出确认框，确认后成员从列表消失
- [ ] 删除所有成员后显示空状态提示

---

## 六、常见错误及解决方法

| 错误信息 | 原因 | 解决方法 |
|----------|------|----------|
| `401 Unauthorized` | Token 未携带或已过期 | 重新登录，确认 Postman 环境变量 `token` 已更新 |
| `403 Forbidden` | 当前用户不是该族谱的创建者 | 用创建该族谱的账号登录 |
| `404 Not Found` | 成员不存在或 memberId 传错 | 检查 memberId 是否正确 |
| `Cannot find module '../families/families.service'` | FamiliesModule 未导出 FamiliesService | 检查 `families.module.ts` 的 `exports` 数组 |
| `Member is not a known entity` | MembersModule 未注册 Member 实体 | 检查 `TypeOrmModule.forFeature([Member])` |
| `Nest can't resolve dependencies of MembersService` | FamiliesModule 未在 MembersModule 的 imports 中引入 | 在 `members.module.ts` 的 `imports` 添加 `FamiliesModule` |
| 前端搜索无效果 | `?name=` 参数传了空字符串 | 搜索前用 `.trim()` 处理，空字符串时不传 name 参数 |

---

## 七、目录结构速查

完成所有步骤后，项目结构应该是：

```
Pedigree/
├── backend/
│   └── src/
│       ├── app.module.ts             ← Step 6 修改（添加 MembersModule）
│       ├── auth/                     ← 已完成
│       ├── users/                    ← 已完成
│       ├── families/                 ← 已完成
│       └── members/
│           ├── dto/
│           │   ├── create-member.dto.ts   ← Step 2
│           │   └── update-member.dto.ts   ← Step 2
│           ├── member.entity.ts           ← Step 1
│           ├── members.service.ts         ← Step 3
│           ├── members.controller.ts      ← Step 4
│           └── members.module.ts          ← Step 5
│
└── frontend/
    └── src/
        ├── App.tsx                   ← Step 10 修改（添加 /families/:treeId/members 路由）
        ├── api/
        │   ├── client.ts             ← 已完成
        │   ├── families.ts           ← 已完成
        │   └── members.ts            ← Step 8（新增）
        └── pages/
            ├── LoginPage/            ← 已完成
            ├── RegisterPage/         ← 已完成
            ├── FamilyListPage/       ← 已完成
            └── MemberPage/
                └── index.tsx         ← Step 9（新增）
```

---

## 八、下一步：Marriages 模块

Members 模块完成后，按以下顺序继续开发：

```
1. Marriages 模块 → 管理成员间的婚姻关系（member1_id < member2_id 保证唯一）
                    接口路径：/families/:treeId/marriages
                    每次操作前同样需要校验用户对族谱的访问权限

2. Query 模块    → 祖先链路查询（递归向上遍历 fatherId / motherId）
                   后代查询（递归向下遍历）
                   亲缘路径查询（BFS/DFS 找两人之间的最短路径）
                   结合 D3.js 以树状图展示查询结果

3. Collab 模块   → 邀请他人协作编辑族谱
                   完成后修改 FamiliesService.findOne 的权限逻辑，
                   让受邀者也能访问，Members 模块权限自动跟随更新
```

---

*文档版本：v1.0 · 模块：Members · 项目：Pedigree · 环境：WSL2 Ubuntu 22.04*
