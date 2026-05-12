# Pedigree · Families 模块完整开发指南

> 技术栈：NestJS（后端）· React + TypeScript（前端）· PostgreSQL · JWT  
> 适用环境：WSL2 Ubuntu 22.04  
> 前置条件：Auth 模块已完成并测试通过  
> 文档版本：v1.0

---

## 一、文件总览

开发 Families 模块需要创建以下文件：

```
backend/src/
├── app.module.ts                         ← 根模块（需修改，添加 FamiliesModule）
│
└── families/
    ├── dto/
    │   ├── create-family.dto.ts          ← 定义创建族谱请求的数据格式
    │   └── update-family.dto.ts          ← 定义修改族谱请求的数据格式
    ├── family.entity.ts                  ← 数据库 family_trees 表的 TypeScript 映射
    ├── families.service.ts               ← 核心业务逻辑（增删改查 + 权限控制）
    ├── families.controller.ts            ← HTTP 路由入口
    └── families.module.ts                ← 组装所有 families 相关文件

frontend/src/
├── api/
│   └── families.ts                       ← 封装族谱相关的 API 请求函数
└── pages/
    └── FamilyListPage/
        └── index.tsx                     ← 族谱列表页（查看、新建、删除）
```

---

## 二、每个文件的作用说明

### 后端文件

| 文件 | 作用 | 类比理解 |
|------|------|----------|
| `family.entity.ts` | 把数据库的 `family_trees` 表映射成 TypeScript 类 | 数据库表的"翻译官" |
| `create-family.dto.ts` | 定义创建族谱时前端必须传的字段（tree_name + surname） | 创建申请表的"模板" |
| `update-family.dto.ts` | 定义修改族谱时可以传的字段（可选字段） | 修改申请表的"模板" |
| `families.service.ts` | 核心文件：创建、查询、修改、删除族谱，并做权限校验 | 业务的"大脑" |
| `families.controller.ts` | 定义 HTTP 路由，所有接口都需要登录后才能访问 | 前台"接待员" |
| `families.module.ts` | 把上述所有文件组装在一起 | 模块的"组织架构图" |

### 前端文件

| 文件 | 作用 |
|------|------|
| `api/families.ts` | 封装所有族谱相关的 API 调用，统一管理请求 |
| `FamilyListPage/index.tsx` | 展示当前用户的族谱列表，支持新建和删除 |

---

## 三、接口设计总览

所有接口均需要在请求头携带 JWT Token（由 `client.ts` 的拦截器自动完成）。

| 方法 | 路径 | 说明 | 权限要求 |
|------|------|------|----------|
| POST | `/families` | 创建新族谱 | 已登录 |
| GET | `/families` | 获取当前用户的所有族谱 | 已登录 |
| GET | `/families/:id` | 获取单个族谱详情 | 已登录 + 是创建者或受邀者 |
| PATCH | `/families/:id` | 修改族谱名称或姓氏 | 已登录 + 是创建者 |
| DELETE | `/families/:id` | 删除族谱（级联删除成员） | 已登录 + 是创建者 |

---

## 四、开发顺序与完整代码

> **原则：永远先写后端，用 Postman 测试通过后再写前端。**

---

### Step 1：创建 Family 实体

**文件路径：** `backend/src/families/family.entity.ts`

**作用：** TypeORM 通过这个类知道数据库里有一张 `family_trees` 表，以及表里有哪些字段。

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
import { User } from '../users/user.entity';

@Entity('family_trees')     // 对应数据库中名为 family_trees 的表
export class FamilyTree {

  @PrimaryGeneratedColumn({ name: 'tree_id' })
  treeId: number;

  @Column({ name: 'tree_name', length: 50 })
  treeName: string;

  @Column({ length: 255 })
  surname: string;

