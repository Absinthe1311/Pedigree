import { useState,useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    getFamilies,
    createFamily,
    deleteFamily,
} from '../../api/families';

import type { FamilyTree } from '../../types/family';

export default function FamilyListPage() {
    const navigate = useNavigate();

    // 族谱列表状态
    const [families, setFamilies] = useState<FamilyTree[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // 新建族谱表单状态
    const [showForm, setShowForm] = useState(false);
    const [treeName, setTreeName] = useState('');
    const [surname, setSurname] = useState('');
    const [creating, setCreating] = useState(false);

    // 页面加载时获取族谱列表
    useEffect(() =>{
        loadFamilies();
    },[]);

    const loadFamilies = async() => {
        setLoading(true);
        setError('');
        try{
            const data = await getFamilies();
            setFamilies(data);
        } catch(err: any){
            setError('加载族谱列表失败，请刷新重试');
        } finally{
            setLoading(false);
        }
    };

    //新建族谱
    const handleCreate = async() => {
        if(!treeName.trim() || !surname.trim()) {
            alert('族谱名称和姓氏不能为空');
            return ;
        }
        setCreating(true);
        try{
            const newFamily = await createFamily({treeName, surname});
            setFamilies([newFamily, ...families]);
            setTreeName('');
            setSurname('');
            setShowForm(false);
        } catch(err:any) {
            alert(err.response?.data?.message || '创建失败，请稍后重试');
        } finally{
        setCreating(false);
        }
    };

    // 删除族谱
    const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`确定要删除"${name}"吗？此操作将同时删除所有成员数据，不可恢复。`)) {
      return;
    }
    try {
      await deleteFamily(id);
      // 从列表中移除已删除的族谱
      setFamilies(families.filter((f) => f.treeId !== id));
    } catch (err: any) {
      alert(err.response?.data?.message || '删除失败，请稍后重试');
    }
  };

  // 跳转到族谱详情页（后续开发 members 模块时使用）
  const handleEnter = (id: number) => {
    navigate(`/families/${id}/members`);
  };

  // ── 渲染 ─────────────────────────────────────────────────
  if (loading) return <div style={{ padding: 32 }}>加载中...</div>;

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 16px' }}>

      {/* 页头 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>我的族谱</h2>
        <button onClick={() => setShowForm(!showForm)}>
          {showForm ? '取消' : '+ 新建族谱'}
        </button>
      </div>

      {/* 新建族谱表单 */}
      {showForm && (
        <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 24 }}>
          <h3 style={{ marginTop: 0 }}>新建族谱</h3>

          <div style={{ marginBottom: 12 }}>
            <label>族谱名称</label>
            <input
              value={treeName}
              onChange={(e) => setTreeName(e.target.value)}
              placeholder="例：张氏族谱"
              style={{ display: 'block', width: '100%', padding: 8, marginTop: 4, boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label>姓氏</label>
            <input
              value={surname}
              onChange={(e) => setSurname(e.target.value)}
              placeholder="例：张"
              style={{ display: 'block', width: '100%', padding: 8, marginTop: 4, boxSizing: 'border-box' }}
            />
          </div>

          <button onClick={handleCreate} disabled={creating}>
            {creating ? '创建中...' : '确认创建'}
          </button>
        </div>
      )}

      {/* 错误提示 */}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* 族谱列表 */}
      {families.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#999', padding: 48 }}>
          还没有族谱，点击右上角"新建族谱"开始创建
        </div>
      ) : (
        <div>
          {families.map((family) => (
            <div
              key={family.treeId}
              style={{
                border: '1px solid #eee',
                borderRadius: 8,
                padding: '16px 20px',
                marginBottom: 12,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              {/* 族谱信息 */}
              <div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>{family.treeName}</div>
                <div style={{ color: '#666', marginTop: 4, fontSize: 14 }}>
                  姓氏：{family.surname} · 最近更新：{new Date(family.updateTime).toLocaleDateString()}
                </div>
              </div>

              {/* 操作按钮 */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleEnter(family.treeId)}>
                  进入管理
                </button>
                <button
                  onClick={() => handleDelete(family.treeId, family.treeName)}
                  style={{ color: 'red', borderColor: 'red' }}
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
