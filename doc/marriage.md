# Pedigree · Marriages 模块完整开发指南

> 技术栈：NestJS（后端）· React + TypeScript（前端）· PostgreSQL · JWT  
> 适用环境：WSL2 Ubuntu 22.04  
> 前置条件：Auth 模块 + Families 模块 + Members 模块已完成并测试通过  
> 文档版本：v1.0

---

## 一、文件总览

开发 Marriages 模块需要创建以下文件：

```
backend/src/
├── app.module.ts                            ← 根模块（需修改，添加 MarriagesModule）
│
└── marriages/
    ├── dto/
    │   ├── create-marriage.dto.ts           ← 定义创建婚姻关系请求的数据格式
    │   └── update-marriage.dto.ts           ← 定义修改婚姻关系请求的数据格式
    ├── marriage.entity.ts                   ← 数据库 marriages 表的 TypeScript 映射
    ├── marriages.service.ts                 ← 核心业务逻辑（增删改查 + 约束校验）
    ├── marriages.controller.ts              ← HTTP 路由入口
    └── marriages.module.ts                  ← 组装所有 marriages 相关文件

frontend/src/
├── api/
│   └── marriages.ts                         ← 封装婚姻关系相关的 API 请求函数
└── pages/
    └── MarriagePage/
        └── index.tsx                        ← 婚姻关系管理页（查看、新建、编辑、删除）
```

---

## 二、每个文件的作用说明

### 后端文件

| 文件 | 作用 | 类比理解 |
|------|------|----------|
| `marriage.entity.ts` | 把数据库的 `marriages` 表映射成 TypeScript 类 | 数据库表的"翻译官" |
| `create-marriage.dto.ts` | 定义创建婚姻关系时前端必须/可以传的字段 | 结婚登记表的"模板" |
| `update-marriage.dto.ts` | 定义修改婚姻关系时可以传的字段（全部可选） | 信息修改表的"模板" |
| `marriages.service.ts` | 核心文件：增删改查婚姻关系，校验数据库约束（顺序、自婚、日期） | 业务的"大脑" |
| `marriages.controller.ts` | 定义 HTTP 路由，嵌套在族谱路径下，需要登录才能访问 | 前台"接待员" |
| `marriages.module.ts` | 把上述所有文件组装在一起，引入 Families 和 Members 模块 | 模块的"组织架构图" |

### 前端文件

| 文件 | 作用 |
|------|------|
| `api/marriages.ts` | 封装所有婚姻关系相关的 API 调用，统一管理请求 |
| `MarriagePage/index.tsx` | 展示某个族谱下的婚姻关系列表，支持新建、编辑、删除 |

---

## 三、接口设计总览

所有接口均需要在请求头携带 JWT Token（由 `client.ts` 的拦截器自动完成）。  
路径嵌套在 `/families/:treeId/marriages` 下，体现婚姻关系从属于族谱的层级关系。

| 方法 | 路径 | 说明 | 权限要求 |
|------|------|------|----------|
| POST | `/families/:treeId/marriages` | 新增一条婚姻关系 | 已登录 + 是族谱创建者 |
| GET | `/families/:treeId/marriages` | 获取族谱内所有婚姻关系 | 已登录 + 是族谱创建者 |
| GET | `/families/:treeId/marriages/:marriageId` | 获取单条婚姻关系详情 | 已登录 + 是族谱创建者 |
| PATCH | `/families/:treeId/marriages/:marriageId` | 修改婚姻日期等信息 | 已登录 + 是族谱创建者 |
| DELETE | `/families/:treeId/marriages/:marriageId` | 删除一条婚姻关系 | 已登录 + 是族谱创建者 |

---

## 四、数据库约束说明

`marriages` 表有四条约束，**业务层必须在写入前主动校验**，否则会触发数据库报错并返回 500：

| 约束名 | 规则 | 处理方式 |
|--------|------|----------|
| `chk_pair_order` | `member1_id < member2_id` | Service 层自动排序，小的放 member1 |
| `chk_no_self` | 两人不能是同一个人 | Service 层校验，相同则抛出 400 |
| `chk_marriage_date` | `marry_date < divorce_date` | Service 层校验，违反则抛出 400 |
| `UNIQUE` | `(member1_id, member2_id, marry_date)` 唯一 | Service 层捕获数据库唯一冲突，抛出 409 |

