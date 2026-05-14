# Pedigree · Query 模块完整开发指南

> 技术栈：NestJS（后端）· React + TypeScript + D3.js（前端）· PostgreSQL · JWT  
> 适用环境：WSL2 Ubuntu 22.04  
> 前置条件：Auth + Families + Members + Marriages 模块已完成并测试通过  
> 文档版本：v1.0

---

## 一、文件总览

```
backend/src/
├── app.module.ts                          ← 根模块（需修改，添加 QueryModule）
│
└── query/
    ├── query.service.ts                   ← 核心业务逻辑（四种查询的实现）
    ├── query.controller.ts                ← HTTP 路由入口
    └── query.module.ts                    ← 组装所有 query 相关文件

frontend/src/
├── api/
│   └── query.ts                           ← 封装查询相关的 API 请求函数
├── components/
│   └── TreeChart/
│       └── index.tsx                      ← D3.js 树状图组件（祖先/后代可视化）
└── pages/
    └── QueryPage/
        └── index.tsx                      ← 查询页面（四种查询的入口 + 结果展示）
```

---

## 二、接口设计总览

Query 模块只有查询，没有写操作，全部使用 GET 方法。所有接口均需 JWT Token。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/families/:treeId/query/ancestors/:memberId` | 查询某成员的所有祖先（向上递归） |
| GET | `/families/:treeId/query/descendants/:memberId` | 查询某成员的所有后代（向下递归） |
| GET | `/families/:treeId/query/path?from=:id&to=:id` | 查询两人之间的亲缘路径（BFS） |
| GET | `/families/:treeId/query/stats` | 查询族谱统计信息（总人数、男女比例等） |

---

## 三、算法说明

在写代码前先理解每种查询的实现思路。

### 3.1 祖先链路查询（向上递归）

```
从目标成员出发，读取 fatherId 和 motherId
  → 找到父亲和母亲
  → 再分别读取父亲的 fatherId/motherId、母亲的 fatherId/motherId
  → 不断向上，直到没有更多父母记录为止

结果：平铺数组，每条记录附带 generation 字段，前端据此渲染层级
```

### 3.2 后代查询（向下递归）

```
从目标成员出发，找出所有 fatherId = memberId 或 motherId = memberId 的成员
  → 对每个子代再做同样的查找
  → 不断向下，直到没有更多子代为止

结果：平铺数组，同样附带 generation 字段
```

### 3.3 亲缘路径查询（BFS）

```
把族谱所有成员和关系构建成无向图：
  - 血缘边：parent ↔ child（通过 fatherId / motherId）
  - 婚姻边：member1 ↔ member2（通过 marriages 表）

从 fromId 出发做广度优先搜索，找到 toId 时返回路径
路径中每一步附带关系类型（父子、母子、配偶）

结果：路径节点数组 + 每段关系的类型描述
```

### 3.4 族谱统计

```
直接 SQL 聚合查询：
  - 总成员数
  - 男性人数 / 女性人数 / 未知性别人数
  - 最大世代数
  - 在世人数（death 为 null）/ 已故人数
  - 婚姻总数 / 现存婚姻数（divorceDate 为 null）
