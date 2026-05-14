# Pedigree · Collab 模块完整开发指南

> 技术栈：NestJS（后端）· React + TypeScript（前端）· PostgreSQL · JWT  
> 适用环境：WSL2 Ubuntu 22.04  
> 前置条件：Auth + Families + Members + Marriages + Query 模块已完成并测试通过  
> 文档版本：v1.0

---

## 一、文件总览

```
backend/src/
├── app.module.ts                          ← 根模块（需修改，添加 CollabModule）
│
└── collab/
    ├── dto/
    │   └── create-collab.dto.ts           ← 定义邀请请求的数据格式
    ├── collab.entity.ts                   ← 数据库 collab 表的 TypeScript 映射
    ├── collab.service.ts                  ← 核心业务逻辑（邀请、查询协作者、移除）
    ├── collab.controller.ts               ← HTTP 路由入口
    └── collab.module.ts                   ← 组装所有 collab 相关文件

frontend/src/
├── api/
│   └── collab.ts                          ← 封装协作相关的 API 请求函数
└── pages/
    └── CollabPage/
        └── index.tsx                      ← 协作管理页（查看协作者、邀请、移除）
```

---

## 二、数据库表结构回顾

```sql
CREATE TABLE IF NOT EXISTS collab(
    tree_id     INTEGER NOT NULL REFERENCES family_trees(tree_id) ON DELETE CASCADE,
    inviter_id  INTEGER NOT NULL REFERENCES users(user_id),
    invitee_id  INTEGER NOT NULL REFERENCES users(user_id),
    created_at  TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (tree_id, invitee_id)
);
```

关键设计点：

| 约束 | 含义 |
|------|------|
| `PRIMARY KEY (tree_id, invitee_id)` | 同一个族谱同一个用户只能被邀请一次 |
| `ON DELETE CASCADE` | 族谱删除时，所有协作记录自动清除 |
| 无 `status` 字段 | 邀请直接生效，无需对方确认 |
| `inviter_id` | 记录是谁发出的邀请，用于审计 |

---

## 三、接口设计总览

| 方法 | 路径 | 说明 | 权限要求 |
|------|------|------|----------|
| POST | `/families/:treeId/collab` | 邀请用户成为协作者 | 已登录 + 是族谱创建者 |
| GET | `/families/:treeId/collab` | 获取族谱所有协作者列表 | 已登录 + 是族谱创建者 |
| DELETE | `/families/:treeId/collab/:inviteeId` | 移除某个协作者 | 已登录 + 是族谱创建者 |
| GET | `/collab/mine` | 获取我被邀请参与的所有族谱 | 已登录（任何用户） |

> **权限说明：** 只有族谱创建者可以管理协作者（邀请/查看/移除）。协作者本人可以查看自己被邀请的族谱列表，但不能管理其他协作者。

---

## 四、完成 Collab 模块后必须修改的地方

Collab 模块的核心价值不只是管理邀请记录，**更重要的是修改 `FamiliesService.findOne` 的权限逻辑**，让受邀者也能访问族谱，从而使 Members、Marriages、Query 的权限校验自动跟随更新。

```
修改前：creatorId === userId → 允许访问，否则 403
修改后：creatorId === userId 或 collab 表中存在 (treeId, userId) → 允许访问，否则 403
```

这个修改在 **Step 3** 中完成。

---

## 五、开发顺序与完整代码

---

### Step 1：创建 Collab 实体

**文件路径：** `backend/src/collab/collab.entity.ts`

