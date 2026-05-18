import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';

export default function RegisterPage() {
  const navigate = useNavigate();

  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [visible,  setVisible]  = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = async () => {
    if (!userName || !password) {
      setError('用户名和密码不能为空');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await client.post('/auth/register', { userName, password });
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.message || '注册失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) handleSubmit();
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f7f6f3',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Noto Serif SC', 'Songti SC', Georgia, serif",
    }}>
      <div style={{
        width: 400,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
      }}>

        {/* Logo 区域 */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 48,
            height: 48,
            background: '#1a1a1a',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            margin: '0 auto 16px',
          }}>
            🌳
          </div>
          <div style={{
            fontSize: 20,
            fontWeight: 700,
            color: '#1a1a1a',
            letterSpacing: '-0.02em',
          }}>
            家谱系统
          </div>
          <div style={{
            fontSize: 12,
            color: '#b5b3ae',
            marginTop: 4,
            letterSpacing: '0.06em',
          }}>
            PEDIGREE
          </div>
        </div>

        {/* 卡片 */}
        <div style={{
          background: '#ffffff',
          borderRadius: 16,
          padding: '36px 40px',
          border: '1px solid #ececea',
          boxShadow: '0 4px 24px rgba(0,0,0,0.05)',
        }}>
          <h2 style={{
            margin: '0 0 6px',
            fontSize: 20,
            fontWeight: 700,
            color: '#1a1a1a',
            letterSpacing: '-0.02em',
          }}>
            创建账号
          </h2>
          <p style={{
            margin: '0 0 28px',
            fontSize: 13,
            color: '#9ca3af',
            lineHeight: 1.5,
          }}>
            注册后即可开始管理你的家族族谱
          </p>

          {/* 用户名 */}
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
              用户名
            </label>
            <input
              value={userName}
              onChange={e => { setUserName(e.target.value); setError(''); }}
              onKeyDown={handleKeyDown}
              placeholder="请输入用户名"
              autoComplete="username"
              style={{
                width: '100%',
                padding: '11px 14px',
                border: '1.5px solid #ececea',
                borderRadius: 8,
                fontSize: 14,
                color: '#1a1a1a',
                outline: 'none',
                boxSizing: 'border-box' as const,
                fontFamily: "'Noto Serif SC', 'Songti SC', Georgia, serif",
                background: '#fafaf9',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
              onBlur={e  => (e.target.style.borderColor = '#ececea')}
            />
          </div>

          {/* 密码 */}
          <div style={{ marginBottom: error ? 14 : 28 }}>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              color: '#4b4945',
              letterSpacing: '0.06em',
              textTransform: 'uppercase' as const,
              marginBottom: 8,
            }}>
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              onKeyDown={handleKeyDown}
              placeholder="请输入密码"
              autoComplete="new-password"
              style={{
                width: '100%',
                padding: '11px 14px',
                border: '1.5px solid #ececea',
                borderRadius: 8,
                fontSize: 14,
                color: '#1a1a1a',
                outline: 'none',
                boxSizing: 'border-box' as const,
                fontFamily: "'Noto Serif SC', 'Songti SC', Georgia, serif",
                background: '#fafaf9',
                transition: 'border-color 0.15s',
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
              marginBottom: 18,
              padding: '9px 12px',
              background: '#fff5f5',
              borderRadius: 7,
              border: '1px solid #fecaca',
            }}>
              {error}
            </div>
          )}

          {/* 注册按钮 */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 0',
              background: loading ? '#9ca3af' : '#1a1a1a',
              color: '#ffffff',
              border: 'none',
              borderRadius: 9,
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: '0.04em',
              fontFamily: "'Noto Serif SC', 'Songti SC', Georgia, serif",
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#333'; }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#1a1a1a'; }}
          >
            {loading ? '注册中...' : '注册'}
          </button>

          {/* 跳转登录 */}
          <p style={{
            marginTop: 20,
            textAlign: 'center',
            fontSize: 13,
            color: '#9ca3af',
          }}>
            已有账号？
            <span
              onClick={() => navigate('/login')}
              style={{
                color: '#4b4945',
                cursor: 'pointer',
                fontWeight: 600,
                marginLeft: 4,
                textDecoration: 'underline',
                textUnderlineOffset: 3,
              }}
            >
              去登录
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}