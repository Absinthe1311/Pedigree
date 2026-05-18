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