  // 外键：关联到 users 表的 user_id
  // 只存储 creator_id 数值，不自动加载完整 User 对象
  @Column({ name: 'creator_id' })
  creatorId: number;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;
}
```

**注意事项：**
- `@CreateDateColumn` 会在 INSERT 时自动写入当前时间
- `@UpdateDateColumn` 会在每次 UPDATE 时自动更新时间
- 这里只映射 `creatorId`（数字），而不映射完整的 User 关联对象，简化查询逻辑

---

### Step 2：创建 DTO 数据格式定义

**文件路径：** `backend/src/families/dto/create-family.dto.ts`

**作用：** 规定创建族谱接口接收的请求体必须包含哪些字段。

```typescript
export class CreateFamilyDto {
  treeName: string;   // 族谱名称，如"张氏族谱"
  surname: string;    // 姓氏，如"张"
}
```

**文件路径：** `backend/src/families/dto/update-family.dto.ts`

**作用：** 规定修改族谱接口接收的请求体格式。所有字段都是可选的（用 `?` 标记），前端只传需要修改的字段。

```typescript
export class UpdateFamilyDto {
  treeName?: string;   // 可选：修改族谱名称
  surname?: string;    // 可选：修改姓氏
}
```

---

### Step 3：创建 FamiliesService（核心业务逻辑）

**文件路径：** `backend/src/families/families.service.ts`

**作用：** 实现族谱的增删改查，同时进行权限校验——只有创建者才能修改或删除族谱。

```typescript
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FamilyTree } from './family.entity';
import { CreateFamilyDto } from './dto/create-family.dto';
import { UpdateFamilyDto } from './dto/update-family.dto';

@Injectable()
export class FamiliesService {

  constructor(
    @InjectRepository(FamilyTree)
    private readonly familyRepo: Repository<FamilyTree>,
  ) {}

  // ── 创建族谱 ────────────────────────────────────────────
  async create(dto: CreateFamilyDto, creatorId: number): Promise<FamilyTree> {
    const family = this.familyRepo.create({
      treeName: dto.treeName,
      surname: dto.surname,
      creatorId,               // 从 JWT 中拿到的当前登录用户 ID
    });
    return this.familyRepo.save(family);
  }

  // ── 查询当前用户的所有族谱 ──────────────────────────────
  // 返回"我创建的"族谱列表（协作族谱在 collab 模块中处理）
  async findAllByUser(userId: number): Promise<FamilyTree[]> {
    return this.familyRepo.find({
      where: { creatorId: userId },
      order: { updateTime: 'DESC' },   // 最近更新的排在前面
    });
  }

  // ── 查询单个族谱详情 ────────────────────────────────────
  async findOne(treeId: number, userId: number): Promise<FamilyTree> {
    const family = await this.familyRepo.findOne({ where: { treeId } });

    if (!family) {
      throw new NotFoundException('族谱不存在');
    }

    // 权限校验：只有创建者可以查看
    // （后续 collab 模块完成后，受邀者也应能访问，届时再扩展此逻辑）
    if (family.creatorId !== userId) {
      throw new ForbiddenException('无权访问该族谱');
    }

    return family;
  }

  // ── 修改族谱 ────────────────────────────────────────────
  async update(
    treeId: number,
    dto: UpdateFamilyDto,
    userId: number,
  ): Promise<FamilyTree> {
    // 先查出族谱（同时验证存在性和权限）
    const family = await this.findOne(treeId, userId);

    // 只更新传入的字段，未传的字段保持原值
    if (dto.treeName !== undefined) family.treeName = dto.treeName;
    if (dto.surname !== undefined) family.surname = dto.surname;

    return this.familyRepo.save(family);
  }