```

---

## 四、开发顺序与完整代码

---

### Step 1：创建 QueryService

**文件路径：** `backend/src/query/query.service.ts`

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Member } from '../members/member.entity';
import { Marriage } from '../marriages/marriage.entity';
import { FamiliesService } from '../families/families.service';

// 祖先/后代查询结果的单条记录类型
export interface MemberNode {
  memberId: number;
  name: string;
  gender: string | null;
  birth: string | null;
  death: string | null;
  generation: number | null;
  fatherId: number | null;
  motherId: number | null;
  // 相对于查询起点的层级偏移（祖先为负数，后代为正数）
  relativeLevel: number;
}

// 亲缘路径中每一步的描述
export interface PathStep {
  memberId: number;
  name: string;
  relation: string;   // '父亲' | '母亲' | '子女' | '配偶'
}

// 族谱统计结果
export interface FamilyStats {
  totalMembers: number;
  maleCount: number;
  femaleCount: number;
  unknownGenderCount: number;
  aliveCount: number;
  deceasedCount: number;
  maxGeneration: number | null;
  totalMarriages: number;
  activeMarriages: number;
}

@Injectable()
export class QueryService {

  constructor(
    @InjectRepository(Member)
    private readonly memberRepo: Repository<Member>,

    @InjectRepository(Marriage)
    private readonly marriageRepo: Repository<Marriage>,

    private readonly familiesService: FamiliesService,
  ) {}

  // ── 权限校验（内部辅助）──────────────────────────────────
  private async verifyAccess(treeId: number, userId: number) {
    await this.familiesService.findOne(treeId, userId);
  }

  // ── 祖先链路查询 ─────────────────────────────────────────
  async findAncestors(
    treeId: number,
    memberId: number,
    userId: number,
  ): Promise<MemberNode[]> {
    await this.verifyAccess(treeId, userId);

    // 验证起点成员存在
    const start = await this.memberRepo.findOne({ where: { memberId, treeId } });
    if (!start) throw new NotFoundException('成员不存在');

    const result: MemberNode[] = [];
    // 待处理队列：[当前成员ID, 相对层级]
    const queue: Array<{ id: number; level: number }> = [
      { id: start.fatherId, level: -1 },
      { id: start.motherId, level: -1 },
    ].filter((x) => x.id != null) as Array<{ id: number; level: number }>;

    const visited = new Set<number>();

    while (queue.length > 0) {
      const { id, level } = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);

      const member = await this.memberRepo.findOne({ where: { memberId: id, treeId } });
      if (!member) continue;

      result.push({
        memberId: member.memberId,
        name: member.name,
        gender: member.gender,
        birth: member.birth,
        death: member.death,
        generation: member.generation,
        fatherId: member.fatherId,
        motherId: member.motherId,
        relativeLevel: level,
      });

      // 继续向上追溯
      if (member.fatherId) queue.push({ id: member.fatherId, level: level - 1 });
      if (member.motherId) queue.push({ id: member.motherId, level: level - 1 });
    }

    return result;
  }

  // ── 后代查询 ─────────────────────────────────────────────
  async findDescendants(
    treeId: number,
    memberId: number,
    userId: number,
  ): Promise<MemberNode[]> {
    await this.verifyAccess(treeId, userId);

    const start = await this.memberRepo.findOne({ where: { memberId, treeId } });
    if (!start) throw new NotFoundException('成员不存在');

    const result: MemberNode[] = [];
    const queue: Array<{ id: number; level: number }> = [{ id: memberId, level: 0 }];
    const visited = new Set<number>();
    visited.add(memberId);

    while (queue.length > 0) {
      const { id, level } = queue.shift()!;

      // 找出所有以当前成员为父亲或母亲的子代
      const children = await this.memberRepo.find({
        where: [
          { fatherId: id, treeId },
          { motherId: id, treeId },
        ],
      });

      for (const child of children) {
        if (visited.has(child.memberId)) continue;
        visited.add(child.memberId);

        result.push({
          memberId: child.memberId,
          name: child.name,
          gender: child.gender,
          birth: child.birth,
          death: child.death,
          generation: child.generation,
          fatherId: child.fatherId,
          motherId: child.motherId,
          relativeLevel: level + 1,
        });

        queue.push({ id: child.memberId, level: level + 1 });
      }
    }

    return result;
  }

  // ── 亲缘路径查询（BFS）──────────────────────────────────
  async findPath(
    treeId: number,
    fromId: number,
    toId: number,
    userId: number,
  ): Promise<{ path: PathStep[]; found: boolean }> {
    await this.verifyAccess(treeId, userId);

    if (fromId === toId) {
      const m = await this.memberRepo.findOne({ where: { memberId: fromId, treeId } });
      if (!m) throw new NotFoundException('成员不存在');
      return {
        found: true,
        path: [{ memberId: m.memberId, name: m.name, relation: '本人' }],
      };
    }

    // 拉取族谱内所有成员和婚姻关系，构建邻接表
    const allMembers = await this.memberRepo.find({ where: { treeId } });
    const allMarriages = await this.marriageRepo
      .createQueryBuilder('m')
      .where('m.member1_id IN (:...ids)', {
        ids: allMembers.map((m) => m.memberId),
      })
      .getMany();

    // memberMap：memberId → Member 对象，方便快速查找
    const memberMap = new Map(allMembers.map((m) => [m.memberId, m]));

    // 构建邻接表：Map<memberId, Array<{ neighborId, relation }>>
    const graph = new Map<number, Array<{ id: number; relation: string }>>();

    const addEdge = (a: number, b: number, relAtoB: string, relBtoA: string) => {
      if (!graph.has(a)) graph.set(a, []);
      if (!graph.has(b)) graph.set(b, []);
      graph.get(a)!.push({ id: b, relation: relAtoB });
      graph.get(b)!.push({ id: a, relation: relBtoA });
    };

    // 血缘边
    for (const member of allMembers) {
      if (member.fatherId) {
        addEdge(member.memberId, member.fatherId, '父亲', '子女');
      }
      if (member.motherId) {
        addEdge(member.memberId, member.motherId, '母亲', '子女');
      }
    }

    // 婚姻边
    for (const marriage of allMarriages) {
      addEdge(marriage.member1Id, marriage.member2Id, '配偶', '配偶');
    }

    // BFS 寻路
    // prev：记录每个节点的前驱 [prevId, relation(到达当前节点时的关系描述)]
    const prev = new Map<number, { prevId: number; relation: string }>();
    const visited = new Set<number>();
    const bfsQueue: number[] = [fromId];
    visited.add(fromId);

    let found = false;

    while (bfsQueue.length > 0) {
      const current = bfsQueue.shift()!;
      if (current === toId) { found = true; break; }

      const neighbors = graph.get(current) ?? [];
      for (const { id, relation } of neighbors) {
        if (visited.has(id)) continue;
        visited.add(id);
        prev.set(id, { prevId: current, relation });
        bfsQueue.push(id);
      }
    }

    if (!found) {
      return { found: false, path: [] };
    }

    // 回溯路径
    const path: PathStep[] = [];
    let cur = toId;
    while (cur !== fromId) {
      const { prevId, relation } = prev.get(cur)!;
      const member = memberMap.get(cur)!;
      path.unshift({ memberId: member.memberId, name: member.name, relation });
      cur = prevId;
    }
    // 加入起点（起点没有 relation）
    const startMember = memberMap.get(fromId)!;
    path.unshift({ memberId: startMember.memberId, name: startMember.name, relation: '本人' });

    return { found: true, path };
  }

  // ── 族谱统计 ─────────────────────────────────────────────
  async getStats(treeId: number, userId: number): Promise<FamilyStats> {
    await this.verifyAccess(treeId, userId);

    const members = await this.memberRepo.find({ where: { treeId } });
    const memberIds = members.map((m) => m.memberId);

    // 婚姻统计（基于该族谱成员的 member1_id）
    let totalMarriages = 0;
    let activeMarriages = 0;
    if (memberIds.length > 0) {
      totalMarriages = await this.marriageRepo
        .createQueryBuilder('m')
        .where('m.member1_id IN (:...ids)', { ids: memberIds })
        .getCount();

      activeMarriages = await this.marriageRepo
        .createQueryBuilder('m')
        .where('m.member1_id IN (:...ids)', { ids: memberIds })
        .andWhere('m.divorce_date IS NULL')
        .getCount();
    }

    const generations = members
      .map((m) => m.generation)
      .filter((g) => g != null) as number[];

    return {
      totalMembers:        members.length,
      maleCount:           members.filter((m) => m.gender === '男').length,
      femaleCount:         members.filter((m) => m.gender === '女').length,
      unknownGenderCount:  members.filter((m) => !m.gender || m.gender === 'unknown').length,
      aliveCount:          members.filter((m) => m.death == null).length,
      deceasedCount:       members.filter((m) => m.death != null).length,
      maxGeneration:       generations.length > 0 ? Math.max(...generations) : null,
      totalMarriages,
      activeMarriages,
    };
  }
}
```

