import { useState } from 'react';
import type { FamilyTree } from '../../types/family';

interface Props {
  family: FamilyTree;
  onEnter: (treeId: number) => void;
  onDelete: (treeId: number, treeName: string) => void;
  animationDelay?: number;
}

export default function FamilyCard({
  family,
  onEnter,
  onDelete,
  animationDelay = 0,
}: Props) {
  const [hovered,        setHovered]        = useState(false);
  const [deleteHovered,  setDeleteHovered]  = useState(false);
  const [visible,        setVisible]        = useState(false);

  // 入场动画
  useState(() => {
    const t = setTimeout(() => setVisible(true), animationDelay);
    return () => clearTimeout(t);
  });

  const updatedAt = new Date(family.updateTime).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #ececea',
        borderRadius: 12,
        padding: '22px',
        display: 'flex',
        flexDirection: 'column',
        opacity: visible ? 1 : 0,
        transform: visible
          ? hovered ? 'translateY(-4px)' : 'translateY(0)'
          : 'translateY(14px)',
        boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.08)' : '0 1px 4px rgba(0,0,0,0.03)',
        transition: 'opacity 0.4s ease, transform 0.3s ease, box-shadow 0.3s ease',
        cursor: 'default',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 姓氏徽章 */}
      <div style={{
        width: 44,
        height: 44,
        borderRadius: 10,
        background: '#f7f6f3',
        border: '1px solid #ececea',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 20,
        fontWeight: 700,
        color: '#4b4945',
        marginBottom: 16,
        fontFamily: "'Noto Serif SC', 'Songti SC', Georgia, serif",
      }}>
        {family.surname}
      </div>

      {/* 族谱名称 */}
      <div style={{
        fontSize: 15,
        fontWeight: 600,
        color: '#1a1a1a',
        marginBottom: 6,
        letterSpacing: '0.01em',
        fontFamily: "'Noto Serif SC', 'Songti SC', Georgia, serif",
      }}>
        {family.treeName}
      </div>

      {/* 成员数 */}
      <div style={{
        fontSize: 13,
        color: '#9ca3af',
        marginBottom: 4,
      }}>
        {family.memberCount ?? 0} 位成员
      </div>

      {/* 更新时间 */}
      <div style={{
        fontSize: 12,
        color: '#c5c3be',
        marginBottom: 20,
        flex: 1,
      }}>
        更新于 {updatedAt}
      </div>

      {/* 操作区域 */}
      <div style={{
        display: 'flex',
        gap: 8,
        paddingTop: 14,
        borderTop: '1px solid #f5f4f2',
      }}>
        {/* 进入管理按钮 */}
        <button
          onClick={() => onEnter(family.treeId)}
          style={{
            flex: 1,
            padding: '7px 0',
            background: '#1a1a1a',
            color: '#ffffff',
            border: 'none',
            borderRadius: 7,
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            letterSpacing: '0.02em',
            transition: 'background 0.15s',
            fontFamily: "'Noto Serif SC', 'Songti SC', Georgia, serif",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#333')}
          onMouseLeave={e => (e.currentTarget.style.background = '#1a1a1a')}
        >
          进入管理
        </button>

        {/* 删除按钮 */}
        <button
          onClick={() => onDelete(family.treeId, family.treeName)}
          onMouseEnter={() => setDeleteHovered(true)}
          onMouseLeave={() => setDeleteHovered(false)}
          style={{
            width: 34,
            padding: '7px 0',
            background: deleteHovered ? '#fff0f0' : '#fafaf9',
            color: deleteHovered ? '#dc2626' : '#c5c3be',
            border: `1px solid ${deleteHovered ? '#fecaca' : '#ececea'}`,
            borderRadius: 7,
            fontSize: 15,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s',
            flexShrink: 0,
          }}
          title="删除族谱"
        >
          {/* 删除图标 */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3,6 5,6 21,6"/>
            <path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/>
            <path d="M10,11v6M14,11v6"/>
            <path d="M9,6V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1v2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}