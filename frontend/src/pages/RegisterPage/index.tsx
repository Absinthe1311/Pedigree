// 用户填写用户名和密码，提交后调用注册接口，成功后跳转登录页
import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import client from '../../api/client';

export default function RegisterPage() {
    const navigate = useNavigate();

    // 表单状态
    const [userName, setUserName] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        // 简单的前端验证
        if(!userName || !password) {
            setError('用户名或密码不能为空');
            return;
        }

        setLoading(true);
        setError('');

        try{
            await client.post('/auth/register',{ userName, password });
            //注册成功，跳转登录页
            navigate('/login');
        } catch (err: any) {
            // 从后端错误响应里提取错误信息
            setError(err.response?.data?.message || '注册失败，请稍后');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style = {{maxWidth :360, margin: '100px auto', padding: '0 16px'}}>
            <h2>注册账号</h2>

            <div style={{ marginBottom:12}}>
                <label>用户名</label>
                <input
                    value={userName}
                    onChange={(e)=>setUserName(e.target.value)}
                    style = {{display:'block', width: '100%', padding:8, marginTop:4}}/>
            </div>

            <div style={{marginBottom:12}}>
                <label>密码</label>
                <input
                    type="password"
                    value={password}
                    onChange={(e)=>setPassword(e.target.value)}
                    style={{display:'block',width:'100%',padding:8,marginTop:4}}/>
            </div>

            {error && <p style={{color:'red'}}>{error}</p>}

            <button
                onClick={handleSubmit}
                disabled={loading}
                style={{width:'100%', padding:10, marginTop:8}}>
                    {loading? '注册中...' : '注册'}
                </button>

                <p style = {{marginTop:16, textAlign: 'center'}}>
                    已有账号？
                    <span
                        onClick={()=>navigate('/login')}
                        style={{color:'blue',cursor:'pointer'}}
                        >
                            去登录
                        </span>
                </p>
        </div>
    );
}