---

### Step 2：创建 QueryController

**文件路径：** `backend/src/query/query.controller.ts`

```typescript
import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { QueryService } from './query.service';
import { JwtAuthGuard } from '../auth/auth.guard';

@Controller('families/:treeId/query')
@UseGuards(JwtAuthGuard)
export class QueryController {

  constructor(private readonly queryService: QueryService) {}

  // GET /families/:treeId/query/ancestors/:memberId
  // 查询某成员的所有祖先
  @Get('ancestors/:memberId')
  findAncestors(
    @Param('treeId', ParseIntPipe) treeId: number,
    @Param('memberId', ParseIntPipe) memberId: number,
    @Request() req,
  ) {
    return this.queryService.findAncestors(treeId, memberId, req.user.userId);
  }

  // GET /families/:treeId/query/descendants/:memberId
  // 查询某成员的所有后代
  @Get('descendants/:memberId')
  findDescendants(
    @Param('treeId', ParseIntPipe) treeId: number,
    @Param('memberId', ParseIntPipe) memberId: number,
    @Request() req,
  ) {
    return this.queryService.findDescendants(treeId, memberId, req.user.userId);
  }

  // GET /families/:treeId/query/path?from=1&to=5
  // 查询两人之间的亲缘路径
  @Get('path')
  findPath(
    @Param('treeId', ParseIntPipe) treeId: number,
    @Query('from') fromStr: string,
    @Query('to') toStr: string,
    @Request() req,
  ) {
    const fromId = parseInt(fromStr);
    const toId   = parseInt(toStr);

    if (isNaN(fromId) || isNaN(toId)) {
      throw new BadRequestException('from 和 to 参数必须是数字');
    }

    return this.queryService.findPath(treeId, fromId, toId, req.user.userId);
  }

  // GET /families/:treeId/query/stats
  // 获取族谱统计信息
  @Get('stats')
  getStats(
    @Param('treeId', ParseIntPipe) treeId: number,
    @Request() req,
  ) {
    return this.queryService.getStats(treeId, req.user.userId);
  }
}
```