```typescript
import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('collab')
export class Collab {

  // 联合主键：tree_id + invitee_id
  @PrimaryColumn({ name: 'tree_id' })
  treeId: number;

  @PrimaryColumn({ name: 'invitee_id' })
  inviteeId: number;

  @Column({ name: 'inviter_id' })
  inviterId: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

**注意事项：**
- 联合主键使用两个 `@PrimaryColumn` 而不是 `@PrimaryGeneratedColumn`，因为主键是 `(tree_id, invitee_id)` 的组合
- `@CreateDateColumn` 对应数据库中的 `created_at`，数据库表中有这列所以可以保留

---

### Step 2：创建 DTO

**文件路径：** `backend/src/collab/dto/create-collab.dto.ts`

```typescript
export class CreateCollabDto {
  // 通过用户名邀请，比要求知道 userId 对用户更友好
  inviteeUserName: string;
}
```

> **为什么用 userName 而不是 userId？**  
> 让创建者输入被邀请人的用户名，和注册时使用的字段一致，用户体验更自然。Service 层根据 userName 查出对应的 userId 后再写入 collab 表。

---

### Step 3：修改 FamiliesService.findOne（重要）

**文件路径：** `backend/src/families/families.service.ts`

这是本模块最关键的改动。修改 `findOne` 方法，让受邀者也能通过权限校验。

由于 `FamiliesService` 需要查询 `collab` 表，需要注入 `Collab` 的 Repository。

首先修改 `families.module.ts`，注册 Collab 实体：

```typescript
// backend/src/families/families.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FamilyTree } from './family.entity';
import { Collab } from '../collab/collab.entity';        // 新增
import { FamiliesService } from './families.service';
import { FamiliesController } from './families.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FamilyTree, Collab]),   // 新增 Collab
    AuthModule,
  ],
  controllers: [FamiliesController],
  providers: [FamiliesService],
  exports: [FamiliesService],
})
export class FamiliesModule {}
```

然后修改 `families.service.ts` 中的 `findOne` 方法：

```typescript
// backend/src/families/families.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FamilyTree } from './family.entity';
import { Collab } from '../collab/collab.entity';          // 新增
import { CreateFamilyDto } from './dto/create-family.dto';
import { UpdateFamilyDto } from './dto/update-family.dto';

@Injectable()
export class FamiliesService {

  constructor(
    @InjectRepository(FamilyTree)
    private readonly familyRepo: Repository<FamilyTree>,

    @InjectRepository(Collab)                              // 新增
    private readonly collabRepo: Repository<Collab>,       // 新增
  ) {}

  // create / findAllByUser / update / remove 保持不变，省略……

  // ── 修改后的 findOne ────────────────────────────────────
  async findOne(treeId: number, userId: number): Promise<FamilyTree> {
    const family = await this.familyRepo.findOne({ where: { treeId } });

    if (!family) {
      throw new NotFoundException('族谱不存在');
    }

    // 是创建者 → 直接放行
    if (family.creatorId === userId) {
      return family;
    }

    // 不是创建者 → 检查是否是受邀协作者
    const collab = await this.collabRepo.findOne({
      where: { treeId, inviteeId: userId },
    });

    if (!collab) {
      throw new ForbiddenException('无权访问该族谱');
    }

    return family;
  }
}
```

**修改效果：** 由于 Members、Marriages、Query 模块的权限校验全部调用 `FamiliesService.findOne`，这一处修改完成后，受邀者自动获得对这三个模块的访问权限，**无需修改其他任何文件**。

---

### Step 4：创建 CollabService

**文件路径：** `backend/src/collab/collab.service.ts`

```typescript
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Collab } from './collab.entity';
import { FamilyTree } from '../families/family.entity';
import { User } from '../users/user.entity';
import { CreateCollabDto } from './dto/create-collab.dto';

@Injectable()
export class CollabService {

