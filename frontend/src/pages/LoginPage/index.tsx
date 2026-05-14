// 登录页面
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';

export default function LoginPage() {
  const navigate = useNavigate();

  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async () => {
    if (!userName || !password) {
      setError('用户名和密码不能为空');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await client.post('/auth/login', { userName, password });

      // 把 Token 存到 localStorage
      // 之后每次 API 请求，client.ts 里的拦截器会自动带上它
      localStorage.setItem('token', res.data.token);

      // 登录成功，跳转到主页面
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || '登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: '100px auto', padding: '0 16px' }}>
      <h2>登录</h2>

      <div style={{ marginBottom: 12 }}>
        <label>用户名</label>
        <input
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          style={{ display: 'block', width: '100%', padding: 8, marginTop: 4 }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label>密码</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ display: 'block', width: '100%', padding: 8, marginTop: 4 }}
        />
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{ width: '100%', padding: 10, marginTop: 8 }}
      >
        {loading ? '登录中...' : '登录'}
      </button>

      <p style={{ marginTop: 16, textAlign: 'center' }}>
        没有账号？
        <span
          onClick={() => navigate('/register')}
          style={{ color: 'blue', cursor: 'pointer' }}
        >
          去注册
        </span>
      </p>
    </div>
  );
}