import React, { useState, useEffect } from 'react';

function token() { return localStorage.getItem('token'); }

export default function StudentManager() {
  const [students, setStudents] = useState([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const showMsg = text => { setMsg(text); setTimeout(() => setMsg(''), 3000); };

  const load = () => {
    fetch('http://localhost:5001/api/students', { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json()).then(setStudents).catch(console.error);
  };

  useEffect(() => { load(); }, []);

  const add = async e => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5001/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setName(''); load(); showMsg('Student added!');
    } catch (err) { showMsg(err.message); }
    finally { setLoading(false); }
  };

  const del = async id => {
    if (!window.confirm('Delete this student?')) return;
    const res = await fetch(`http://localhost:5001/api/students/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token()}` },
    });
    if (res.ok) { load(); showMsg('Student deleted'); }
  };

  return (
    <div style={{ animation: 'fadeUp .3s ease' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>Students</h1>
        <p style={{ marginTop: 5, color: '#64748b', fontSize: 14 }}>{students.length} students enrolled</p>
      </div>

      <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,.06)', marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>Add New Student</h3>
        <form onSubmit={add} style={{ display: 'flex', gap: 12 }}>
          <input
            value={name} onChange={e => setName(e.target.value)}
            placeholder="Full name..."
            style={{ flex: 1, padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, fontFamily: 'inherit', background: '#f8fafc' }}
          />
          <button type="submit" disabled={loading} style={{ padding: '11px 22px', borderRadius: 10, border: 'none', background: '#0f172a', color: '#fbbf24', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>+ Add</button>
        </form>
        {msg && <div style={{ marginTop: 10, fontSize: 13, color: '#16a34a', fontWeight: 600 }}>{msg}</div>}
      </div>

      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,.06)', overflow: 'hidden' }}>
        {students.length === 0
          ? <div style={{ textAlign: 'center', padding: 56, color: '#94a3b8' }}><div style={{ fontSize: 36 }}>🎓</div><p style={{ marginTop: 8 }}>No students yet</p></div>
          : students.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 20px', background: i % 2 === 0 ? '#f8fafc' : '#fff', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 13 }}>{s.name[0]}</div>
                <div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>ID: {s.id}</div>
                </div>
              </div>
              <button onClick={() => del(s.id)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#fee2e2', color: '#dc2626', fontWeight: 700, fontSize: 12, fontFamily: 'inherit' }}>Delete</button>
            </div>
          ))
        }
      </div>
    </div>
  );
}