> **`chk_pair_order` 的处理策略：** 前端传入的两个 memberId 顺序不固定，Service 层统一做排序（取两者中较小的为 member1），这样前端不需要关心谁是 member1 谁是 member2，用户体验更好。

---

## 五、开发顺序与完整代码

> **原则：永远先写后端，用 Postman 测试通过后再写前端。**

---

### Step 1：创建 Marriage 实体

**文件路径：** `backend/src/marriages/marriage.entity.ts`

**作用：** TypeORM 通过这个类知道数据库里有一张 `marriages` 表，以及表里有哪些字段。

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';

@Entity('marriages')    // 对应数据库中名为 marriages 的表
export class Marriage {

  @PrimaryGeneratedColumn({ name: 'marriage_id' })
  marriageId: number;

  // 两位成员的 ID，数据库约束保证 member1_id < member2_id
  @Column({ name: 'member1_id' })
  member1Id: number;

  @Column({ name: 'member2_id' })
  member2Id: number;

  @Column({ name: 'marry_date', type: 'date', nullable: true })
  marryDate: string;      // 格式：'YYYY-MM-DD'，可为 null

  @Column({ name: 'divorce_date', type: 'date', nullable: true })
  divorceDate: string;    // 格式：'YYYY-MM-DD'，未离婚则为 null
}
```

**注意事项：**
- Marriage 实体不需要 `treeId` 字段，因为两位成员已经通过 `member_id` 关联到族谱，`treeId` 仅用于路由层的权限校验
- `marryDate` 和 `divorceDate` 均可为 null：结婚日期不详，或婚姻尚未结束
- 没有 `createTime` / `updateTime`，因为 `marriages` 表中没有这两列

---

### Step 2：创建 DTO 数据格式定义

**文件路径：** `backend/src/marriages/dto/create-marriage.dto.ts`

**作用：** 规定创建婚姻关系接口接收的请求体字段。`member1Id` 和 `member2Id` 为必填，日期均可选。

```typescript
export class CreateMarriageDto {
  member1Id: number;      // 必填：其中一方的 memberId（顺序无所谓，Service 会自动排序）
  member2Id: number;      // 必填：另一方的 memberId
  marryDate?: string;     // 可选：结婚日期，格式 'YYYY-MM-DD'
  divorceDate?: string;   // 可选：离婚日期，格式 'YYYY-MM-DD'
}
```

**文件路径：** `backend/src/marriages/dto/update-marriage.dto.ts`

**作用：** 规定修改婚姻关系接口接收的请求体格式。成员 ID 不允许修改（修改双方意味着这条记录本身已失去意义，应删除后重建），只允许修改日期。

```typescript
export class UpdateMarriageDto {
  marryDate?: string;     // 可选：修改结婚日期
  divorceDate?: string;   // 可选：修改离婚日期（填写表示已离婚，清空表示撤销离婚记录）
}
```

---

### Step 3：创建 MarriagesService（核心业务逻辑）

**文件路径：** `backend/src/marriages/marriages.service.ts`

**作用：** 实现婚姻关系的增删改查，在写入数据库前主动校验所有业务约束，避免触发数据库层报错。

```typescript
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Marriage } from './marriage.entity';
import { FamiliesService } from '../families/families.service';
import { MembersService } from '../members/members.service';
import { CreateMarriageDto } from './dto/create-marriage.dto';
import { UpdateMarriageDto } from './dto/update-marriage.dto';

@Injectable()
export class MarriagesService {

  constructor(
    @InjectRepository(Marriage)
    private readonly marriageRepo: Repository<Marriage>,

    // 复用 FamiliesService.findOne 做族谱访问权限校验
    private readonly familiesService: FamiliesService,

    // 复用 MembersService.findOne 验证成员存在且属于该族谱
    private readonly membersService: MembersService,
  ) {}

  // ── 族谱访问权限校验（内部辅助方法）────────────────────
  private async verifyFamilyAccess(treeId: number, userId: number) {
    await this.familiesService.findOne(treeId, userId);
  }

  // ── 业务约束校验（内部辅助方法）────────────────────────
  private validateConstraints(
    member1Id: number,
    member2Id: number,
    marryDate?: string,
    divorceDate?: string,
  ) {
    // 不能与自己结婚
    if (member1Id === member2Id) {
      throw new BadRequestException('两位成员不能是同一个人');
    }

    // 结婚日期必须早于离婚日期
    if (marryDate && divorceDate && marryDate >= divorceDate) {
      throw new BadRequestException('结婚日期必须早于离婚日期');
    }
  }

