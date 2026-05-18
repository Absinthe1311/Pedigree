# Pedigree · DashboardPage 开发文档

> 技术栈：React + TypeScript · Zustand · React Router · Vite  
> 前置条件：LoginPage / RegisterPage 已完成，`api/client.ts` 已配置  
> 文档版本：v1.0

---

## 一、文件总览

本阶段新建或修改以下文件：

```
frontend/src/
├── App.tsx                               ← 修改：添加 /dashboard 和 /families 路由
├── types/
│   └── family.ts                         ← 新建：FamilyTree 类型定义
├── store/
│   └── authStore.ts                      ← 新建：Zustand 全局用户状态
├── api/
│   └── families.ts                       ← 新建：族谱接口封装
├── components/
│   └── AppLayout/
│       └── index.tsx                     ← 新建：左侧导航框架（所有登录后页面共用）
└── pages/
    └── DashboardPage/
        └── index.tsx                     ← 新建：总览页面
```

---

## 二、TypeScript 类型规则

项目开启了 `verbatimModuleSyntax`，规则如下：

```typescript
// ✅ 导入纯类型（interface / type）时，必须加 type 关键字
import type { FamilyTree } from '../types/family';

// ✅ 导入函数、hook、值时，正常 import
import { getFamilies } from '../api/families';
import { useAuthStore } from '../store/authStore';
```

凡是从 `types/` 目录导入的内容，统一使用 `import type`，否则 TypeScript 会报 ts(1484) 错误。

---

## 三、开发顺序与完整代码

> **原则：从底层依赖开始，逐层向上。**  
> types → store → api → components → pages → App.tsx

---

### Step 1：定义 FamilyTree 类型

**文件路径：** `frontend/src/types/family.ts`

**作用：** 统一定义族谱对象的 TypeScript 类型，供 `api/` 和 `pages/` 共用，避免重复定义。

```typescript
export interface FamilyTree {
  treeId: number;
  treeName: string;
  surname: string;
  creatorId: number;
  createTime: string;
  updateTime: string;
  memberCount?: number;   // 后端可选返回，用于统计总人数
}
```

**字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `treeId` | number | 族谱唯一 ID，对应数据库 `tree_id` |
| `treeName` | string | 族谱名称，如"张氏族谱" |
| `surname` | string | 姓氏，如"张" |
| `creatorId` | number | 创建者的 userId |
| `createTime` | string | 创建时间（ISO 字符串） |
| `updateTime` | string | 最近更新时间（ISO 字符串） |
| `memberCount` | number? | 成员总数，后端可选附带 |

---

### Step 2：创建 Zustand 用户状态

**文件路径：** `frontend/src/store/authStore.ts`

**作用：** 全局存储当前登录用户的 token 和用户信息，供所有页面直接读取，避免层层 props 传递。初始化时从 `localStorage` 恢复上次的登录状态。

```typescript
import { create } from 'zustand';

export interface AuthUser {
  userId: number;
  userName: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  // 初始化：从 localStorage 恢复登录状态
  token: localStorage.getItem('token'),

  user: (() => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })(),

  // 登录成功后调用：同时写入 localStorage 和 Zustand state
  setAuth: (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ token, user });
  },

  // 退出登录：清空 localStorage 和 Zustand state
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ token: null, user: null });
  },
}));
```

**在 LoginPage 中调用 setAuth：**

登录成功后，需要用 `setAuth` 替换原有的手动 `localStorage.setItem`：

```typescript
// frontend/src/pages/LoginPage/index.tsx（仅修改登录成功回调部分）
import { useAuthStore } from '../../store/authStore';

const { setAuth } = useAuthStore();

// 登录成功后（res 是后端返回的响应）：
setAuth(res.data.token, {
  userId: res.data.userId,       // 根据后端实际返回字段名调整
  userName: res.data.userName,   // 根据后端实际返回字段名调整
});
navigate('/dashboard');
```

> **注意：** `userId` / `userName` 需要与你的后端登录接口返回的 JSON 字段名保持一致。

---

### Step 3：封装族谱 API

**文件路径：** `frontend/src/api/families.ts`

**作用：** 把所有族谱相关的 HTTP 请求封装成独立函数，页面组件直接调用，不用关心请求细节。Token 由 `client.ts` 的拦截器自动注入。