  constructor(
    @InjectRepository(Collab)
    private readonly collabRepo: Repository<Collab>,

    @InjectRepository(FamilyTree)
    private readonly familyRepo: Repository<FamilyTree>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  // ── 内部辅助：校验当前用户是族谱创建者 ──────────────────
  private async verifyCreator(treeId: number, userId: number): Promise<FamilyTree> {
    const family = await this.familyRepo.findOne({ where: { treeId } });
    if (!family) throw new NotFoundException('族谱不存在');
    if (family.creatorId !== userId) throw new ForbiddenException('仅族谱创建者可以管理协作者');
    return family;
  }

  // ── 邀请协作者 ───────────────────────────────────────────
  async invite(
    treeId: number,
    dto: CreateCollabDto,
    inviterId: number,
  ): Promise<Collab> {
    await this.verifyCreator(treeId, inviterId);

    // 根据用户名查找被邀请人
    const invitee = await this.userRepo.findOne({
      where: { userName: dto.inviteeUserName },
    });
    if (!invitee) {
      throw new NotFoundException(`用户 "${dto.inviteeUserName}" 不存在`);
    }

    // 不能邀请自己
    if (invitee.userId === inviterId) {
      throw new BadRequestException('不能邀请自己成为协作者');
    }

    // 检查是否已经邀请过
    const existing = await this.collabRepo.findOne({
      where: { treeId, inviteeId: invitee.userId },
    });
    if (existing) {
      throw new ConflictException(`用户 "${dto.inviteeUserName}" 已经是该族谱的协作者`);
    }

    const collab = this.collabRepo.create({
      treeId,
      inviterId,
      inviteeId: invitee.userId,
    });

    return this.collabRepo.save(collab);
  }

  // ── 获取族谱所有协作者 ───────────────────────────────────
  async findAll(treeId: number, userId: number): Promise<any[]> {
    await this.verifyCreator(treeId, userId);

    // 联表查询，返回协作者的用户名而不只是 ID
    const collabs = await this.collabRepo
      .createQueryBuilder('c')
      .leftJoin(User, 'invitee', 'invitee.user_id = c.invitee_id')
      .leftJoin(User, 'inviter', 'inviter.user_id = c.inviter_id')
      .select([
        'c.invitee_id     AS "inviteeId"',
        'c.inviter_id     AS "inviterId"',
        'c.created_at     AS "createdAt"',
        'invitee.user_name AS "inviteeUserName"',
        'inviter.user_name AS "inviterUserName"',
      ])
      .where('c.tree_id = :treeId', { treeId })
      .getRawMany();

    return collabs;
  }

  // ── 移除协作者 ───────────────────────────────────────────
  async remove(
    treeId: number,
    inviteeId: number,
    userId: number,
  ): Promise<{ message: string }> {
    await this.verifyCreator(treeId, userId);

    const collab = await this.collabRepo.findOne({
      where: { treeId, inviteeId },
    });
    if (!collab) {
      throw new NotFoundException('该用户不是此族谱的协作者');
    }

    await this.collabRepo.remove(collab);
    return { message: '协作者已移除' };
  }

  // ── 查询我被邀请参与的所有族谱 ──────────────────────────
  async findMine(userId: number): Promise<any[]> {
    const collabs = await this.collabRepo
      .createQueryBuilder('c')
      .leftJoin(FamilyTree, 'f', 'f.tree_id = c.tree_id')
      .leftJoin(User, 'inviter', 'inviter.user_id = c.inviter_id')
      .select([
        'f.tree_id      AS "treeId"',
        'f.tree_name    AS "treeName"',
        'f.surname      AS "surname"',
        'c.created_at   AS "createdAt"',
        'inviter.user_name AS "inviterUserName"',
      ])
      .where('c.invitee_id = :userId', { userId })
      .orderBy('c.created_at', 'DESC')
      .getRawMany();

    return collabs;
  }
}
```

---

### Step 5：创建 CollabController

**文件路径：** `backend/src/collab/collab.controller.ts`

```typescript
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CollabService } from './collab.service';
import { CreateCollabDto } from './dto/create-collab.dto';
import { JwtAuthGuard } from '../auth/auth.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class CollabController {

  constructor(private readonly collabService: CollabService) {}

  // POST /families/:treeId/collab
  // 邀请用户成为协作者（仅创建者可操作）
  @Post('families/:treeId/collab')
  invite(
    @Param('treeId', ParseIntPipe) treeId: number,
    @Body() dto: CreateCollabDto,
    @Request() req,
  ) {
    return this.collabService.invite(treeId, dto, req.user.userId);
  }

  // GET /families/:treeId/collab
  // 获取族谱所有协作者列表（仅创建者可操作）
  @Get('families/:treeId/collab')
  findAll(
    @Param('treeId', ParseIntPipe) treeId: number,
    @Request() req,
  ) {
    return this.collabService.findAll(treeId, req.user.userId);
  }

  // DELETE /families/:treeId/collab/:inviteeId
  // 移除某个协作者（仅创建者可操作）
  @Delete('families/:treeId/collab/:inviteeId')
  remove(
    @Param('treeId', ParseIntPipe) treeId: number,
    @Param('inviteeId', ParseIntPipe) inviteeId: number,
    @Request() req,
  ) {
    return this.collabService.remove(treeId, inviteeId, req.user.userId);
  }

  // GET /collab/mine
  // 获取我被邀请参与的所有族谱（任何已登录用户）
  @Get('collab/mine')
  findMine(@Request() req) {
    return this.collabService.findMine(req.user.userId);
  }
}
```

---

### Step 6：创建 CollabModule

**文件路径：** `backend/src/collab/collab.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Collab } from './collab.entity';
import { FamilyTree } from '../families/family.entity';
import { User } from '../users/user.entity';
import { CollabService } from './collab.service';
import { CollabController } from './collab.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    // 直接注入三个 Repository，不引入其他模块避免循环依赖
    TypeOrmModule.forFeature([Collab, FamilyTree, User]),
    AuthModule,
  ],
  controllers: [CollabController],
  providers: [CollabService],
})
export class CollabModule {}
```

> **为什么不引入 FamiliesModule 和 UsersModule？**  
> CollabService 只需要直接查询 `family_trees` 和 `users` 表，不需要复用它们的业务逻辑。直接注入 Repository 可以避免 FamiliesModule ↔ CollabModule 之间的循环依赖（因为 FamiliesModule 已经注入了 Collab 实体）。

---

### Step 7：修改根模块 AppModule

**文件路径：** `backend/src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { FamiliesModule } from './families/families.module';
import { MembersModule } from './members/members.module';
import { MarriagesModule } from './marriages/marriages.module';
import { QueryModule } from './query/query.module';
import { CollabModule } from './collab/collab.module';   // 新增

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
    MembersModule,
    MarriagesModule,
    QueryModule,
    CollabModule,   // 新增
  ],
})
export class AppModule {}
```

---

### Step 8：用 Postman 测试后端

**前置准备：准备两个账号**

```
账号 A（创建者）：userName: "alice"，已创建族谱 treeId=1
账号 B（被邀请人）：userName: "bob"，已注册但未与该族谱关联
```

---

#### 测试 8.1：邀请协作者

```
方法：POST
URL：http://localhost:3000/families/{{treeId}}/collab
Authorization：Bearer {{tokenA}}（alice 的 token）
Body（raw JSON）：
{
  "inviteeUserName": "bob"
}