  // ── 创建婚姻关系 ────────────────────────────────────────
  async create(
    treeId: number,
    dto: CreateMarriageDto,
    userId: number,
  ): Promise<Marriage> {
    await this.verifyFamilyAccess(treeId, userId);

    // 验证两位成员都存在且属于该族谱
    await this.membersService.findOne(treeId, dto.member1Id, userId);
    await this.membersService.findOne(treeId, dto.member2Id, userId);

    // 自动排序：保证 member1Id < member2Id，满足数据库约束
    const [member1Id, member2Id] = [dto.member1Id, dto.member2Id].sort(
      (a, b) => a - b,
    ) as [number, number];

    // 业务约束校验
    this.validateConstraints(member1Id, member2Id, dto.marryDate, dto.divorceDate);

    // 检查是否已存在相同的婚姻记录（同一对成员 + 同一结婚日期）
    const existing = await this.marriageRepo.findOne({
      where: { member1Id, member2Id, marryDate: dto.marryDate ?? null },
    });
    if (existing) {
      throw new ConflictException('该婚姻关系已存在');
    }

    const marriage = this.marriageRepo.create({
      member1Id,
      member2Id,
      marryDate: dto.marryDate ?? null,
      divorceDate: dto.divorceDate ?? null,
    });

    return this.marriageRepo.save(marriage);
  }

  // ── 查询族谱内所有婚姻关系 ──────────────────────────────
  async findAll(treeId: number, userId: number): Promise<Marriage[]> {
    await this.verifyFamilyAccess(treeId, userId);

    // 先拿到该族谱所有成员的 ID 列表
    const members = await this.membersService.findAll(treeId, userId);
    const memberIds = members.map((m) => m.memberId);

    if (memberIds.length === 0) return [];

    // 查找 member1Id 或 member2Id 在该族谱成员范围内的婚姻记录
    // 由于约束保证 member1Id < member2Id，只需查 member1Id 在列表内即可
    return this.marriageRepo
      .createQueryBuilder('m')
      .where('m.member1_id IN (:...ids)', { ids: memberIds })
      .orderBy('m.marry_date', 'ASC')
      .getMany();
  }

  // ── 查询单条婚姻关系详情 ────────────────────────────────
  async findOne(
    treeId: number,
    marriageId: number,
    userId: number,
  ): Promise<Marriage> {
    await this.verifyFamilyAccess(treeId, userId);

    const marriage = await this.marriageRepo.findOne({
      where: { marriageId },
    });

    if (!marriage) {
      throw new NotFoundException('婚姻关系不存在');
    }

    return marriage;
  }

  // ── 修改婚姻关系 ────────────────────────────────────────
  async update(
    treeId: number,
    marriageId: number,
    dto: UpdateMarriageDto,
    userId: number,
  ): Promise<Marriage> {
    const marriage = await this.findOne(treeId, marriageId, userId);

    // 用修改后的值做约束校验
    const newMarryDate    = dto.marryDate    !== undefined ? dto.marryDate    : marriage.marryDate;
    const newDivorceDate  = dto.divorceDate  !== undefined ? dto.divorceDate  : marriage.divorceDate;

    this.validateConstraints(
      marriage.member1Id,
      marriage.member2Id,
      newMarryDate ?? undefined,
      newDivorceDate ?? undefined,
    );

    if (dto.marryDate   !== undefined) marriage.marryDate   = dto.marryDate;
    if (dto.divorceDate !== undefined) marriage.divorceDate = dto.divorceDate;

    return this.marriageRepo.save(marriage);
  }