---

### Step 3：创建 QueryModule

**文件路径：** `backend/src/query/query.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Member } from '../members/member.entity';
import { Marriage } from '../marriages/marriage.entity';
import { QueryService } from './query.service';
import { QueryController } from './query.controller';
import { AuthModule } from '../auth/auth.module';
import { FamiliesModule } from '../families/families.module';

@Module({
  imports: [
    // Query 模块直接注入 Member 和 Marriage 的 Repository
    // 不引入 MembersModule / MarriagesModule，避免循环依赖
    TypeOrmModule.forFeature([Member, Marriage]),
    AuthModule,
    FamiliesModule,
  ],
  controllers: [QueryController],
  providers: [QueryService],
})
export class QueryModule {}
```

> **为什么不引入 MembersModule 和 MarriagesModule？**  
> Query 模块只做查询，直接注入 Repository 即可，不需要复用它们的 Service。  
> 如果引入整个模块反而会造成不必要的依赖链，增加循环依赖的风险。

---

### Step 4：修改根模块 AppModule

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
import { QueryModule } from './query/query.module';   // 新增

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
    QueryModule,   // 新增
  ],
})
export class AppModule {}
```

---

### Step 5：用 Postman 测试后端

**前置准备：构造一个有层级关系的测试数据集**

为了让查询有意义，需要先录入有父子关系的成员数据。建议用以下结构：

```
第1代：张大山（memberId 假设为 1）
        ↓ 父亲
第2代：张二牛（memberId 假设为 2，fatherId=1）
        ↓ 父亲
第3代：张小虎（memberId 假设为 3，fatherId=2）

婚姻：张大山 ↔ 李梅（memberId 假设为 4）
```

用已有的 Members 和 Marriages 接口录入以上数据后再开始测试。

---

#### 测试 5.1：祖先查询

```
方法：GET
URL：http://localhost:3000/families/{{treeId}}/query/ancestors/3
Authorization：Bearer {{token}}

期望响应（200）：
[
  {
    "memberId": 2,
    "name": "张二牛",
    "relativeLevel": -1,
    ...
  },
  {
    "memberId": 1,
    "name": "张大山",
    "relativeLevel": -2,
    ...
  }
]
说明：从张小虎（第3代）向上追溯，返回张二牛和张大山
```

---

#### 测试 5.2：后代查询

```
方法：GET
URL：http://localhost:3000/families/{{treeId}}/query/descendants/1
Authorization：Bearer {{token}}

期望响应（200）：
[
  { "memberId": 2, "name": "张二牛", "relativeLevel": 1, ... },
  { "memberId": 3, "name": "张小虎", "relativeLevel": 2, ... }
]
说明：从张大山向下查，返回张二牛（level 1）和张小虎（level 2）
```

---

#### 测试 5.3：亲缘路径查询（血缘路径）

```
方法：GET
URL：http://localhost:3000/families/{{treeId}}/query/path?from=3&to=1
Authorization：Bearer {{token}}

期望响应（200）：
{
  "found": true,
  "path": [
    { "memberId": 3, "name": "张小虎", "relation": "本人" },
    { "memberId": 2, "name": "张二牛", "relation": "父亲" },
    { "memberId": 1, "name": "张大山", "relation": "父亲" }
  ]
}
```

---

#### 测试 5.4：亲缘路径查询（经过婚姻边）

```
方法：GET
URL：http://localhost:3000/families/{{treeId}}/query/path?from=3&to=4
Authorization：Bearer {{token}}

期望响应（200）：
{
  "found": true,
  "path": [
    { "memberId": 3, "name": "张小虎",  "relation": "本人" },
    { "memberId": 2, "name": "张二牛",  "relation": "父亲" },
    { "memberId": 1, "name": "张大山",  "relation": "父亲" },
    { "memberId": 4, "name": "李梅",    "relation": "配偶" }
  ]
}
说明：张小虎 → 张二牛（父亲）→ 张大山（父亲）→ 李梅（配偶）
```

---

#### 测试 5.5：亲缘路径查询（无连接）

```
方法：GET
URL：http://localhost:3000/families/{{treeId}}/query/path?from=1&to=99
Authorization：Bearer {{token}}

期望响应（200）：
{
  "found": false,
  "path": []
}
```

---

#### 测试 5.6：族谱统计

```
方法：GET
URL：http://localhost:3000/families/{{treeId}}/query/stats
Authorization：Bearer {{token}}