  // ── 删除族谱 ────────────────────────────────────────────
  async remove(treeId: number, userId: number): Promise<{ message: string }> {
    // 先查出族谱（同时验证存在性和权限）
    const family = await this.findOne(treeId, userId);

    // 数据库设置了 ON DELETE CASCADE，删除族谱会自动级联删除所有成员和协作记录
    await this.familyRepo.remove(family);

    return { message: '族谱已删除' };
  }
}
```

**权限设计说明：**
```
查询列表   → 只返回自己创建的族谱，天然隔离
查询详情   → 检查 creatorId === 当前用户 ID
修改       → 通过 findOne 复用校验逻辑
删除       → 通过 findOne 复用校验逻辑，级联删除由数据库完成
```

---

### Step 4：创建 FamiliesController（路由）

**文件路径：** `backend/src/families/families.controller.ts`

**作用：** 定义 HTTP 接口，所有接口都加了 `@UseGuards(JwtAuthGuard)` 保护，确保只有登录用户才能访问。

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
import { FamiliesService } from './families.service';
import { CreateFamilyDto } from './dto/create-family.dto';
import { UpdateFamilyDto } from './dto/update-family.dto';
import { JwtAuthGuard } from '../auth/auth.guard';

@Controller('families')
@UseGuards(JwtAuthGuard)   // 整个 Controller 的所有接口都需要登录
export class FamiliesController {

  constructor(private readonly familiesService: FamiliesService) {}

  // POST /families
  // 创建新族谱，当前登录用户自动成为创建者
  @Post()
  create(@Body() dto: CreateFamilyDto, @Request() req) {
    // req.user 由 JwtStrategy.validate() 注入，包含 { userId, userName }
    return this.familiesService.create(dto, req.user.userId);
  }

  // GET /families
  // 获取当前用户创建的所有族谱
  @Get()
  findAll(@Request() req) {
    return this.familiesService.findAllByUser(req.user.userId);
  }

  // GET /families/:id
  // 获取单个族谱详情
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    // ParseIntPipe 自动把 URL 里的字符串 "1" 转成数字 1
    return this.familiesService.findOne(id, req.user.userId);
  }

  // PATCH /families/:id
  // 修改族谱名称或姓氏
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFamilyDto,
    @Request() req,
  ) {
    return this.familiesService.update(id, dto, req.user.userId);
  }

  // DELETE /families/:id
  // 删除族谱（仅创建者可操作）
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.familiesService.remove(id, req.user.userId);
  }
}
```

**`@Request() req` 的数据来源：**
```
客户端请求携带 Token
  → JwtAuthGuard 触发 JwtStrategy.validate()
  → validate() 返回 { userId: 1, userName: "alice" }
  → NestJS 把返回值注入到 req.user
  → Controller 里用 req.user.userId 拿到当前用户 ID
```

---

### Step 5：创建 FamiliesModule（组装）

**文件路径：** `backend/src/families/families.module.ts`

**作用：** 把 FamilyTree 实体、FamiliesService、FamiliesController 组装在一起，并引入 AuthModule 以使用 JwtAuthGuard。

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FamilyTree } from './family.entity';
import { FamiliesService } from './families.service';
import { FamiliesController } from './families.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FamilyTree]),  // 注册 FamilyTree 实体
    AuthModule,                               // 引入 AuthModule 才能使用 JwtAuthGuard
  ],
  controllers: [FamiliesController],
  providers: [FamiliesService],
  exports: [FamiliesService],   // 导出，供后续 members、collab 模块使用
})
export class FamiliesModule {}
```

---

### Step 6：修改根模块 AppModule

**文件路径：** `backend/src/app.module.ts`

**作用：** 将 FamiliesModule 注册到应用根模块。

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { FamiliesModule } from './families/families.module';   // 新增

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
    FamiliesModule,   // 新增
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

**第一步：先登录获取 Token**

```
方法：POST
URL：http://localhost:3000/auth/login
Body：{ "userName": "alice", "password": "123456" }

复制响应里的 token 值，后续所有请求都要用到。
```

**在 Postman 里配置 Token（一次配置，所有请求通用）：**
```
Headers → 添加一行：
  Key:   Authorization
  Value: Bearer eyJhbGci...（粘贴你的 token）
```

---

**测试创建族谱：**

```
方法：POST
URL：http://localhost:3000/families
Headers：Authorization: Bearer <token>
Body（raw JSON）：
{
  "treeName": "张氏族谱",
  "surname": "张"
}