  // ── 删除婚姻关系 ────────────────────────────────────────
  async remove(
    treeId: number,
    marriageId: number,
    userId: number,
  ): Promise<{ message: string }> {
    const marriage = await this.findOne(treeId, marriageId, userId);

    await this.marriageRepo.remove(marriage);

    return { message: '婚姻关系已删除' };
  }
}
```

**约束处理总结：**
```
chk_pair_order  → Service 层自动排序，前端无需关心顺序
chk_no_self     → validateConstraints() 主动抛出 400
chk_marriage_date → validateConstraints() 主动抛出 400
UNIQUE 冲突     → create() 中提前查询，存在则抛出 409
```

---

### Step 4：创建 MarriagesController（路由）

**文件路径：** `backend/src/marriages/marriages.controller.ts`

**作用：** 定义 HTTP 接口，路由嵌套在 `/families/:treeId/marriages` 下。

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { MarriagesService } from './marriages.service';
import { CreateMarriageDto } from './dto/create-marriage.dto';
import { UpdateMarriageDto } from './dto/update-marriage.dto';
import { JwtAuthGuard } from '../auth/auth.guard';

@Controller('families/:treeId/marriages')
@UseGuards(JwtAuthGuard)
export class MarriagesController {

  constructor(private readonly marriagesService: MarriagesService) {}

  // POST /families/:treeId/marriages
  // 新增一条婚姻关系
  @Post()
  create(
    @Param('treeId', ParseIntPipe) treeId: number,
    @Body() dto: CreateMarriageDto,
    @Request() req,
  ) {
    return this.marriagesService.create(treeId, dto, req.user.userId);
  }

  // GET /families/:treeId/marriages
  // 获取族谱内所有婚姻关系
  @Get()
  findAll(
    @Param('treeId', ParseIntPipe) treeId: number,
    @Request() req,
  ) {
    return this.marriagesService.findAll(treeId, req.user.userId);
  }

  // GET /families/:treeId/marriages/:marriageId
  // 获取单条婚姻关系详情
  @Get(':marriageId')
  findOne(
    @Param('treeId', ParseIntPipe) treeId: number,
    @Param('marriageId', ParseIntPipe) marriageId: number,
    @Request() req,
  ) {
    return this.marriagesService.findOne(treeId, marriageId, req.user.userId);
  }

  // PATCH /families/:treeId/marriages/:marriageId
  // 修改婚姻日期信息
  @Patch(':marriageId')
  update(
    @Param('treeId', ParseIntPipe) treeId: number,
    @Param('marriageId', ParseIntPipe) marriageId: number,
    @Body() dto: UpdateMarriageDto,
    @Request() req,
  ) {
    return this.marriagesService.update(treeId, marriageId, dto, req.user.userId);
  }

  // DELETE /families/:treeId/marriages/:marriageId
  // 删除一条婚姻关系
  @Delete(':marriageId')
  remove(
    @Param('treeId', ParseIntPipe) treeId: number,
    @Param('marriageId', ParseIntPipe) marriageId: number,
    @Request() req,
  ) {
    return this.marriagesService.remove(treeId, marriageId, req.user.userId);
  }
}
```

---

### Step 5：创建 MarriagesModule（组装）

**文件路径：** `backend/src/marriages/marriages.module.ts`

**作用：** 把 Marriage 实体、MarriagesService、MarriagesController 组装在一起，并引入 FamiliesModule 和 MembersModule。

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Marriage } from './marriage.entity';
import { MarriagesService } from './marriages.service';
import { MarriagesController } from './marriages.controller';
import { AuthModule } from '../auth/auth.module';
import { FamiliesModule } from '../families/families.module';
import { MembersModule } from '../members/members.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Marriage]),  // 注册 Marriage 实体
    AuthModule,                             // 使用 JwtAuthGuard
    FamiliesModule,                         // 注入 FamiliesService 做权限校验
    MembersModule,                          // 注入 MembersService 验证成员存在性
  ],
  controllers: [MarriagesController],
  providers: [MarriagesService],
  exports: [MarriagesService],
})
export class MarriagesModule {}
```

> **注意：** `MembersModule` 的 `exports` 中必须包含 `MembersService`（在 members.md Step 5 中已完成），否则这里注入会报错。

---

### Step 6：修改根模块 AppModule

**文件路径：** `backend/src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { FamiliesModule } from './families/families.module';
import { MembersModule } from './members/members.module';
import { MarriagesModule } from './marriages/marriages.module';   // 新增

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
    MarriagesModule,   // 新增
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

**前置准备：登录 + 创建族谱 + 创建至少两名成员**

```
1. POST /auth/login
   → 获取 token，存入环境变量 {{token}}

2. POST /families
   Body：{ "treeName": "张氏族谱", "surname": "张" }
   → 记录 treeId，存入环境变量 {{treeId}}

3. POST /families/{{treeId}}/members
   Body：{ "name": "张大山", "gender": "男", "generation": 1 }
   → 记录 memberId，存入 {{memberId1}}

4. POST /families/{{treeId}}/members
   Body：{ "name": "李梅", "gender": "女", "generation": 1 }
   → 记录 memberId，存入 {{memberId2}}
```

---

#### 测试 7.1：新增婚姻关系（含日期）

