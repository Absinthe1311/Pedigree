import { useState, useEffect } from 'react';

interface Props {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmModal({
  title,
  description,
  confirmLabel = '确认',
  cancelLabel  = '取消',
  danger       = false,
  onConfirm,
  onClose,
}: Props) {
  const [visible, setVisible] = useState(false);

  // 弹出动画
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  // ESC 键关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    // 遮罩层
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.2s ease',
        backdropFilter: 'blur(2px)',
      }}
    >
      {/* 弹窗主体 */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: 16,
          padding: '32px',
          width: 380,
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          transform: visible
            ? 'translateY(0) scale(1)'
            : 'translateY(12px) scale(0.97)',
          transition: 'transform 0.25s ease',
          fontFamily: "'Noto Serif SC', 'Songti SC', Georgia, serif",
        }}
      >
        {/* 图标 */}
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: danger ? '#fff5f5' : '#f7f6f3',
          border: `1px solid ${danger ? '#fecaca' : '#ececea'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          marginBottom: 20,
        }}>
          {danger ? '🗑️' : '❓'}
        </div>

        {/* 标题 */}
        <h3 style={{
          margin: '0 0 10px',
          fontSize: 17,
          fontWeight: 700,
          color: '#1a1a1a',
          letterSpacing: '-0.02em',
        }}>
          {title}
        </h3>

        {/* 说明 */}
        <p style={{
          margin: '0 0 28px',
          fontSize: 13,
          color: '#9ca3af',
          lineHeight: 1.7,
        }}>
          {description}
        </p>

        {/* 按钮 */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '10px 0',
              background: '#fafaf9',
              color: '#6b7280',
              border: '1.5px solid #ececea',
              borderRadius: 8,
              fontSize: 14,
              cursor: 'pointer',
              fontFamily: "'Noto Serif SC', 'Songti SC', Georgia, serif",
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f0efed')}
            onMouseLeave={e => (e.currentTarget.style.background = '#fafaf9')}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '10px 0',
              background: danger ? '#dc2626' : '#1a1a1a',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: "'Noto Serif SC', 'Songti SC', Georgia, serif",
              transition: 'background 0.15s',
              letterSpacing: '0.02em',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = danger ? '#b91c1c' : '#333';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = danger ? '#dc2626' : '#1a1a1a';
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}