期望响应（201）：
{
  "treeId": 1,
  "treeName": "张氏族谱",
  "surname": "张",
  "creatorId": 1,
  "createTime": "2024-01-01T00:00:00.000Z",
  "updateTime": "2024-01-01T00:00:00.000Z"
}
```

---

**测试获取族谱列表：**

```
方法：GET
URL：http://localhost:3000/families
Headers：Authorization: Bearer <token>

期望响应（200）：
[
  {
    "treeId": 1,
    "treeName": "张氏族谱",
    "surname": "张",
    "creatorId": 1,
    ...
  }
]
```

---

**测试获取单个族谱：**

```
方法：GET
URL：http://localhost:3000/families/1
Headers：Authorization: Bearer <token>

期望响应（200）：族谱对象

用另一个账号的 Token 访问 → 期望返回 403 Forbidden
```

---

**测试修改族谱：**

```
方法：PATCH
URL：http://localhost:3000/families/1
Headers：Authorization: Bearer <token>
Body：{ "treeName": "张氏大族谱" }

期望响应（200）：返回更新后的族谱对象，treeName 已变更
```

---

**测试删除族谱：**

```
方法：DELETE
URL：http://localhost:3000/families/1
Headers：Authorization: Bearer <token>

期望响应（200）：{ "message": "族谱已删除" }

再次 GET /families/1 → 期望返回 404 Not Found
```

---

**测试无 Token 访问（应返回 401）：**

```
方法：GET
URL：http://localhost:3000/families
不加 Authorization 头

期望响应（401）：{ "statusCode": 401, "message": "Unauthorized" }
```

五项测试全部通过后，再开始写前端。

---

### Step 8：前端——封装族谱 API

**文件路径：** `frontend/src/api/families.ts`

**作用：** 把所有族谱相关的 HTTP 请求封装成独立函数，页面组件直接调用函数，不用关心请求细节。

```typescript
import client from './client';

// 族谱对象的 TypeScript 类型定义
export interface FamilyTree {
  treeId: number;
  treeName: string;
  surname: string;
  creatorId: number;
  createTime: string;
  updateTime: string;
}

// 创建族谱
export const createFamily = (data: { treeName: string; surname: string }) =>
  client.post<FamilyTree>('/families', data).then((res) => res.data);

// 获取我的族谱列表
export const getFamilies = () =>
  client.get<FamilyTree[]>('/families').then((res) => res.data);

// 获取单个族谱详情
export const getFamily = (id: number) =>
  client.get<FamilyTree>(`/families/${id}`).then((res) => res.data);

// 修改族谱
export const updateFamily = (
  id: number,
  data: { treeName?: string; surname?: string },
) => client.patch<FamilyTree>(`/families/${id}`, data).then((res) => res.data);

// 删除族谱
export const deleteFamily = (id: number) =>
  client.delete<{ message: string }>(`/families/${id}`).then((res) => res.data);
```

---

### Step 9：前端——族谱列表页面

**文件路径：** `frontend/src/pages/FamilyListPage/index.tsx`

**作用：** 展示当前用户的族谱列表，支持新建族谱和删除族谱。

```typescript
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getFamilies,
  createFamily,
  deleteFamily,
  FamilyTree,
} from '../../api/families';