期望响应（201）：
{
  "treeId": 1,
  "inviteeId": 2,
  "inviterId": 1,
  "createdAt": "..."
}
```

Tests 脚本：
```javascript
pm.test("状态码为 201", () => pm.response.to.have.status(201));
pm.test("inviteeId 正确", () => {
    const json = pm.response.json();
    pm.expect(json).to.have.property("inviteeId");
    pm.environment.set("inviteeId", json.inviteeId);
});
```

---

#### 测试 8.2：受邀者访问族谱成员（验证权限扩展生效）

```
方法：GET
URL：http://localhost:3000/families/{{treeId}}/members
Authorization：Bearer {{tokenB}}（bob 的 token）

邀请前：期望返回 403 Forbidden
邀请后：期望返回 200，成员列表正常返回

这是验证 FamiliesService.findOne 修改是否生效的关键测试。
```

---

#### 测试 8.3：获取协作者列表

```
方法：GET
URL：http://localhost:3000/families/{{treeId}}/collab
Authorization：Bearer {{tokenA}}

期望响应（200）：
[
  {
    "inviteeId": 2,
    "inviterId": 1,
    "createdAt": "...",
    "inviteeUserName": "bob",
    "inviterUserName": "alice"
  }
]
```

---

#### 测试 8.4：查询我参与的族谱（bob 视角）

```
方法：GET
URL：http://localhost:3000/collab/mine
Authorization：Bearer {{tokenB}}

期望响应（200）：
[
  {
    "treeId": 1,
    "treeName": "张氏族谱",
    "surname": "张",
    "createdAt": "...",
    "inviterUserName": "alice"
  }
]
```

---

#### 测试 8.5：移除协作者

```
方法：DELETE
URL：http://localhost:3000/families/{{treeId}}/collab/{{inviteeId}}
Authorization：Bearer {{tokenA}}

期望响应（200）：{ "message": "协作者已移除" }

