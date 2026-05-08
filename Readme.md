# 寻根溯源 · 族谱管理系统

一个支持多用户、多族谱的家族树管理平台，提供成员管理、血缘与婚姻关系维护、祖先追溯及亲缘路径查询功能。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端框架 | NestJS (Node.js + TypeScript) |
| 数据库 | PostgreSQL |
| 前端框架 | React + TypeScript + Vite |
| 认证方式 | JWT (JSON Web Token) |
| HTTP 客户端 | Axios |
| 运行环境 | WSL2 Ubuntu 22.04 |

---

## 项目结构

```
Pedigree/
├── backend/                  # NestJS 后端
│   ├── src/
│   │   ├── auth/             # 认证模块（注册、登录、JWT）
│   │   ├── users/            # 用户模块
│   │   ├── families/         # 族谱模块
│   │   ├── members/          # 成员模块
│   │   ├── marriages/        # 婚姻关系模块
│   │   ├── collab/           # 协作邀请模块
│   │   ├── query/            # 查询模块（祖先/后代/亲缘路径）
│   │   └── app.module.ts     # 根模块
│   ├── database/
│   │   └── schema.sql        # 数据库建表语句
│   └── .env                  # 环境变量（不提交到 Git）
│
└── frontend/                 # React 前端
    └── src/
        ├── pages/
        │   ├── LoginPage/
        │   ├── DashboardPage/
        │   ├── FamilyListPage/
        │   ├── MemberPage/
        │   ├── MarriagePage/
        │   └── QueryPage/
        ├── components/
        │   ├── TreeChart/    # D3.js 树状图组件
        │   ├── MemberCard/
        │   └── SearchBar/
        ├── api/              # Axios 请求封装
        ├── types/            # TypeScript 类型定义
        ├── store/            # 状态管理
        └── utils/
```

## 快速开始

### 前置条件

- Node.js >= 18
- PostgreSQL >= 14
- npm

### 1. 克隆项目

```bash
git clone <your-repo-url>
cd Pedigree
```

### 2. 配置后端环境变量

在 `backend/` 目录下创建 `.env` 文件：

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_DATABASE=pedigree
JWT_SECRET=your_jwt_secret
```

### 3. 初始化数据库

```bash
sudo service postgresql start
psql -U postgres -c "CREATE DATABASE pedigree;"
psql -U postgres -d pedigree -f backend/database/schema.sql
```

### 4. 启动后端

```bash
cd backend
npm install
npm run start:dev        # 监听 http://localhost:3000
```

### 5. 启动前端

```bash
cd frontend
npm install
npm run dev              # 监听 http://localhost:5173
```

---

## 主要功能

- **用户系统** — 注册、登录，JWT 鉴权，密码 bcrypt 加密
- **族谱管理** — 创建、编辑、删除族谱，支持邀请其他用户协作编辑
- **成员管理** — 成员增删改查，维护父母血缘关系，代际自动校验，姓名模糊搜索
- **婚姻关系** — 记录婚姻与离婚，支持再婚历史
- **树状可视化** — 基于 D3.js 按代际分层展示家族树
- **查询功能** — 追溯完整祖先链路、查询所有直系后代、查找两人之间的亲缘路径

---

## 环境变量说明

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `DB_HOST` | 数据库地址 | `localhost` |
| `DB_PORT` | 数据库端口 | `5432` |
| `DB_USERNAME` | 数据库用户名 | `postgres` |
| `DB_PASSWORD` | 数据库密码 | `yourpassword` |
| `DB_DATABASE` | 数据库名称 | `pedigree` |
| `JWT_SECRET` | JWT 签名密钥 | 任意随机字符串 |


---

## 开发规范

- 后端接口统一前缀：`/api`
- 认证接口：`POST /api/auth/register`、`POST /api/auth/login`
- 受保护接口需在请求头携带：`Authorization: Bearer <token>`
- 数据库不使用 ORM 自动同步（`synchronize: false`），表结构变更需手动修改 `schema.sql`

---