期望响应（200）：
{
  "totalMembers": 4,
  "maleCount": 3,
  "femaleCount": 1,
  "unknownGenderCount": 0,
  "aliveCount": 4,
  "deceasedCount": 0,
  "maxGeneration": 3,
  "totalMarriages": 1,
  "activeMarriages": 1
}
```

---

#### 测试 5.7：异常用例

| 测试名称 | URL | 预期状态码 |
|----------|-----|------------|
| 无 Token 访问 | 任意 query 接口，不加 Authorization | `401` |
| 访问他人族谱 | 换另一账号 Token | `403` |
| 成员不存在（祖先查询） | `/query/ancestors/99999` | `404` |
| 成员不存在（后代查询） | `/query/descendants/99999` | `404` |
| path 参数缺失 | `/query/path?from=1`（没有 to） | `400` |
| path 参数非数字 | `/query/path?from=abc&to=1` | `400` |

---

### Step 6：前端——封装查询 API

**文件路径：** `frontend/src/api/query.ts`

```typescript
import client from './client';

export interface MemberNode {
  memberId: number;
  name: string;
  gender: string | null;
  birth: string | null;
  death: string | null;
  generation: number | null;
  fatherId: number | null;
  motherId: number | null;
  relativeLevel: number;
}

export interface PathStep {
  memberId: number;
  name: string;
  relation: string;
}

export interface PathResult {
  found: boolean;
  path: PathStep[];
}

export interface FamilyStats {
  totalMembers: number;
  maleCount: number;
  femaleCount: number;
  unknownGenderCount: number;
  aliveCount: number;
  deceasedCount: number;
  maxGeneration: number | null;
  totalMarriages: number;
  activeMarriages: number;
}

// 祖先查询
export const getAncestors = (treeId: number, memberId: number) =>
  client
    .get<MemberNode[]>(`/families/${treeId}/query/ancestors/${memberId}`)
    .then((res) => res.data);

// 后代查询
export const getDescendants = (treeId: number, memberId: number) =>
  client
    .get<MemberNode[]>(`/families/${treeId}/query/descendants/${memberId}`)
    .then((res) => res.data);

// 亲缘路径查询
export const getPath = (treeId: number, fromId: number, toId: number) =>
  client
    .get<PathResult>(`/families/${treeId}/query/path`, {
      params: { from: fromId, to: toId },
    })
    .then((res) => res.data);

// 族谱统计
export const getStats = (treeId: number) =>
  client
    .get<FamilyStats>(`/families/${treeId}/query/stats`)
    .then((res) => res.data);
```

---

### Step 7：前端——TreeChart 组件（D3.js 树状图）

**文件路径：** `frontend/src/components/TreeChart/index.tsx`

**作用：** 接收平铺的 MemberNode 数组，自动组织成 D3 层级树并渲染。祖先查询和后代查询都复用这个组件。

```typescript
import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { MemberNode } from '../../api/query';

interface Props {
  nodes: MemberNode[];
  rootId: number;       // 查询起点的 memberId
  direction: 'up' | 'down';  // up = 祖先树，down = 后代树
}

