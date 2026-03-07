import React, { useState } from 'react';

export default function Login({ onLogin }) {
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ username: '', password: '', fullName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handle = async () => {
    setError('');
    if (!form.username || !form.password) return setError('All fields required');
    if (tab === 'register' && !form.fullName) return setError('Full name required');
    setLoading(true);
    try {
      const endpoint = tab === 'login' ? '/api/login' : '/api/register';
      const body = tab === 'login'
        ? { username: form.username, password: form.password }
        : { username: form.username, password: form.password, fullName: form.fullName };
      const res = await fetch(`http://localhost:5001${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      onLogin(data.token);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const s = {
    wrap: {
      minHeight: '100vh', display: 'flex',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5c 60%, #0f172a 100%)',
    },
    left: {
      flex: 1, display: 'flex', flexDirection: 'column',
      justifyContent: 'center', padding: '60px 80px', color: '#fff',
    },
    right: {
      width: 460, display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 40,
    },
    card: {
      width: '100%', background: '#fff', borderRadius: 24,
      padding: 40, boxShadow: '0 32px 80px rgba(0,0,0,.4)',
      animation: 'fadeUp .5s ease',
    },
    tabBar: {
      display: 'flex', background: '#f1f5f9', borderRadius: 10,
      padding: 4, marginBottom: 32,
    },
    inp: {
      width: '100%', padding: '11px 14px', borderRadius: 10,
      border: '1.5px solid #e2e8f0', fontSize: 14,
      fontFamily: 'inherit', background: '#f8fafc', color: '#0f172a',
    },
    btn: {
      width: '100%', padding: 13, borderRadius: 10, border: 'none',
      background: '#0f172a', color: '#fbbf24', fontWeight: 800,
      fontSize: 15, marginTop: 8, transition: 'opacity .2s',
    },
  };

  return (
    <div style={s.wrap}>
      {/* Left branding */}
      <div style={s.left}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
          <div style={{ width: 52, height: 52, background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>📋</div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>AttendTrack</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Attendance Management</div>
          </div>
        </div>
        <h1 style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.2, marginBottom: 16, letterSpacing: -1 }}>
          Smart Attendance<br /><span style={{ color: '#fbbf24' }}>Made Simple</span>
        </h1>
        <p style={{ color: '#94a3b8', fontSize: 15, lineHeight: 1.7, maxWidth: 380 }}>
          Track employee check-ins, manage student attendance, and export to Excel — all in one place.
        </p>
        <div style={{ display: 'flex', gap: 24, marginTop: 40 }}>
          {['👔 Employees', '📊 Reports', '📁 Excel Export'].map(x => (
            <span key={x} style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 600 }}>{x}</span>
          ))}
        </div>
      </div>

      {/* Right form */}
      <div style={s.right}>
        <div style={s.card}>
          <div style={s.tabBar}>
            {[['login', 'Sign In'], ['register', 'Register']].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, border: 'none',
                fontWeight: 700, fontSize: 13, fontFamily: 'inherit', transition: 'all .2s',
                background: tab === id ? '#fff' : 'transparent',
                color: tab === id ? '#0f172a' : '#94a3b8',
                boxShadow: tab === id ? '0 2px 8px rgba(0,0,0,.08)' : 'none',
              }}>{label}</button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {tab === 'register' && (
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 5, letterSpacing: .5 }}>FULL NAME</label>
                <input style={s.inp} placeholder="John Smith" value={form.fullName} onChange={f('fullName')} />
              </div>
            )}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 5, letterSpacing: .5 }}>USERNAME</label>
              <input style={s.inp} placeholder="admin" value={form.username} onChange={f('username')} onKeyDown={e => e.key === 'Enter' && handle()} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 5, letterSpacing: .5 }}>PASSWORD</label>
              <input style={s.inp} type="password" placeholder="••••••" value={form.password} onChange={f('password')} onKeyDown={e => e.key === 'Enter' && handle()} />
            </div>
            {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>{error}</div>}
            <button style={{ ...s.btn, opacity: loading ? .6 : 1 }} onClick={handle} disabled={loading}>
              {loading ? 'Please wait...' : tab === 'login' ? 'Sign In →' : 'Create Account →'}
            </button>
          </div>

          <div style={{ marginTop: 24, padding: 14, background: '#f8fafc', borderRadius: 10 }}>
            <p style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, marginBottom: 6 }}>DEMO</p>
            <p style={{ fontSize: 12, color: '#64748b' }}>Admin: <b>admin</b> / <b>password</b></p>
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>Employee: <b>alice</b> / <b>password</b></p>
          </div>
        </div>
      </div>
    </div>
  );
}