移除后再次用 bob 的 token 访问 GET /families/{{treeId}}/members
→ 期望返回 403 Forbidden（权限已撤销）
```

---

#### 测试 8.6：异常测试用例

| 测试名称 | 说明 | 预期状态码 |
|----------|------|------------|
| 非创建者邀请 | 用 bob 的 token 邀请他人 | `403` |
| 邀请不存在的用户名 | `inviteeUserName: "nobody"` | `404` |
| 邀请自己 | inviteeUserName 填自己的 userName | `400` |
| 重复邀请同一人 | 对 bob 发起第二次邀请 | `409` |
| 移除不存在的协作者 | DELETE 一个未被邀请的 userId | `404` |
| 非创建者查看协作者列表 | 用 bob 的 token 访问 GET collab | `403` |

---

### Step 9：前端——封装 Collab API

**文件路径：** `frontend/src/api/collab.ts`

```typescript
import client from './client';

export interface CollabRecord {
  inviteeId: number;
  inviterId: number;
  createdAt: string;
  inviteeUserName: string;
  inviterUserName: string;
}

export interface MyCollabRecord {
  treeId: number;
  treeName: string;
  surname: string;
  createdAt: string;
  inviterUserName: string;
}

// 邀请协作者
export const inviteCollab = (treeId: number, inviteeUserName: string) =>
  client
    .post(`/families/${treeId}/collab`, { inviteeUserName })
    .then((res) => res.data);

// 获取族谱协作者列表
export const getCollabs = (treeId: number) =>
  client
    .get<CollabRecord[]>(`/families/${treeId}/collab`)
    .then((res) => res.data);

// 移除协作者
export const removeCollab = (treeId: number, inviteeId: number) =>
  client
    .delete<{ message: string }>(`/families/${treeId}/collab/${inviteeId}`)
    .then((res) => res.data);

// 查询我被邀请参与的族谱
export const getMyCollabs = () =>
  client.get<MyCollabRecord[]>('/collab/mine').then((res) => res.data);
```

---

### Step 10：前端——协作管理页面

**文件路径：** `frontend/src/pages/CollabPage/index.tsx`

```typescript
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  getCollabs,
  inviteCollab,
  removeCollab,
  CollabRecord,
} from '../../api/collab';