export default function FamilyListPage() {
  const navigate = useNavigate();

  // 族谱列表状态
  const [families, setFamilies]   = useState<FamilyTree[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  // 新建族谱表单状态
  const [showForm, setShowForm]   = useState(false);
  const [treeName, setTreeName]   = useState('');
  const [surname, setSurname]     = useState('');
  const [creating, setCreating]   = useState(false);

  // 页面加载时获取族谱列表
  useEffect(() => {
    loadFamilies();
  }, []);

  const loadFamilies = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getFamilies();
      setFamilies(data);
    } catch (err: any) {
      setError('加载族谱列表失败，请刷新重试');
    } finally {
      setLoading(false);
    }
  };

  // 新建族谱
  const handleCreate = async () => {
    if (!treeName.trim() || !surname.trim()) {
      alert('族谱名称和姓氏不能为空');
      return;
    }
    setCreating(true);
    try {
      const newFamily = await createFamily({ treeName, surname });
      // 把新族谱追加到列表头部，不需要重新请求整个列表
      setFamilies([newFamily, ...families]);
      // 重置表单
      setTreeName('');
      setSurname('');
      setShowForm(false);
    } catch (err: any) {
      alert(err.response?.data?.message || '创建失败，请稍后重试');
    } finally {
      setCreating(false);
    }
  };

  // 删除族谱
  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`确定要删除"${name}"吗？此操作将同时删除所有成员数据，不可恢复。`)) {
      return;
    }
    try {
      await deleteFamily(id);
      // 从列表中移除已删除的族谱
      setFamilies(families.filter((f) => f.treeId !== id));
    } catch (err: any) {
      alert(err.response?.data?.message || '删除失败，请稍后重试');
    }
  };

  // 跳转到族谱详情页（后续开发 members 模块时使用）
  const handleEnter = (id: number) => {
    navigate(`/families/${id}/members`);
  };

  // ── 渲染 ─────────────────────────────────────────────────
  if (loading) return <div style={{ padding: 32 }}>加载中...</div>;

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 16px' }}>

      {/* 页头 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>我的族谱</h2>
        <button onClick={() => setShowForm(!showForm)}>
          {showForm ? '取消' : '+ 新建族谱'}
        </button>
      </div>

      {/* 新建族谱表单 */}
      {showForm && (
        <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 24 }}>
          <h3 style={{ marginTop: 0 }}>新建族谱</h3>

          <div style={{ marginBottom: 12 }}>
            <label>族谱名称</label>
            <input
              value={treeName}
              onChange={(e) => setTreeName(e.target.value)}
              placeholder="例：张氏族谱"
              style={{ display: 'block', width: '100%', padding: 8, marginTop: 4, boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label>姓氏</label>
            <input
              value={surname}
              onChange={(e) => setSurname(e.target.value)}
              placeholder="例：张"
              style={{ display: 'block', width: '100%', padding: 8, marginTop: 4, boxSizing: 'border-box' }}
            />
          </div>

          <button onClick={handleCreate} disabled={creating}>
            {creating ? '创建中...' : '确认创建'}
          </button>
        </div>
      )}

      {/* 错误提示 */}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* 族谱列表 */}
      {families.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#999', padding: 48 }}>
          还没有族谱，点击右上角"新建族谱"开始创建
        </div>
      ) : (
        <div>
          {families.map((family) => (
            <div
              key={family.treeId}
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
              {/* 族谱信息 */}
              <div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>{family.treeName}</div>
                <div style={{ color: '#666', marginTop: 4, fontSize: 14 }}>
                  姓氏：{family.surname} · 最近更新：{new Date(family.updateTime).toLocaleDateString()}
                </div>
              </div>

              {/* 操作按钮 */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleEnter(family.treeId)}>
                  进入管理
                </button>
                <button
                  onClick={() => handleDelete(family.treeId, family.treeName)}
                  style={{ color: 'red', borderColor: 'red' }}
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

### Step 10：更新前端路由

**文件路径：** `frontend/src/App.tsx`

添加族谱列表页的路由：

```typescript
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import FamilyListPage from './pages/FamilyListPage';  // 新增

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/dashboard" element={<FamilyListPage />} />   {/* 新增 */}

      {/* 后续开发中逐步添加 */}
      {/* <Route path="/families/:id/members" element={<MemberPage />} /> */}
    </Routes>
  );
}
```

同时，更新 `LoginPage` 里登录成功后的跳转目标——之前因为没有 dashboard 页面所以是空白，现在会直接进入族谱列表：

```typescript
// frontend/src/pages/LoginPage/index.tsx（原有代码，只修改这一行）
localStorage.setItem('token', res.data.token);
navigate('/dashboard');   // 已经是这个值，无需修改
```

---

## 五、完整测试清单

### 后端测试（Postman）

- [ ] 无 Token 访问任意 families 接口返回 401
- [ ] POST /families 成功创建，返回包含 treeId 的对象
- [ ] GET /families 返回当前用户的族谱数组
- [ ] GET /families/:id 成功返回对应族谱
- [ ] 用其他账号的 Token 访问该族谱返回 403
- [ ] PATCH /families/:id 成功修改，响应中字段已更新
- [ ] DELETE /families/:id 成功删除，再次 GET 返回 404
- [ ] 在 PostgreSQL 里确认数据变更：`SELECT * FROM family_trees;`

### 前端测试（浏览器）

- [ ] 登录后自动跳转到 `/dashboard`，显示族谱列表页
- [ ] 点击"新建族谱"展开表单，填写后点击"确认创建"，新族谱出现在列表顶部
- [ ] 点击"删除"弹出确认框，确认后族谱从列表消失
- [ ] 刷新页面后族谱列表仍然存在（数据持久化正常）
- [ ] 删除所有族谱后显示空状态提示文案
- [ ] 点击"进入管理"跳转到 `/families/:id/members`（目前是空页面，后续开发）

---

## 六、常见错误及解决方法

| 错误信息 | 原因 | 解决方法 |
|----------|------|----------|
| `401 Unauthorized` | Token 未携带或已过期 | 重新登录获取新 Token |
| `403 Forbidden` | 当前用户不是族谱创建者 | 用正确账号登录 |
| `404 Not Found` | 族谱不存在或已被删除 | 检查 treeId 是否正确 |
| `Cannot find module '../auth/auth.guard'` | AuthModule 的导出路径不对 | 检查 `auth.module.ts` 的 exports |
| `FamilyTree is not a known entity` | FamiliesModule 没有注册实体 | 检查 `TypeOrmModule.forFeature([FamilyTree])` |
| 前端列表空白但无报错 | Token 失效被拦截器重定向 | 打开 DevTools Network 检查请求状态 |

---

## 七、目录结构速查

完成所有步骤后，项目结构应该是：

```
Pedigree/
├── backend/
│   └── src/
│       ├── app.module.ts             ← Step 6 修改（添加 FamiliesModule）
│       ├── auth/                     ← 已完成（Auth 模块）
│       ├── users/                    ← 已完成（Users 模块）
│       └── families/
│           ├── dto/
│           │   ├── create-family.dto.ts   ← Step 2
│           │   └── update-family.dto.ts   ← Step 2
│           ├── family.entity.ts           ← Step 1
│           ├── families.service.ts        ← Step 3
│           ├── families.controller.ts     ← Step 4
│           └── families.module.ts         ← Step 5
│
└── frontend/
    └── src/
        ├── App.tsx                   ← Step 10 修改（添加 /dashboard 路由）
        ├── api/
        │   ├── client.ts             ← 已完成
        │   └── families.ts           ← Step 8（新增）
        └── pages/
            ├── LoginPage/            ← 已完成
            ├── RegisterPage/         ← 已完成
            └── FamilyListPage/
                └── index.tsx         ← Step 9（新增）
```

---

## 八、下一步：Members 模块

Families 模块完成后，按以下顺序继续开发：

```
1. Members 模块  → 在某个族谱内管理成员（增删改查 + 模糊搜索）
                   每个 member 通过 tree_id 关联到某个族谱
                   每个接口都需要先验证用户对该族谱有访问权限

2. Marriages 模块 → 管理成员间的婚姻关系
                    需要 Members 模块先完成

3. Query 模块    → 祖先链路查询、亲缘路径查询（递归 SQL）

4. Collab 模块   → 邀请他人协作编辑族谱
                   完成后需要回来修改 findOne 的权限逻辑
                   让受邀者也能访问
```

---

*文档版本：v1.0 · 模块：Families · 项目：Pedigree*