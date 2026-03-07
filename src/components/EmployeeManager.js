import React, { useState, useEffect } from 'react';

function token() { return localStorage.getItem('token'); }

export default function EmployeeManager() {
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({ name: '', username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [showForm, setShowForm] = useState(false);

  const showMsg = (text, type = 'success') => { setMsg({ text, type }); setTimeout(() => setMsg({ text: '', type: '' }), 3000); };
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const load = () => {
    fetch('http://localhost:5001/api/employees', { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json()).then(setEmployees).catch(console.error);
  };

  useEffect(() => { load(); }, []);

  const add = async e => {
    e.preventDefault();
    if (!form.name || !form.username || !form.password) return showMsg('All fields required', 'error');
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5001/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setForm({ name: '', username: '', password: '' });
      setShowForm(false); load(); showMsg('Employee added!');
    } catch (err) { showMsg(err.message, 'error'); }
    finally { setLoading(false); }
  };

  const del = async id => {
    if (!window.confirm('Delete this employee?')) return;
    const res = await fetch(`http://localhost:5001/api/employees/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token()}` },
    });
    if (res.ok) { load(); showMsg('Employee deleted'); }
  };

  const inp = { width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, fontFamily: 'inherit', background: '#f8fafc' };

  return (
    <div style={{ animation: 'fadeUp .3s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>Employees</h1>
          <p style={{ marginTop: 5, color: '#64748b', fontSize: 14 }}>{employees.length} registered</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: '#0f172a', color: '#fbbf24', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>
          {showForm ? '✕ Cancel' : '+ Add Employee'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,.06)', marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>New Employee Account</h3>
          <form onSubmit={add}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div><label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 5 }}>FULL NAME</label><input style={inp} placeholder="John Smith" value={form.name} onChange={f('name')} /></div>
              <div><label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 5 }}>USERNAME</label><input style={inp} placeholder="johnsmith" value={form.username} onChange={f('username')} /></div>
              <div><label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 5 }}>PASSWORD</label><input style={inp} type="password" placeholder="••••••" value={form.password} onChange={f('password')} /></div>
            </div>
            <button type="submit" disabled={loading} style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: '#15803d', color: '#fff', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>
              {loading ? 'Adding...' : '✓ Add Employee'}
            </button>
          </form>
          {msg.text && <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: msg.type === 'error' ? '#dc2626' : '#16a34a' }}>{msg.text}</div>}
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,.06)', overflow: 'hidden' }}>
        {employees.length === 0
          ? <div style={{ textAlign: 'center', padding: 56, color: '#94a3b8' }}><div style={{ fontSize: 36 }}>👔</div><p style={{ marginTop: 8 }}>No employees yet</p></div>
          : employees.map((e, i) => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 20px', background: i % 2 === 0 ? '#f8fafc' : '#fff', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'linear-gradient(135deg,#0ea5e9,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 13 }}>{e.name?.[0]}</div>
                <div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>{e.name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>@{e.username} · default: password</div>
                </div>
              </div>
              <button onClick={() => del(e.id)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#fee2e2', color: '#dc2626', fontWeight: 700, fontSize: 12, fontFamily: 'inherit' }}>Delete</button>
            </div>
          ))
        }
      </div>
    </div>
  );
}
