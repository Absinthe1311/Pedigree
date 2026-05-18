import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/AppLayout';
import ConfirmModal from '../../components/ConfirmModal';
import FamilyCard from './FamilyCard';
import CreateFamilyModal from './CreateFamilyModal';
import { getFamilies, createFamily, deleteFamily } from '../../api/families';
import type { FamilyTree } from '../../types/family';

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

export default function FamilyListPage() {
  const navigate = useNavigate();

  const [families,      setFamilies]      = useState<FamilyTree[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [showCreate,    setShowCreate]    = useState(false);
  const [headerVisible, setHeaderVisible] = useState(false);

  // 删除确认弹窗的目标：null 表示弹窗关闭
  const [deleteTarget, setDeleteTarget] = useState<{
    treeId: number;
    treeName: string;
  } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setHeaderVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    loadFamilies();
  }, []);

  const loadFamilies = async () => {
    setLoading(true);
    try {
      const data = await getFamilies();
      setFamilies(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (treeName: string, surname: string) => {
    const newFamily = await createFamily({ treeName, surname });
    setFamilies(prev => [newFamily, ...prev]);
    setShowCreate(false);
  };

  // 点击删除卡片按钮：只记录目标，弹出确认弹窗
  const handleDeleteRequest = (treeId: number, treeName: string) => {
    setDeleteTarget({ treeId, treeName });
  };

  // 确认弹窗点击"确认删除"后才真正执行
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteFamily(deleteTarget.treeId);
      setFamilies(prev => prev.filter(f => f.treeId !== deleteTarget.treeId));
    } catch (err: any) {
      alert(err.response?.data?.message || '删除失败，请稍后重试');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleEnter = (treeId: number) => {
    navigate(`/families/${treeId}`);
  };

  return (
    <AppLayout>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* ── 页头 ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: 32,
        opacity: headerVisible ? 1 : 0,
        transform: headerVisible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
      }}>
        <div>
          <div style={{
            fontSize: 11,
            color: '#b5b3ae',
            letterSpacing: '0.1em',
            textTransform: 'uppercase' as const,
            marginBottom: 8,
          }}>
            管理中心
          </div>
          <h1 style={{
            fontSize: 26,
            fontWeight: 700,
            color: '#1a1a1a',
            margin: 0,
            letterSpacing: '-0.03em',
            fontFamily: "'Noto Serif SC', 'Songti SC', Georgia, serif",
          }}>
            我的族谱
          </h1>
          {!loading && (
            <p style={{ color: '#9ca3af', margin: '6px 0 0', fontSize: 13 }}>
              {families.length === 0
                ? '还没有族谱，创建第一部吧'
                : `共 ${families.length} 部族谱`}
            </p>
          )}
        </div>

        <button
          onClick={() => setShowCreate(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
            background: '#1a1a1a',
            color: '#ffffff',
            border: 'none',
            borderRadius: 9,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '0.02em',
            fontFamily: "'Noto Serif SC', 'Songti SC', Georgia, serif",
            transition: 'background 0.15s, transform 0.15s',
            flexShrink: 0,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#333';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = '#1a1a1a';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
          新建族谱
        </button>
      </div>

      {/* ── 内容区 ── */}
      {loading ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 16,
        }}>
          {[0, 1, 2, 3].map(i => (
            <Skeleton key={i} width="100%" height={200} radius={12} />
          ))}
        </div>
      ) : families.length === 0 ? (
        <div style={{
          border: '1.5px dashed #e5e4e0',
          borderRadius: 16,
          padding: '80px 0',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🌱</div>
          <div style={{
            fontSize: 16,
            fontWeight: 600,
            color: '#4b4945',
            marginBottom: 8,
            fontFamily: "'Noto Serif SC', 'Songti SC', Georgia, serif",
          }}>
            还没有族谱
          </div>
          <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 24 }}>
            创建第一部族谱，开始记录家族历史
          </div>
          <button
            onClick={() => setShowCreate(true)}
            style={{
              padding: '10px 24px',
              background: '#1a1a1a',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              cursor: 'pointer',
              fontFamily: "'Noto Serif SC', 'Songti SC', Georgia, serif",
            }}
          >
            + 新建族谱
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 16,
        }}>
          {families.map((family, i) => (
            <FamilyCard
              key={family.treeId}
              family={family}
              animationDelay={i * 60}
              onEnter={handleEnter}
              onDelete={handleDeleteRequest}
            />
          ))}
        </div>
      )}

      {/* ── 创建族谱 Modal ── */}
      {showCreate && (
        <CreateFamilyModal
          onClose={() => setShowCreate(false)}
          onConfirm={handleCreate}
        />
      )}

      {/* ── 删除确认 Modal ── */}
      {deleteTarget && (
        <ConfirmModal
          danger
          title="删除族谱"
          description={`确定要删除「${deleteTarget.treeName}」吗？此操作将同时删除所有成员数据，不可恢复。`}
          confirmLabel="确认删除"
          cancelLabel="取消"
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </AppLayout>
  );
}