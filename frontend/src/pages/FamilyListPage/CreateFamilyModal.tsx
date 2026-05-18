import { useState, useEffect, useRef } from 'react';

interface Props {
  onClose: () => void;
  onConfirm: (treeName: string, surname: string) => Promise<void>;
}

export default function CreateFamilyModal({ onClose, onConfirm }: Props) {
  const [treeName,  setTreeName]  = useState('');
  const [surname,   setSurname]   = useState('');
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [visible,   setVisible]   = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // 弹出动画 + 自动聚焦
  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(true);
      inputRef.current?.focus();
    }, 10);
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

  const handleSubmit = async () => {
    if (!treeName.trim()) { setError('请输入族谱名称'); return; }
    if (!surname.trim())  { setError('请输入姓氏');     return; }
    setLoading(true);
    setError('');
    try {
      await onConfirm(treeName.trim(), surname.trim());
    } catch (err: any) {
      setError(err.response?.data?.message || '创建失败，请稍后重试');
      setLoading(false);
    }
  };

  // Enter 键提交
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) handleSubmit();
  };

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
      {/* 弹窗主体，阻止点击冒泡到遮罩 */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: 16,
          padding: '32px',
          width: 400,
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
          transition: 'transform 0.25s ease',
          fontFamily: "'Noto Serif SC', 'Songti SC', Georgia, serif",
        }}
      >
        {/* 标题行 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 28,
        }}>
          <h3 style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            color: '#1a1a1a',
            letterSpacing: '-0.02em',
          }}>
            新建族谱
          </h3>
          <button
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: 'none',
              background: '#f5f4f2',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9ca3af',
              fontSize: 16,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#ececea')}
            onMouseLeave={e => (e.currentTarget.style.background = '#f5f4f2')}
          >
            ×
          </button>
        </div>

        {/* 族谱名称 */}
        <div style={{ marginBottom: 18 }}>
          <label style={{
            display: 'block',
            fontSize: 12,
            fontWeight: 600,
            color: '#4b4945',
            letterSpacing: '0.06em',
            textTransform: 'uppercase' as const,
            marginBottom: 8,
          }}>
            族谱名称
          </label>
          <input
            ref={inputRef}
            value={treeName}
            onChange={e => { setTreeName(e.target.value); setError(''); }}
            onKeyDown={handleKeyDown}
            placeholder="例：张氏族谱"
            style={{
              width: '100%',
              padding: '10px 14px',
              border: '1.5px solid #ececea',
              borderRadius: 8,
              fontSize: 14,
              color: '#1a1a1a',
              outline: 'none',
              boxSizing: 'border-box' as const,
              fontFamily: "'Noto Serif SC', 'Songti SC', Georgia, serif",
              transition: 'border-color 0.15s',
              background: '#fafaf9',
            }}
            onFocus={e  => (e.target.style.borderColor = '#1a1a1a')}
            onBlur={e   => (e.target.style.borderColor = '#ececea')}
          />
        </div>

        {/* 姓氏 */}
        <div style={{ marginBottom: error ? 12 : 28 }}>
          <label style={{
            display: 'block',
            fontSize: 12,
            fontWeight: 600,
            color: '#4b4945',
            letterSpacing: '0.06em',
            textTransform: 'uppercase' as const,
            marginBottom: 8,
          }}>
            姓氏
          </label>
          <input
            value={surname}
            onChange={e => { setSurname(e.target.value); setError(''); }}
            onKeyDown={handleKeyDown}
            placeholder="例：张"
            maxLength={10}
            style={{
              width: '100%',
              padding: '10px 14px',
              border: '1.5px solid #ececea',
              borderRadius: 8,
              fontSize: 14,
              color: '#1a1a1a',
              outline: 'none',
              boxSizing: 'border-box' as const,
              fontFamily: "'Noto Serif SC', 'Songti SC', Georgia, serif",
              transition: 'border-color 0.15s',
              background: '#fafaf9',
            }}
            onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
            onBlur={e  => (e.target.style.borderColor = '#ececea')}
          />
        </div>

        {/* 错误提示 */}
        {error && (
          <div style={{
            fontSize: 13,
            color: '#dc2626',
            marginBottom: 16,
            padding: '8px 12px',
            background: '#fff5f5',
            borderRadius: 6,
            border: '1px solid #fecaca',
          }}>
            {error}
          </div>
        )}

        {/* 操作按钮 */}
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
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              flex: 2,
              padding: '10px 0',
              background: loading ? '#9ca3af' : '#1a1a1a',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: "'Noto Serif SC', 'Songti SC', Georgia, serif",
              transition: 'background 0.15s',
              letterSpacing: '0.02em',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#333'; }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#1a1a1a'; }}
          >
            {loading ? '创建中...' : '确认创建'}
          </button>
        </div>
      </div>
    </div>
  );
}