```typescript
import client from './client';
import type { FamilyTree } from '../types/family';

// 获取当前用户的所有族谱（自建 + 受邀）
export const getFamilies = () =>
  client.get<FamilyTree[]>('/families').then((res) => res.data);

// 获取单个族谱详情
export const getFamily = (id: number) =>
  client.get<FamilyTree>(`/families/${id}`).then((res) => res.data);

// 创建族谱
export const createFamily = (data: { treeName: string; surname: string }) =>
  client.post<FamilyTree>('/families', data).then((res) => res.data);

// 修改族谱
export const updateFamily = (
  id: number,
  data: { treeName?: string; surname?: string },
) => client.patch<FamilyTree>(`/families/${id}`, data).then((res) => res.data);

// 删除族谱
export const deleteFamily = (id: number) =>
  client.delete<{ message: string }>(`/families/${id}`).then((res) => res.data);
```

> **重要：** 导入 `FamilyTree` 时必须使用 `import type`，否则 TypeScript 报 ts(1484) 错误（见第二节）。

---

### Step 4：创建 AppLayout（左侧导航框架）

**文件路径：** `frontend/src/components/AppLayout/index.tsx`

**作用：** 所有登录后页面的共用框架——左侧固定导航栏 + 右侧内容区。导航高亮根据当前路径自动判断，退出登录清空 authStore 并跳转到登录页。

**设计风格：** 简洁白底，衬线字体，中式文书感。Logo 为黑色方块内嵌 🌳 图标。

```typescript
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

interface Props {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { key: '/dashboard', icon: HomeIcon,   label: '总览'    },
  { key: '/families',  icon: BookIcon,   label: '我的族谱' },
];

// 内联 SVG 图标，无外部依赖
function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke={active ? '#1a1a1a' : '#9ca3af'} strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
      <path d="M9 21V12h6v9"/>
    </svg>
  );
}

function BookIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke={active ? '#1a1a1a' : '#9ca3af'} strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="#9ca3af" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
      <polyline points="16,17 21,12 16,7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}

export default function AppLayout({ children }: Props) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, logout } = useAuthStore();
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // 取用户名第一个字作为头像文字
  const initials = user?.userName
    ? user.userName.slice(0, 1).toUpperCase()
    : '?';

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      background: '#f7f6f3',
      fontFamily: "'Noto Serif SC', 'Songti SC', Georgia, serif",
    }}>

      {/* ── 左侧导航栏 ── */}
      <aside style={{
        width: 232,
        flexShrink: 0,
        background: '#ffffff',
        borderRight: '1px solid #ececea',
        display: 'flex',
        flexDirection: 'column',
      }}>

        {/* Logo 区域 */}
        <div style={{
          padding: '28px 20px 22px',
          borderBottom: '1px solid #f0efed',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32,
              height: 32,
              background: '#1a1a1a',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
            }}>
              🌳
            </div>
            <div>
              <div style={{
                fontSize: 14,
                fontWeight: 700,
                color: '#1a1a1a',
                letterSpacing: '0.02em',
              }}>
                家谱系统
              </div>
              <div style={{ fontSize: 11, color: '#b5b3ae', letterSpacing: '0.04em' }}>
                Pedigree
              </div>
            </div>
          </div>
        </div>

        {/* 导航菜单 */}
        <nav style={{ flex: 1, padding: '12px 10px' }}>
          {NAV_ITEMS.map(({ key, icon: Icon, label }) => {
            const isActive  = location.pathname === key;
            const isHovered = hoveredKey === key;
            return (
              <div
                key={key}
                onClick={() => navigate(key)}
                onMouseEnter={() => setHoveredKey(key)}
                onMouseLeave={() => setHoveredKey(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  borderRadius: 7,
                  cursor: 'pointer',
                  marginBottom: 2,
                  background: isActive
                    ? '#f0efed'
                    : isHovered ? '#f7f6f3' : 'transparent',
                  transition: 'background 0.12s ease',
                }}
              >
                <Icon active={isActive} />
                <span style={{
                  fontSize: 13.5,
                  color: isActive ? '#1a1a1a' : '#6b7280',
                  fontWeight: isActive ? 600 : 400,
                  letterSpacing: '0.01em',
                }}>
                  {label}
                </span>
                {/* 激活状态小圆点 */}
                {isActive && (
                  <div style={{
                    marginLeft: 'auto',
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: '#1a1a1a',
                  }} />
                )}
              </div>
            );
          })}
        </nav>

        {/* 底部用户信息 + 退出登录 */}
        <div style={{
          padding: '14px 16px',
          borderTop: '1px solid #f0efed',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 10,
          }}>
            {/* 头像：取用户名首字 */}
            <div style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: '#e8e6e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 600,
              color: '#4b4945',
              flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{
              fontSize: 13,
              fontWeight: 500,
              color: '#1a1a1a',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {user?.userName ?? '用户'}
            </div>
          </div>
          <div
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              color: '#9ca3af',
              cursor: 'pointer',
              padding: '4px 0',
              transition: 'color 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#6b7280')}
            onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
          >
            <LogoutIcon />
            退出登录
          </div>
        </div>
      </aside>

      {/* ── 右侧内容区 ── */}
      <main style={{
        flex: 1,
        overflowY: 'auto',
        padding: '44px 52px',
      }}>
        {children}
      </main>
    </div>
  );
}
```