export default function TreeChart({ nodes, rootId, direction }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const width  = 800;
    const height = 500;
    const nodeW  = 120;
    const nodeH  = 50;

    // 清空旧内容
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3
      .select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    // 构建层级数据：把平铺数组转成 d3.hierarchy 需要的嵌套结构
    // 以 rootId 为根节点，按 fatherId / motherId 关系连接
    const nodeMap = new Map(nodes.map((n) => [n.memberId, { ...n, children: [] as any[] }]));

    // 根节点（查询起点本身不在 nodes 里，需要单独构造占位）
    const root: any = {
      memberId: rootId,
      name: '（查询起点）',
      children: [],
      relativeLevel: 0,
    };

    if (direction === 'up') {
      // 祖先树：子 → 父，以起点为根，祖先为叶
      // 按 relativeLevel 分层，level=-1 为第一层父母
      const levelMap = new Map<number, any[]>();
      for (const n of nodes) {
        const lvl = n.relativeLevel;
        if (!levelMap.has(lvl)) levelMap.set(lvl, []);
        levelMap.get(lvl)!.push(nodeMap.get(n.memberId)!);
      }
      // 简单布局：level -1 作为 root 的子节点
      root.children = levelMap.get(-1) ?? [];
      for (const [lvl, members] of levelMap) {
        if (lvl <= -2) {
          const parentLevel = levelMap.get(lvl + 1) ?? [];
          parentLevel.forEach((p: any) => {
            const pNode = nodes.find((n) => n.memberId === p.memberId);
            p.children = members.filter(
              (m: any) =>
                nodes.find((n) => n.memberId === m.memberId)?.relativeLevel === lvl,
            );
          });
        }
      }
    } else {
      // 后代树：父 → 子，以起点为根，后代为叶
      for (const n of nodes) {
        const node = nodeMap.get(n.memberId)!;
        const parentNode =
          (n.fatherId && nodeMap.get(n.fatherId)) ||
          (n.motherId && nodeMap.get(n.motherId));

        if (parentNode) {
          parentNode.children.push(node);
        } else {
          // 父母是起点本身
          root.children.push(node);
        }
      }
    }

    // D3 层级布局
    const hierarchy = d3.hierarchy(root);
    const treeLayout = d3.tree<any>().size([width - 100, height - 100]);
    treeLayout(hierarchy);

    const g = svg.append('g').attr('transform', 'translate(50, 50)');

    // 绘制连线
    g.selectAll('.link')
      .data(hierarchy.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('fill', 'none')
      .attr('stroke', '#ccc')
      .attr('stroke-width', 1.5)
      .attr(
        'd',
        d3
          .linkVertical<any, any>()
          .x((d) => d.x)
          .y((d) => d.y),
      );

    // 绘制节点
    const node = g
      .selectAll('.node')
      .data(hierarchy.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', (d: any) => `translate(${d.x},${d.y})`);

    node
      .append('rect')
      .attr('x', -nodeW / 2)
      .attr('y', -nodeH / 2)
      .attr('width', nodeW)
      .attr('height', nodeH)
      .attr('rx', 6)
      .attr('fill', (d: any) =>
        d.data.memberId === rootId ? '#4f46e5' : '#f9fafb',
      )
      .attr('stroke', '#d1d5db')
      .attr('stroke-width', 1);

    node
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.2em')
      .attr('font-size', 13)
      .attr('fill', (d: any) => (d.data.memberId === rootId ? '#fff' : '#111'))
      .text((d: any) => d.data.name);

    node
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1em')
      .attr('font-size', 11)
      .attr('fill', '#6b7280')
      .text((d: any) =>
        d.data.gender ? d.data.gender : '',
      );
  }, [nodes, rootId, direction]);

  if (nodes.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: '#999', padding: 32 }}>
        暂无数据
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg ref={svgRef} />
    </div>
  );
}
```

---

### Step 8：前端——查询页面

**文件路径：** `frontend/src/pages/QueryPage/index.tsx`

```typescript
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  getAncestors,
  getDescendants,
  getPath,
  getStats,
  MemberNode,
  PathStep,
  FamilyStats,
} from '../../api/query';
import { getMembers, Member } from '../../api/members';
import TreeChart from '../../components/TreeChart';

type Tab = 'ancestors' | 'descendants' | 'path' | 'stats';