```
方法：POST
URL：http://localhost:3000/families/{{treeId}}/marriages
Authorization：Bearer {{token}}
Body（raw JSON）：
{
  "member1Id": {{memberId1}},
  "member2Id": {{memberId2}},
  "marryDate": "1975-08-20"
}

期望响应（201）：
{
  "marriageId": 1,
  "member1Id": <较小的那个 memberId>,
  "member2Id": <较大的那个 memberId>,
  "marryDate": "1975-08-20",
  "divorceDate": null
}
```

在 Tests 脚本中保存 marriageId：

```javascript
pm.test("状态码为 201", () => pm.response.to.have.status(201));
pm.test("返回 marriageId", () => {
    const json = pm.response.json();
    pm.expect(json).to.have.property("marriageId");
    pm.environment.set("marriageId", json.marriageId);
});
pm.test("member1Id < member2Id（自动排序）", () => {
    const json = pm.response.json();
    pm.expect(json.member1Id).to.be.lessThan(json.member2Id);
});
```

---

#### 测试 7.2：新增婚姻关系（顺序颠倒，验证自动排序）

```
方法：POST
URL：http://localhost:3000/families/{{treeId}}/marriages
Body：
{
  "member1Id": {{memberId2}},
  "member2Id": {{memberId1}},
  "marryDate": "1980-01-01"
}

期望响应（201）：返回的 member1Id 仍然是较小的那个，自动排序生效
```

---

#### 测试 7.3：获取所有婚姻关系

```
方法：GET
URL：http://localhost:3000/families/{{treeId}}/marriages
Authorization：Bearer {{token}}

期望响应（200）：包含已创建的婚姻关系数组，按 marryDate 升序排列
```

---

#### 测试 7.4：获取单条婚姻关系

```
方法：GET
URL：http://localhost:3000/families/{{treeId}}/marriages/{{marriageId}}
Authorization：Bearer {{token}}

期望响应（200）：对应的婚姻关系对象
```

---

#### 测试 7.5：修改婚姻关系（添加离婚日期）

```
方法：PATCH
URL：http://localhost:3000/families/{{treeId}}/marriages/{{marriageId}}
Authorization：Bearer {{token}}
Body：
{
  "divorceDate": "2000-05-10"
}

期望响应（200）：divorceDate 字段已更新，其余字段不变
```

---

#### 测试 7.6：删除婚姻关系

```
方法：DELETE
URL：http://localhost:3000/families/{{treeId}}/marriages/{{marriageId}}
Authorization：Bearer {{token}}

期望响应（200）：{ "message": "婚姻关系已删除" }

再次 GET /families/{{treeId}}/marriages/{{marriageId}}
→ 期望返回 404 Not Found
```

---

#### 测试 7.7：异常测试用例

| 测试名称 | 方法 | Body / 说明 | 预期状态码 |
|----------|------|-------------|------------|
| 无 Token 访问 | GET | 不加 Authorization | `401` |
| 访问他人族谱的婚姻 | GET | 换另一账号 Token | `403` |
| 两个 memberId 相同 | POST | `member1Id` == `member2Id` | `400` |
| 结婚日期晚于离婚日期 | POST | `marryDate: "2000-01-01"`, `divorceDate: "1990-01-01"` | `400` |
| 重复创建同一婚姻 | POST | 与 7.1 完全相同的 Body 再发一次 | `409` |
| memberId 不属于该族谱 | POST | 传入其他族谱的 memberId | `404` |
| 婚姻关系不存在 | GET | `/marriages/99999` | `404` |
| treeId 非数字 | GET | `/families/abc/marriages` | `400` |

---

### Step 8：前端——封装婚姻关系 API

**文件路径：** `frontend/src/api/marriages.ts`

```typescript
import client from './client';

// 婚姻关系对象的 TypeScript 类型定义
export interface Marriage {
  marriageId: number;
  member1Id: number;
  member2Id: number;
  marryDate: string | null;
  divorceDate: string | null;
}

export interface CreateMarriageData {
  member1Id: number;
  member2Id: number;
  marryDate?: string;
  divorceDate?: string;
}

export interface UpdateMarriageData {
  marryDate?: string;
  divorceDate?: string;
}

// 新增婚姻关系
export const createMarriage = (treeId: number, data: CreateMarriageData) =>
  client
    .post<Marriage>(`/families/${treeId}/marriages`, data)
    .then((res) => res.data);

// 获取族谱内所有婚姻关系
export const getMarriages = (treeId: number) =>
  client
    .get<Marriage[]>(`/families/${treeId}/marriages`)
    .then((res) => res.data);

// 获取单条婚姻关系详情
export const getMarriage = (treeId: number, marriageId: number) =>
  client
    .get<Marriage>(`/families/${treeId}/marriages/${marriageId}`)
    .then((res) => res.data);

// 修改婚姻关系
export const updateMarriage = (
  treeId: number,
  marriageId: number,
  data: UpdateMarriageData,
) =>
  client
    .patch<Marriage>(`/families/${treeId}/marriages/${marriageId}`, data)
    .then((res) => res.data);

// 删除婚姻关系
export const deleteMarriage = (treeId: number, marriageId: number) =>
  client
    .delete<{ message: string }>(`/families/${treeId}/marriages/${marriageId}`)
    .then((res) => res.data);
```

