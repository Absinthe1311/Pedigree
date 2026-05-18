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