import React, { useState, useEffect } from 'react';

function token() { return localStorage.getItem('token'); }

function StatCard({ label, value, icon, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,.06)', borderTop: `4px solid ${color}`, display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, fontWeight: 600 }}>{label}</div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState({ students: [], employees: [], attendance: [] });

  useEffect(() => {
    const h = { Authorization: `Bearer ${token()}` };
    Promise.all([
      fetch('http://localhost:5001/api/students', { headers: h }).then(r => r.json()),
      fetch('http://localhost:5001/api/employees', { headers: h }).then(r => r.json()),
      fetch('http://localhost:5001/api/attendance', { headers: h }).then(r => r.json()),
    ]).then(([students, employees, attendance]) => setData({ students, employees, attendance }))
      .catch(console.error);
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const todayRow = data.attendance.find(r => r.date === today);
  const presentToday = todayRow
    ? Object.entries(todayRow).filter(([k, v]) => k !== 'date' && v === 'Present').length
    : 0;

  return (
    <div style={{ animation: 'fadeUp .3s ease' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: -.5 }}>Dashboard</h1>
        <p style={{ marginTop: 5, color: '#64748b', fontSize: 14 }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="Total Students" value={data.students.length} icon="🎓" color="#6366f1" />
        <StatCard label="Total Employees" value={data.employees.length} icon="👔" color="#0ea5e9" />
        <StatCard label="Attendance Records" value={data.attendance.length} icon="📅" color="#22c55e" />
        <StatCard label="Present Today" value={presentToday} icon="✅" color="#f59e0b" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>👔 Employees</h3>
          {data.employees.length === 0
            ? <p style={{ color: '#94a3b8', fontSize: 13 }}>No employees yet</p>
            : data.employees.slice(0, 6).map(e => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#0ea5e9,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 12 }}>{e.name?.[0]}</div>
                <div>
                  <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>{e.name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>@{e.username}</div>
                </div>
              </div>
            ))
          }
        </div>

        <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>📅 Recent Dates</h3>
          {data.attendance.length === 0
            ? <p style={{ color: '#94a3b8', fontSize: 13 }}>No records yet</p>
            : [...data.attendance].reverse().slice(0, 6).map((r, i) => {
              const presentCount = Object.entries(r).filter(([k, v]) => k !== 'date' && v === 'Present').length;
              const totalCount = Object.keys(r).length - 1;
              return (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: 13, color: '#0f172a', fontWeight: 600 }}>{r.date}</span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{presentCount}/{totalCount} present</span>
                </div>
              );
            })
          }
        </div>
      </div>
    </div>
  );
}