---

### Step 9：前端——婚姻关系管理页面

**文件路径：** `frontend/src/pages/MarriagePage/index.tsx`

**作用：** 展示某个族谱内的婚姻关系列表，支持新建、编辑（修改日期）、删除。成员姓名通过同时拉取成员列表来做 ID → 姓名的映射，让界面更直观。

```typescript
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  getMarriages,
  createMarriage,
  updateMarriage,
  deleteMarriage,
  Marriage,
  CreateMarriageData,
} from '../../api/marriages';
import { getMembers, Member } from '../../api/members';

const EMPTY_FORM: CreateMarriageData = {
  member1Id: 0,
  member2Id: 0,
  marryDate: '',
  divorceDate: '',
};

export default function MarriagePage() {
  const { treeId } = useParams<{ treeId: string }>();
  const numericTreeId = Number(treeId);

  // 婚姻关系列表
  const [marriages, setMarriages]   = useState<Marriage[]>([]);
  // 成员列表（用于 ID → 姓名映射 和 下拉选择）
  const [members, setMembers]       = useState<Member[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');

  // 新建/编辑表单
  const [showForm, setShowForm]     = useState(false);
  const [editingId, setEditingId]   = useState<number | null>(null);
  const [form, setForm]             = useState<CreateMarriageData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  // 同时拉取婚姻关系列表和成员列表
  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [marriageData, memberData] = await Promise.all([
        getMarriages(numericTreeId),
        getMembers(numericTreeId),
      ]);
      setMarriages(marriageData);
      setMembers(memberData);
    } catch {
      setError('加载数据失败，请刷新重试');
    } finally {
      setLoading(false);
    }
  };

  // memberId → 姓名
  const getMemberName = (id: number) =>
    members.find((m) => m.memberId === id)?.name ?? `ID:${id}`;

  // 打开新建表单
  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  // 打开编辑表单（只能改日期）
  const handleOpenEdit = (marriage: Marriage) => {
    setEditingId(marriage.marriageId);
    setForm({
      member1Id:   marriage.member1Id,
      member2Id:   marriage.member2Id,
      marryDate:   marriage.marryDate ?? '',
      divorceDate: marriage.divorceDate ?? '',
    });
    setShowForm(true);
  };

  // 提交表单
  const handleSubmit = async () => {
    if (editingId === null && (!form.member1Id || !form.member2Id)) {
      alert('请选择两位成员');
      return;
    }
    setSubmitting(true);
    try {
      if (editingId === null) {
        // 新建
        const payload: CreateMarriageData = {
          member1Id:   form.member1Id,
          member2Id:   form.member2Id,
          ...(form.marryDate   ? { marryDate:   form.marryDate }   : {}),
          ...(form.divorceDate ? { divorceDate: form.divorceDate } : {}),
        };
        const newMarriage = await createMarriage(numericTreeId, payload);
        setMarriages([...marriages, newMarriage]);
      } else {
        // 编辑（只传日期字段）
        const updated = await updateMarriage(numericTreeId, editingId, {
          marryDate:   form.marryDate   || undefined,
          divorceDate: form.divorceDate || undefined,
        });
        setMarriages(marriages.map((m) => (m.marriageId === editingId ? updated : m)));
      }
      setShowForm(false);
    } catch (err: any) {
      alert(err.response?.data?.message || '操作失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  // 删除婚姻关系
  const handleDelete = async (marriage: Marriage) => {
    const name1 = getMemberName(marriage.member1Id);
    const name2 = getMemberName(marriage.member2Id);
    if (!window.confirm(`确定要删除"${name1}"与"${name2}"的婚姻关系吗？`)) return;
    try {
      await deleteMarriage(numericTreeId, marriage.marriageId);
      setMarriages(marriages.filter((m) => m.marriageId !== marriage.marriageId));
    } catch (err: any) {
      alert(err.response?.data?.message || '删除失败');
    }
  };

  if (loading) return <div style={{ padding: 32 }}>加载中...</div>;

  return (
    <div style={{ maxWidth: 900, margin: '40px auto', padding: '0 16px' }}>

      {/* 页头 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>婚姻关系管理</h2>
        <button onClick={handleOpenCreate}>+ 新增婚姻关系</button>
      </div>

      {/* 新建/编辑表单 */}
      {showForm && (
        <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 24 }}>
          <h3 style={{ marginTop: 0 }}>{editingId === null ? '新增婚姻关系' : '编辑婚姻关系'}</h3>

          {/* 新建时显示成员选择，编辑时只显示日期 */}
          {editingId === null && (
            <>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 4 }}>成员一 *</label>
                <select
                  value={form.member1Id}
                  onChange={(e) => setForm({ ...form, member1Id: Number(e.target.value) })}
                  style={{ width: '100%', padding: 8 }}
                >
                  <option value={0}>请选择成员</option>
                  {members.map((m) => (
                    <option key={m.memberId} value={m.memberId}>
                      {m.name}（ID: {m.memberId}）
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 4 }}>成员二 *</label>
                <select
                  value={form.member2Id}
                  onChange={(e) => setForm({ ...form, member2Id: Number(e.target.value) })}
                  style={{ width: '100%', padding: 8 }}
                >
                  <option value={0}>请选择成员</option>
                  {members.map((m) => (
                    <option key={m.memberId} value={m.memberId}>
                      {m.name}（ID: {m.memberId}）
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {editingId !== null && (
            <p style={{ color: '#666', marginBottom: 12 }}>
              当事人：{getMemberName(form.member1Id)} 与 {getMemberName(form.member2Id)}（不可修改）
            </p>
          )}

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>结婚日期</label>
            <input
              type="date"
              value={form.marryDate ?? ''}
              onChange={(e) => setForm({ ...form, marryDate: e.target.value })}
              style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>离婚日期（留空表示婚姻持续中）</label>
            <input
              type="date"
              value={form.divorceDate ?? ''}
              onChange={(e) => setForm({ ...form, divorceDate: e.target.value })}
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

      {/* 婚姻关系列表 */}
      {marriages.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#999', padding: 48 }}>
          还没有婚姻关系记录，点击"新增婚姻关系"开始录入
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              {['ID', '成员一', '成员二', '结婚日期', '离婚日期', '操作'].map((h) => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid #eee' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {marriages.map((m) => (
              <tr key={m.marriageId} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '10px 12px', color: '#999' }}>{m.marriageId}</td>
                <td style={{ padding: '10px 12px' }}>{getMemberName(m.member1Id)}</td>
                <td style={{ padding: '10px 12px' }}>{getMemberName(m.member2Id)}</td>
                <td style={{ padding: '10px 12px' }}>{m.marryDate ?? '—'}</td>
                <td style={{ padding: '10px 12px' }}>{m.divorceDate ?? '婚姻持续中'}</td>
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

```typescript
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import FamilyListPage from './pages/FamilyListPage';
import MemberPage from './pages/MemberPage';
import MarriagePage from './pages/MarriagePage';   // 新增