export default function CollabPage() {
  const { treeId } = useParams<{ treeId: string }>();
  const numericTreeId = Number(treeId);

  const [collabs, setCollabs]           = useState<CollabRecord[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [inviteeName, setInviteeName]   = useState('');
  const [inviting, setInviting]         = useState(false);

  useEffect(() => { loadCollabs(); }, []);

  const loadCollabs = async () => {
    setLoading(true); setError('');
    try {
      setCollabs(await getCollabs(numericTreeId));
    } catch {
      setError('加载协作者列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteeName.trim()) { alert('请输入用户名'); return; }
    setInviting(true);
    try {
      await inviteCollab(numericTreeId, inviteeName.trim());
      setInviteeName('');
      await loadCollabs();   // 刷新列表
    } catch (err: any) {
      alert(err.response?.data?.message || '邀请失败');
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (collab: CollabRecord) => {
    if (!window.confirm(`确定移除协作者 "${collab.inviteeUserName}" 吗？移除后对方将无法访问此族谱。`)) return;
    try {
      await removeCollab(numericTreeId, collab.inviteeId);
      setCollabs(collabs.filter((c) => c.inviteeId !== collab.inviteeId));
    } catch (err: any) {
      alert(err.response?.data?.message || '移除失败');
    }
  };

  if (loading) return <div style={{ padding: 32 }}>加载中...</div>;

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 16px' }}>

      <h2 style={{ marginBottom: 24 }}>协作管理</h2>

      {/* 邀请表单 */}
      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>邀请协作者</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={inviteeName}
            onChange={(e) => setInviteeName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
            placeholder="输入对方的用户名"
            style={{ flex: 1, padding: 8, border: '1px solid #ddd', borderRadius: 4 }}
          />
          <button onClick={handleInvite} disabled={inviting}>
            {inviting ? '邀请中...' : '立即邀请'}
          </button>
        </div>
        <p style={{ color: '#999', fontSize: 13, marginTop: 8, marginBottom: 0 }}>
          受邀者邀请后立即获得访问权限，可查看和编辑族谱成员与婚姻关系。
        </p>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* 协作者列表 */}
      <h3>当前协作者（{collabs.length} 人）</h3>

      {collabs.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#999', padding: 48 }}>
          还没有协作者，通过上方表单邀请其他用户
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              {['用户名', '邀请人', '邀请时间', '操作'].map((h) => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid #eee' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {collabs.map((c) => (
              <tr key={c.inviteeId} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '10px 12px', fontWeight: 500 }}>{c.inviteeUserName}</td>
                <td style={{ padding: '10px 12px', color: '#666' }}>{c.inviterUserName}</td>
                <td style={{ padding: '10px 12px', color: '#666' }}>
                  {new Date(c.createdAt).toLocaleDateString()}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <button
                    onClick={() => handleRemove(c)}
                    style={{ color: 'red', borderColor: 'red' }}
                  >
                    移除
                  </button>
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

### Step 11：前端——我参与的族谱（集成到 FamilyListPage）

受邀者登录后，在族谱列表页除了看到"我创建的族谱"，还应该看到"我参与的族谱"。在 `FamilyListPage/index.tsx` 中补充以下内容：

```typescript
// 在 FamilyListPage/index.tsx 顶部引入
import { getMyCollabs, MyCollabRecord } from '../../api/collab';

// 在组件内添加状态
const [sharedFamilies, setSharedFamilies] = useState<MyCollabRecord[]>([]);

// 在 loadFamilies 中同时拉取
const loadFamilies = async () => {
  setLoading(true); setError('');
  try {
    const [myData, sharedData] = await Promise.all([
      getFamilies(),
      getMyCollabs(),
    ]);
    setFamilies(myData);
    setSharedFamilies(sharedData);
  } catch {
    setError('加载族谱列表失败，请刷新重试');
  } finally {
    setLoading(false);
  }
};

// 在渲染部分，"我创建的族谱"列表下方添加：
{sharedFamilies.length > 0 && (
  <div style={{ marginTop: 32 }}>
    <h3 style={{ marginBottom: 16 }}>我参与的族谱</h3>
    {sharedFamilies.map((f) => (
      <div
        key={f.treeId}
        style={{
          border: '1px solid #eee',
          borderRadius: 8,
          padding: '16px 20px',
          marginBottom: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>{f.treeName}</div>
          <div style={{ color: '#666', marginTop: 4, fontSize: 14 }}>
            姓氏：{f.surname} · 邀请人：{f.inviterUserName} · 加入时间：{new Date(f.createdAt).toLocaleDateString()}
          </div>
        </div>
        <button onClick={() => navigate(`/families/${f.treeId}/members`)}>
          进入管理
        </button>
      </div>
    ))}
  </div>
)}
```

---

### Step 12：更新前端路由

**文件路径：** `frontend/src/App.tsx`

```typescript
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import FamilyListPage from './pages/FamilyListPage';
import MemberPage from './pages/MemberPage';
import MarriagePage from './pages/MarriagePage';
import QueryPage from './pages/QueryPage';
import CollabPage from './pages/CollabPage';   // 新增

export default function App() {
  return (
    <Routes>
      <Route path="/"          element={<Navigate to="/login" replace />} />
      <Route path="/login"     element={<LoginPage />} />
      <Route path="/register"  element={<RegisterPage />} />
      <Route path="/dashboard" element={<FamilyListPage />} />
      <Route path="/families/:treeId/members"   element={<MemberPage />} />
      <Route path="/families/:treeId/marriages" element={<MarriagePage />} />
      <Route path="/families/:treeId/query"     element={<QueryPage />} />
      <Route path="/families/:treeId/collab"    element={<CollabPage />} />   {/* 新增 */}
    </Routes>
  );
}
```

---

## 六、完整测试清单

### 后端测试（Postman）

- [ ] POST 邀请成功，返回 collab 记录
- [ ] 邀请后 bob 用自己的 token 访问 GET `/families/:treeId/members` 返回 200（**权限扩展验证**）
- [ ] GET 协作者列表，返回包含 userName 的完整信息
- [ ] GET `/collab/mine`，bob 能看到被邀请的族谱
- [ ] DELETE 移除 bob 后，bob 再次访问成员列表返回 403（**权限撤销验证**）
- [ ] 邀请不存在的用户名返回 404
- [ ] 邀请自己返回 400
- [ ] 重复邀请返回 409
- [ ] 非创建者邀请返回 403
- [ ] 在 PostgreSQL 里确认：`SELECT * FROM collab;`

### 前端测试（浏览器）

- [ ] 协作管理页正常加载协作者列表
- [ ] 输入正确用户名点击邀请，列表即时刷新出现新协作者
- [ ] 输入不存在的用户名，显示错误提示
- [ ] 点击移除弹出确认框（含用户名），确认后协作者从列表消失
- [ ] 用 bob 账号登录，Dashboard 页"我参与的族谱"区域显示被邀请的族谱
- [ ] bob 点击"进入管理"可以正常访问成员列表

---

## 七、常见错误及解决方法

| 错误信息 | 原因 | 解决方法 |
|----------|------|----------|
| `403` 邀请后受邀者仍无法访问 | `FamiliesService.findOne` 未修改，或 `Collab` 实体未在 `FamiliesModule` 注册 | 检查 Step 3，确认 `families.module.ts` 已添加 `Collab` 到 `forFeature` |
| `Cannot find module '../collab/collab.entity'` | 在 `families.module.ts` 引入路径写错 | 确认 collab.entity.ts 文件路径正确 |
| `Nest can't resolve CollabService dependencies` | `TypeOrmModule.forFeature` 缺少某个实体 | 检查 `collab.module.ts` 的 `forFeature([Collab, FamilyTree, User])` |
| `404 用户不存在` | 被邀请人用户名拼写错误 | 确认对方已注册且用户名完全一致 |
| `409 已经是协作者` | 重复邀请同一人 | 正常行为，提示用户该成员已在列表中 |
| 联表查询返回字段为 null | `getRawMany` 的列别名大小写问题 | 确认 `AS "inviteeUserName"` 使用双引号且大小写与前端一致 |

---

## 八、目录结构速查

```
Pedigree/
├── backend/
│   └── src/
│       ├── app.module.ts              ← Step 7 修改
│       ├── families/
│       │   ├── families.module.ts     ← Step 3 修改（添加 Collab 实体）
│       │   └── families.service.ts   ← Step 3 修改（扩展 findOne 权限逻辑）
│       ├── auth/                      ← 已完成
│       ├── users/                     ← 已完成
│       ├── members/                   ← 已完成
│       ├── marriages/                 ← 已完成
│       ├── query/                     ← 已完成
│       └── collab/
│           ├── dto/
│           │   └── create-collab.dto.ts  ← Step 2
│           ├── collab.entity.ts          ← Step 1
│           ├── collab.service.ts         ← Step 4
│           ├── collab.controller.ts      ← Step 5
│           └── collab.module.ts          ← Step 6
│
└── frontend/
    └── src/
        ├── App.tsx                    ← Step 12 修改
        ├── api/
        │   └── collab.ts              ← Step 9
        └── pages/
            ├── FamilyListPage/
            │   └── index.tsx          ← Step 11 修改（添加"我参与的族谱"）
            └── CollabPage/
                └── index.tsx          ← Step 10
```

---

## 九、项目完成总览

至此，Pedigree 项目所有模块均已完成：

```
✅ Auth     → 注册、登录、JWT 签发与验证
✅ Users    → 用户信息管理
✅ Families → 族谱增删改查、权限控制
✅ Members  → 成员增删改查、模糊搜索
✅ Marriages → 婚姻关系管理、约束校验
✅ Query    → 祖先/后代查询、亲缘路径、族谱统计
✅ Collab   → 协作邀请、权限扩展
```

后续可以考虑的优化方向：

```
1. 前端整体 UI 美化（当前为无样式的基础组件）
2. D3.js 树状图优化（支持双亲节点、缩放、拖拽）
3. 成员头像上传（需要引入文件存储，如本地 multer 或云存储）
4. 族谱导出（PDF 或图片格式）
5. 操作日志（记录谁在什么时候做了什么修改）
```

---

*文档版本：v1.0 · 模块：Collab · 项目：Pedigree · 环境：WSL2 Ubuntu 22.04*