**AppLayout 的使用方式：**

```typescript
// 任何登录后的页面，用 AppLayout 包裹内容即可
export default function SomePage() {
  return (
    <AppLayout>
      <div>页面内容放在这里</div>
    </AppLayout>
  );
}
```

---

### Step 5：创建 DashboardPage

**文件路径：** `frontend/src/pages/DashboardPage/index.tsx`

**包含三个内部子组件：**

- `StatCard` — 统计数字卡片，有入场动画
- `FamilyCard` — 族谱预览卡片，悬停上浮效果
- `EmptyFamilies` — 空状态提示
- `Skeleton` — 加载占位骨架屏

**动画机制：** 所有卡片使用 `setTimeout` + `useState(visible)` 实现 staggered fadeIn（错开入场），避免全部同时出现。

```typescript
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/AppLayout';
import { useAuthStore } from '../../store/authStore';
import { getFamilies } from '../../api/families';
import type { FamilyTree } from '../../types/family';

// ── 统计卡片 ────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: number | string;
  sub?: string;
  delay: number;   // 入场延迟（毫秒）
}

function StatCard({ label, value, sub, delay }: StatCardProps) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #ececea',
      borderRadius: 12,
      padding: '22px 26px',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(10px)',
      transition: 'opacity 0.4s ease, transform 0.4s ease',
    }}>
      <div style={{
        fontSize: 11,
        color: '#9ca3af',
        letterSpacing: '0.08em',
        textTransform: 'uppercase' as const,
        marginBottom: 10,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 34,
        fontWeight: 700,
        color: '#1a1a1a',
        lineHeight: 1,
        letterSpacing: '-0.02em',
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: '#b5b3ae', marginTop: 6 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── 族谱预览卡片 ─────────────────────────────────────────────
interface FamilyCardProps {
  family: FamilyTree;
  delay: number;
  onClick: () => void;
}

function FamilyCard({ family, delay, onClick }: FamilyCardProps) {
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  const updatedAt = new Date(family.updateTime).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#ffffff',
        border: '1px solid #ececea',
        borderRadius: 12,
        padding: '20px',
        cursor: 'pointer',
        opacity: visible ? 1 : 0,
        transform: visible
          ? hovered ? 'translateY(-3px)' : 'translateY(0)'
          : 'translateY(12px)',
        boxShadow: hovered ? '0 6px 20px rgba(0,0,0,0.07)' : 'none',
        transition: 'opacity 0.4s ease, transform 0.3s ease, box-shadow 0.3s ease',
      }}
    >
      {/* 姓氏徽章 */}
      <div style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        background: '#f7f6f3',
        border: '1px solid #ececea',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        marginBottom: 14,
        color: '#4b4945',
        fontWeight: 700,
      }}>
        {family.surname}
      </div>

      {/* 族谱名称 */}
      <div style={{
        fontSize: 14,
        fontWeight: 600,
        color: '#1a1a1a',
        marginBottom: 4,
        letterSpacing: '0.01em',
      }}>
        {family.treeName}
      </div>

      {/* 成员数 */}
      <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>
        {family.memberCount ?? 0} 位成员
      </div>

      {/* 底部元信息 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 12,
        borderTop: '1px solid #f5f4f2',
      }}>
        <span style={{ fontSize: 11, color: '#b5b3ae' }}>
          更新于 {updatedAt}
        </span>
        <span style={{ fontSize: 11, color: '#d1cfcb' }}>→</span>
      </div>
    </div>
  );
}

// ── 空状态 ────────────────────────────────────────────────────
function EmptyFamilies({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div style={{
      border: '1.5px dashed #e5e4e0',
      borderRadius: 12,
      padding: '52px 0',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🌱</div>
      <div style={{ fontSize: 14, color: '#9ca3af', marginBottom: 4 }}>
        还没有族谱
      </div>
      <div style={{ fontSize: 13, color: '#b5b3ae' }}>
        前往
        <span
          onClick={onNavigate}
          style={{
            color: '#4b4945',
            textDecoration: 'underline',
            textUnderlineOffset: 3,
            cursor: 'pointer',
            margin: '0 4px',
          }}
        >
          我的族谱
        </span>
        页面创建第一个族谱
      </div>
    </div>
  );
}

// ── 骨架屏 ────────────────────────────────────────────────────
function Skeleton({ width, height, radius = 6 }: {
  width: string | number;
  height: number;
  radius?: number;
}) {
  return (
    <div style={{
      width,
      height,
      borderRadius: radius,
      background: 'linear-gradient(90deg, #f0efed 25%, #e8e7e4 50%, #f0efed 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  );
}

// ── 主页面 ────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [families, setFamilies] = useState<FamilyTree[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [headerVisible, setHeaderVisible] = useState(false);

  // 页头入场动画
  useEffect(() => {
    const t = setTimeout(() => setHeaderVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  // 加载族谱列表
  useEffect(() => {
    getFamilies()
      .then(setFamilies)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalMembers = families.reduce((sum, f) => sum + (f.memberCount ?? 0), 0);

  // 根据当前时间显示问候语
  const hour = new Date().getHours();
  const greeting =
    hour < 6  ? '夜深了'  :
    hour < 12 ? '早上好'  :
    hour < 18 ? '下午好'  : '晚上好';

  return (
    <AppLayout>
      {/* 骨架屏 shimmer 动画 */}
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* ── 欢迎语 ── */}
      <div style={{
        marginBottom: 40,
        opacity: headerVisible ? 1 : 0,
        transform: headerVisible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
      }}>
        <div style={{
          fontSize: 11,
          color: '#b5b3ae',
          letterSpacing: '0.1em',
          textTransform: 'uppercase' as const,
          marginBottom: 8,
        }}>
          {greeting}
        </div>
        <h1 style={{
          fontSize: 28,
          fontWeight: 700,
          color: '#1a1a1a',
          margin: 0,
          letterSpacing: '-0.03em',
          lineHeight: 1.2,
        }}>
          {user?.userName ?? '用户'}
        </h1>
        <p style={{
          color: '#9ca3af',
          marginTop: 8,
          fontSize: 14,
          lineHeight: 1.6,
        }}>
          这里是你的族谱管理中心，记录每一段家族的历史。
        </p>
      </div>

      {/* ── 统计卡片 ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: 14,
        marginBottom: 44,
      }}>
        {loading ? (
          <>
            <Skeleton width="100%" height={96} radius={12} />
            <Skeleton width="100%" height={96} radius={12} />
          </>
        ) : (
          <>
            <StatCard
              label="族谱总数"
              value={families.length}
              sub={families.length === 0 ? '尚未创建' : `共 ${families.length} 部`}
              delay={120}
            />
            <StatCard
              label="成员总数"
              value={totalMembers}
              sub={totalMembers === 0 ? '尚未录入' : `来自 ${families.length} 部族谱`}
              delay={200}
            />
          </>
        )}
      </div>

      {/* ── 族谱列表预览 ── */}
      <div>
        {/* 区块标题 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 18,
        }}>
          <div style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#4b4945',
            letterSpacing: '0.04em',
          }}>
            我的族谱
          </div>
          <div
            onClick={() => navigate('/families')}
            style={{
              fontSize: 12,
              color: '#9ca3af',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#4b4945')}
            onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
          >
            查看全部 →
          </div>
        </div>

        {/* 卡片网格 */}
        {loading ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 14,
          }}>
            {[0, 1, 2].map(i => (
              <Skeleton key={i} width="100%" height={160} radius={12} />
            ))}
          </div>
        ) : families.length === 0 ? (
          <EmptyFamilies onNavigate={() => navigate('/families')} />
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 14,
          }}>
            {/* 最多展示 6 个 */}
            {families.slice(0, 6).map((family, i) => (
              <FamilyCard
                key={family.treeId}
                family={family}
                delay={280 + i * 60}
                onClick={() => navigate(`/families/${family.treeId}`)}
              />
            ))}

            {/* 超过 6 个时显示"查看其余"虚线卡片 */}
            {families.length > 6 && (
              <div
                onClick={() => navigate('/families')}
                style={{
                  border: '1.5px dashed #e5e4e0',
                  borderRadius: 12,
                  padding: '20px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column' as const,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  color: '#b5b3ae',
                  fontSize: 13,
                  transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = '#9ca3af';
                  (e.currentTarget as HTMLDivElement).style.color = '#6b7280';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = '#e5e4e0';
                  (e.currentTarget as HTMLDivElement).style.color = '#b5b3ae';
                }}
              >
                <span style={{ fontSize: 20 }}>+</span>
                查看其余 {families.length - 6} 部族谱
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
```