export default function App() {
  return (
    <Routes>
      <Route path="/"          element={<Navigate to="/login" replace />} />
      <Route path="/login"     element={<LoginPage />} />
      <Route path="/register"  element={<RegisterPage />} />
      <Route path="/dashboard" element={<FamilyListPage />} />
      <Route path="/families/:treeId/members"   element={<MemberPage />} />
      <Route path="/families/:treeId/marriages" element={<MarriagePage />} />   {/* 新增 */}
    </Routes>
  );
}
```

---

## 六、完整测试清单

### 后端测试（Postman）

- [ ] 无 Token 访问任意 marriages 接口返回 401
- [ ] POST 成功创建，返回包含 marriageId 的对象
- [ ] POST 时 member1Id > member2Id，返回结果中两者已自动交换顺序
- [ ] POST 时两个 memberId 相同，返回 400
- [ ] POST 时 marryDate 晚于 divorceDate，返回 400
- [ ] POST 相同记录两次，第二次返回 409
- [ ] POST 时 memberId 不属于该族谱，返回 404
- [ ] GET 返回该族谱所有婚姻关系数组
- [ ] GET 单条返回正确的婚姻关系对象
- [ ] PATCH 修改 divorceDate，响应中字段已更新
- [ ] PATCH 修改后 marryDate >= divorceDate，返回 400
- [ ] DELETE 成功，再次 GET 返回 404
- [ ] 在 PostgreSQL 里确认数据变更：`SELECT * FROM marriages;`

### 前端测试（浏览器）

- [ ] 进入婚姻关系页，成员下拉列表正确显示所有成员姓名
- [ ] 选择两位成员并填写日期，点击"确认新增"，列表出现新记录，成员显示姓名而非 ID
- [ ] 选择相同成员两次，提交后显示错误提示
- [ ] 点击"编辑"，表单中成员姓名显示正确且不可更改
- [ ] 修改离婚日期保存后，列表对应行即时更新
- [ ] 离婚日期为空的记录显示"婚姻持续中"
- [ ] 点击"删除"弹出确认框（包含两人姓名），确认后记录消失
- [ ] 删除所有记录后显示空状态提示

---

## 七、常见错误及解决方法

| 错误信息 | 原因 | 解决方法 |
|----------|------|----------|
| `401 Unauthorized` | Token 未携带或已过期 | 重新登录，确认环境变量 `token` 已更新 |
| `403 Forbidden` | 当前用户不是族谱创建者 | 用创建该族谱的账号登录 |
| `400 两位成员不能是同一个人` | member1Id === member2Id | 检查传入的两个 ID |
| `400 结婚日期必须早于离婚日期` | 日期逻辑错误 | 检查日期格式和大小关系 |
| `404 成员不存在` | memberId 不属于该族谱 | 先用 GET /members 确认成员 ID |
| `409 该婚姻关系已存在` | 同一对成员 + 同一结婚日期已有记录 | 检查是否重复提交 |
| `Nest can't resolve MembersService` | MembersModule 未在 imports 中引入，或未 export MembersService | 检查 `marriages.module.ts` 的 imports 和 `members.module.ts` 的 exports |
| 前端成员下拉为空 | getMembers 请求失败或族谱无成员 | 先去成员管理页添加成员 |