export default function QueryPage() {
  const { treeId } = useParams<{ treeId: string }>();
  const numericTreeId = Number(treeId);

  const [activeTab, setActiveTab] = useState<Tab>('stats');
  const [members, setMembers]     = useState<Member[]>([]);

  // 祖先/后代查询
  const [targetId, setTargetId]           = useState<number>(0);
  const [treeNodes, setTreeNodes]         = useState<MemberNode[]>([]);
  const [treeDirection, setTreeDirection] = useState<'up' | 'down'>('up');

  // 路径查询
  const [fromId, setFromId]     = useState<number>(0);
  const [toId, setToId]         = useState<number>(0);
  const [pathResult, setPathResult] = useState<{ found: boolean; path: PathStep[] } | null>(null);

  // 统计
  const [stats, setStats] = useState<FamilyStats | null>(null);

  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    // 加载成员列表（用于下拉选择）和统计数据
    Promise.all([
      getMembers(numericTreeId),
      getStats(numericTreeId),
    ]).then(([memberData, statsData]) => {
      setMembers(memberData);
      setStats(statsData);
    });
  }, []);

  const handleAncestors = async () => {
    if (!targetId) { alert('请选择成员'); return; }
    setLoading(true); setError('');
    try {
      const data = await getAncestors(numericTreeId, targetId);
      setTreeNodes(data);
      setTreeDirection('up');
    } catch (e: any) {
      setError(e.response?.data?.message || '查询失败');
    } finally { setLoading(false); }
  };

  const handleDescendants = async () => {
    if (!targetId) { alert('请选择成员'); return; }
    setLoading(true); setError('');
    try {
      const data = await getDescendants(numericTreeId, targetId);
      setTreeNodes(data);
      setTreeDirection('down');
    } catch (e: any) {
      setError(e.response?.data?.message || '查询失败');
    } finally { setLoading(false); }
  };

  const handlePath = async () => {
    if (!fromId || !toId) { alert('请选择两位成员'); return; }
    setLoading(true); setError('');
    try {
      const data = await getPath(numericTreeId, fromId, toId);
      setPathResult(data);
    } catch (e: any) {
      setError(e.response?.data?.message || '查询失败');
    } finally { setLoading(false); }
  };

  const MemberSelect = ({
    value,
    onChange,
    placeholder,
  }: {
    value: number;
    onChange: (id: number) => void;
    placeholder: string;
  }) => (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ padding: 8, minWidth: 200 }}
    >
      <option value={0}>{placeholder}</option>
      {members.map((m) => (
        <option key={m.memberId} value={m.memberId}>
          {m.name}（第 {m.generation ?? '?'} 代）
        </option>
      ))}
    </select>
  );

  const tabStyle = (tab: Tab) => ({
    padding: '8px 20px',
    cursor: 'pointer',
    borderBottom: activeTab === tab ? '2px solid #4f46e5' : '2px solid transparent',
    fontWeight: activeTab === tab ? 600 : 400,
    color: activeTab === tab ? '#4f46e5' : '#555',
    background: 'none',
    border: 'none',
    borderBottomWidth: 2,
    borderBottomStyle: 'solid' as const,
    borderBottomColor: activeTab === tab ? '#4f46e5' : 'transparent',
  });

  return (
    <div style={{ maxWidth: 900, margin: '40px auto', padding: '0 16px' }}>
      <h2 style={{ marginBottom: 24 }}>族谱查询</h2>

      {/* Tab 切换 */}
      <div style={{ display: 'flex', borderBottom: '1px solid #eee', marginBottom: 24 }}>
        {([
          ['stats',       '📊 统计概览'],
          ['ancestors',   '⬆️ 祖先查询'],
          ['descendants', '⬇️ 后代查询'],
          ['path',        '🔗 亲缘路径'],
        ] as [Tab, string][]).map(([tab, label]) => (
          <button key={tab} style={tabStyle(tab)} onClick={() => setActiveTab(tab)}>
            {label}
          </button>
        ))}
      </div>

      {error && <p style={{ color: 'red', marginBottom: 16 }}>{error}</p>}

      {/* 统计概览 */}
      {activeTab === 'stats' && stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[
            ['总成员数',    stats.totalMembers],
            ['男性',        stats.maleCount],
            ['女性',        stats.femaleCount],
            ['在世',        stats.aliveCount],
            ['已故',        stats.deceasedCount],
            ['最大世代',    stats.maxGeneration ?? '—'],
            ['婚姻总数',    stats.totalMarriages],
            ['现存婚姻',    stats.activeMarriages],
            ['性别未知',    stats.unknownGenderCount],
          ].map(([label, value]) => (
            <div
              key={label as string}
              style={{
                border: '1px solid #eee',
                borderRadius: 8,
                padding: '16px 20px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 700, color: '#4f46e5' }}>{value}</div>
              <div style={{ color: '#666', marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* 祖先查询 */}
      {activeTab === 'ancestors' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <MemberSelect value={targetId} onChange={setTargetId} placeholder="选择查询起点" />
            <button onClick={handleAncestors} disabled={loading}>
              {loading ? '查询中...' : '查询祖先'}
            </button>
          </div>
          {treeNodes.length > 0 && treeDirection === 'up' && (
            <>
              <p style={{ color: '#666' }}>共找到 {treeNodes.length} 位祖先</p>
              <TreeChart nodes={treeNodes} rootId={targetId} direction="up" />
            </>
          )}
        </div>
      )}

      {/* 后代查询 */}
      {activeTab === 'descendants' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <MemberSelect value={targetId} onChange={setTargetId} placeholder="选择查询起点" />
            <button onClick={handleDescendants} disabled={loading}>
              {loading ? '查询中...' : '查询后代'}
            </button>
          </div>
          {treeNodes.length > 0 && treeDirection === 'down' && (
            <>
              <p style={{ color: '#666' }}>共找到 {treeNodes.length} 位后代</p>
              <TreeChart nodes={treeNodes} rootId={targetId} direction="down" />
            </>
          )}
        </div>
      )}

      {/* 亲缘路径查询 */}
      {activeTab === 'path' && (
        <div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
            <MemberSelect value={fromId} onChange={setFromId} placeholder="起点成员" />
            <span style={{ color: '#999' }}>→</span>
            <MemberSelect value={toId} onChange={setToId} placeholder="终点成员" />
            <button onClick={handlePath} disabled={loading}>
              {loading ? '查询中...' : '查找路径'}
            </button>
          </div>

          {pathResult && (
            pathResult.found ? (
              <div>
                <p style={{ color: '#666' }}>
                  共 {pathResult.path.length - 1} 步关系链：
                </p>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                  {pathResult.path.map((step, i) => (
                    <span key={step.memberId} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span
                        style={{
                          border: '1px solid #d1d5db',
                          borderRadius: 6,
                          padding: '6px 12px',
                          background: i === 0 ? '#eef2ff' : '#fff',
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{step.name}</span>
                        {i > 0 && (
                          <span style={{ color: '#6b7280', fontSize: 12, marginLeft: 4 }}>
                            （{step.relation}）
                          </span>
                        )}
                      </span>
                      {i < pathResult.path.length - 1 && (
                        <span style={{ color: '#9ca3af' }}>→</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p style={{ color: '#f59e0b' }}>两人之间没有找到亲缘关系。</p>
            )
          )}
        </div>
      )}
    </div>
  );
}
```

---

### Step 9：更新前端路由

**文件路径：** `frontend/src/App.tsx`

```typescript
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import FamilyListPage from './pages/FamilyListPage';
import MemberPage from './pages/MemberPage';
import MarriagePage from './pages/MarriagePage';
import QueryPage from './pages/QueryPage';   // 新增

export default function App() {
  return (
    <Routes>
      <Route path="/"          element={<Navigate to="/login" replace />} />
      <Route path="/login"     element={<LoginPage />} />
      <Route path="/register"  element={<RegisterPage />} />
      <Route path="/dashboard" element={<FamilyListPage />} />
      <Route path="/families/:treeId/members"   element={<MemberPage />} />
      <Route path="/families/:treeId/marriages" element={<MarriagePage />} />
      <Route path="/families/:treeId/query"     element={<QueryPage />} />   {/* 新增 */}
    </Routes>
  );
}
```

---

## 五、完整测试清单

### 后端测试（Postman）

- [ ] 无 Token 访问返回 401
- [ ] 访问他人族谱返回 403
- [ ] 祖先查询：返回正确的祖先列表，relativeLevel 为负数且层级正确
- [ ] 祖先查询：起点没有父母时返回空数组
- [ ] 后代查询：返回正确的后代列表，relativeLevel 为正数且层级正确
- [ ] 后代查询：起点没有后代时返回空数组
- [ ] 路径查询（血缘路径）：返回正确路径，relation 描述正确
- [ ] 路径查询（经过婚姻边）：路径中出现"配偶"关系
- [ ] 路径查询（无连接）：返回 `{ found: false, path: [] }`
- [ ] 路径查询（from === to）：返回长度为 1 的路径，relation 为"本人"
- [ ] 路径查询缺少参数：返回 400
- [ ] 统计查询：各字段数值与数据库实际数据一致

### 前端测试（浏览器）

- [ ] 统计概览卡片正确显示各项数字
- [ ] 祖先查询选择成员后点击查询，D3 树状图正确渲染
- [ ] 后代查询同上
- [ ] 亲缘路径查询显示正确的步骤链，起点高亮
- [ ] 两人无关联时显示提示文案
- [ ] 切换 Tab 时上一次的查询结果保留

---

## 六、常见错误及解决方法

| 错误信息 | 原因 | 解决方法 |
|----------|------|----------|
| `401 Unauthorized` | Token 过期 | 重新登录 |
| `404 成员不存在` | memberId 不属于该族谱 | 确认 memberId 正确 |
| `400 from 和 to 参数必须是数字` | URL 参数格式错误 | 检查 `?from=&to=` 的值 |
| 祖先/后代查询返回空数组 | 成员没有录入 fatherId / motherId | 在 Members 页补充父子关系字段 |
| D3 图不显示 | nodes 数组为空或 rootId 不在 nodes 里 | 检查查询结果，确认有数据再渲染 |
| `Member is not a known entity` in QueryModule | TypeOrmModule.forFeature 缺少 Marriage | 检查 `query.module.ts` 的 imports |
| 路径查询结果关系描述反向 | BFS 方向问题 | 检查 `addEdge` 的 relAtoB / relBtoA 参数顺序 |

---

## 七、目录结构速查

```
Pedigree/
├── backend/
│   └── src/
│       ├── app.module.ts          ← Step 4 修改
│       ├── auth/                  ← 已完成
│       ├── users/                 ← 已完成
│       ├── families/              ← 已完成
│       ├── members/               ← 已完成
│       ├── marriages/             ← 已完成
│       └── query/
│           ├── query.service.ts   ← Step 1
│           ├── query.controller.ts ← Step 2
│           └── query.module.ts    ← Step 3
│
└── frontend/
    └── src/
        ├── App.tsx                ← Step 9 修改
        ├── api/
        │   └── query.ts           ← Step 6
        ├── components/
        │   └── TreeChart/
        │       └── index.tsx      ← Step 7
        └── pages/
            └── QueryPage/
                └── index.tsx      ← Step 8
```

---

## 八、下一步：Collab 模块

Query 模块完成后，最后一个模块是 Collab（协作邀请）：

```
Collab 模块完成后需要同步修改 FamiliesService.findOne：
  当前逻辑：creatorId === userId 才允许访问
  修改后：  creatorId === userId 或 collab 表中存在 (treeId, userId) 记录

修改完成后，Members / Marriages / Query 的权限校验
全部通过 FamiliesService.findOne 复用，无需单独改动。
```

---

*文档版本：v1.0 · 模块：Query · 项目：Pedigree · 环境：WSL2 Ubuntu 22.04*