---

### Step 6：更新 App.tsx 路由

**文件路径：** `frontend/src/App.tsx`

```typescript
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage      from './pages/LoginPage';
import RegisterPage   from './pages/RegisterPage';
import DashboardPage  from './pages/DashboardPage';
import FamilyListPage from './pages/FamilyListPage';
// import FamilyDetailPage from './pages/FamilyDetailPage'; // 后续开发

export default function App() {
  return (
    <Routes>
      <Route path="/"          element={<Navigate to="/login" replace />} />
      <Route path="/login"     element={<LoginPage />} />
      <Route path="/register"  element={<RegisterPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/families"  element={<FamilyListPage />} />
      {/* <Route path="/families/:treeId" element={<FamilyDetailPage />} /> */}
    </Routes>
  );
}
```

---

## 四、页面结构示意

```
┌─────────────────────────────────────────────────────────┐
│  左侧导航（232px）        右侧内容区（flex: 1）          │
│ ┌──────────────────┐  ┌──────────────────────────────┐  │
│ │ 🌳 家谱系统       │  │ 早上好                        │  │
│ │    Pedigree      │  │ 张三                          │  │
│ ├──────────────────┤  │ 这里是你的族谱管理中心…        │  │
│ │ ● 总览  ←高亮    │  ├──────────────────────────────┤  │
│ │   我的族谱       │  │ [族谱总数 3]   [成员总数 47]  │  │
│ │                  │  ├──────────────────────────────┤  │
│ │                  │  │ 我的族谱              查看全部 │  │
│ │                  │  │ ┌──────┐ ┌──────┐ ┌──────┐  │  │
│ ├──────────────────┤  │ │  张  │ │  李  │ │  王  │  │  │
│ │ ○ 张三           │  │ │张氏  │ │李氏  │ │王氏  │  │  │
│ │   退出登录       │  │ │3人   │ │12人  │ │32人  │  │  │
│ └──────────────────┘  │ └──────┘ └──────┘ └──────┘  │  │
│                        └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 五、常见错误及解决方法

| 错误 | 原因 | 解决方法 |
|------|------|----------|
| `ts(1484)` import type 报错 | 导入纯类型未加 `type` 关键字 | 改为 `import type { FamilyTree }` |
| 页面跳转后用户名显示为空 | LoginPage 未调用 `setAuth` | 在登录成功回调中调用 `useAuthStore().setAuth()` |
| 族谱列表一直显示加载中 | 后端 `GET /families` 未启动或 Token 失效 | 检查后端服务、打开 DevTools Network 确认请求状态 |
| 退出登录后刷新又自动登录 | `logout()` 未清除 localStorage | 确认 `authStore.logout()` 同时调用了 `localStorage.removeItem` |
| 统计数字显示 0 | 后端 `GET /families` 未返回 `memberCount` 字段 | 后端在列表接口附带成员数，或后续在 Members 模块完成后补充 |

---

## 六、目录结构速查

```
frontend/src/
├── App.tsx                        ← Step 6 修改
├── types/
│   └── family.ts                  ← Step 1 新建
├── store/
│   └── authStore.ts               ← Step 2 新建
├── api/
│   ├── client.ts                  ← 已完成
│   └── families.ts                ← Step 3 新建
├── components/
│   └── AppLayout/
│       └── index.tsx              ← Step 4 新建
└── pages/
    ├── LoginPage/                 ← 已完成（需补充 setAuth 调用）
    ├── RegisterPage/              ← 已完成
    └── DashboardPage/
        └── index.tsx              ← Step 5 新建
```

---

## 七、下一步：FamilyListPage

DashboardPage 完成后，下一步开发 `FamilyListPage`（我的族谱页面）：

```
FamilyListPage 功能：
  - 展示当前用户所有族谱（卡片列表）
  - 新建族谱（Modal 弹窗，输入名称 + 姓氏）
  - 删除族谱（确认后删除，级联删除所有成员）
  - 点击族谱卡片进入 FamilyDetailPage

复用内容：
  - AppLayout（导航框架）
  - api/families.ts（createFamily、deleteFamily）
  - types/family.ts（FamilyTree）
```

---

*文档版本：v1.0 · 模块：DashboardPage · 项目：Pedigree · 环境：WSL2 Ubuntu 22.04*