---

## 八、目录结构速查

完成所有步骤后，项目结构应该是：

```
Pedigree/
├── backend/
│   └── src/
│       ├── app.module.ts             ← Step 6 修改（添加 MarriagesModule）
│       ├── auth/                     ← 已完成
│       ├── users/                    ← 已完成
│       ├── families/                 ← 已完成
│       ├── members/                  ← 已完成
│       └── marriages/
│           ├── dto/
│           │   ├── create-marriage.dto.ts   ← Step 2
│           │   └── update-marriage.dto.ts   ← Step 2
│           ├── marriage.entity.ts           ← Step 1
│           ├── marriages.service.ts         ← Step 3
│           ├── marriages.controller.ts      ← Step 4
│           └── marriages.module.ts          ← Step 5
│
└── frontend/
    └── src/
        ├── App.tsx                   ← Step 10 修改（添加 marriages 路由）
        ├── api/
        │   ├── client.ts             ← 已完成
        │   ├── families.ts           ← 已完成
        │   ├── members.ts            ← 已完成
        │   └── marriages.ts          ← Step 8（新增）
        └── pages/
            ├── LoginPage/            ← 已完成
            ├── RegisterPage/         ← 已完成
            ├── FamilyListPage/       ← 已完成
            ├── MemberPage/           ← 已完成
            └── MarriagePage/
                └── index.tsx         ← Step 9（新增）
```

---

## 九、下一步：Query 模块

Marriages 模块完成后，按以下顺序继续开发：

```
1. Query 模块    → 三种查询功能，全部基于递归 SQL 或应用层遍历实现
                   ├── 祖先链路查询：给定某成员，向上追溯所有祖先（递归 fatherId / motherId）
                   ├── 后代查询：给定某成员，向下列出所有后代
                   └── 亲缘路径查询：给定两名成员，找出两人之间的最短连接路径（BFS）
                   前端配合 D3.js 以树状图展示查询结果

2. Collab 模块   → 邀请他人协作编辑族谱
                   完成后修改 FamiliesService.findOne 的权限逻辑，
                   让受邀者也能访问，Members 和 Marriages 的权限自动跟随更新
```

---

*文档版本：v1.0 · 模块：Marriages · 项目：Pedigree · 环境：WSL2 Ubuntu 22.04*