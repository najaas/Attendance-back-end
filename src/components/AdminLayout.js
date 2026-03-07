import React, { useState } from 'react';
import AdminDashboard from './AdminDashboard';
import AttendancePage from './AttendancePage';
import StudentManager from './StudentManager';
import EmployeeManager from './EmployeeManager';
import DataImport from './DataImport';

const NAV = [
  { id: 'dashboard',  icon: '⬡', label: 'Dashboard' },
  { id: 'attendance', icon: '📅', label: 'Attendance' },
  { id: 'students',   icon: '🎓', label: 'Students' },
  { id: 'employees',  icon: '👔', label: 'Employees' },
  { id: 'import',     icon: '📂', label: 'Import CSV' },
];

export default function AdminLayout({ user, onLogout }) {
  const [page, setPage] = useState('dashboard');

  const pages = {
    dashboard:  <AdminDashboard />,
    attendance: <AttendancePage />,
    students:   <StudentManager />,
    employees:  <EmployeeManager />,
    import:     <DataImport />,
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <div style={{
        width: 220, background: 'linear-gradient(180deg,#0f172a,#1e293b)',
        display: 'flex', flexDirection: 'column', padding: '24px 14px',
        position: 'fixed', height: '100vh', zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px', marginBottom: 32 }}>
          <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>📋</div>
          <div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>AttendTrack</div>
            <div style={{ color: '#475569', fontSize: 10 }}>Admin Panel</div>
          </div>
        </div>

        <div style={{ margin: '0 4px 20px', padding: '8px 12px', background: 'rgba(99,102,241,.12)', borderRadius: 8, border: '1px solid rgba(99,102,241,.2)' }}>
          <div style={{ fontSize: 10, color: '#6366f1', fontWeight: 700, marginBottom: 2 }}>ADMIN</div>
          <div style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 600 }}>{user?.name || user?.username}</div>
        </div>

        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(item => (
            <button key={item.id} onClick={() => setPage(item.id)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 600, transition: 'all .2s',
              background: page === item.id ? 'rgba(251,191,36,.14)' : 'transparent',
              color: page === item.id ? '#fbbf24' : '#94a3b8',
              borderLeft: `3px solid ${page === item.id ? '#fbbf24' : 'transparent'}`,
            }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span> {item.label}
            </button>
          ))}
        </nav>

        <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: 16 }}>
          <button onClick={onLogout} style={{
            width: '100%', padding: 9, borderRadius: 8, border: 'none',
            background: 'rgba(220,38,38,.12)', color: '#f87171',
            cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 12,
          }}>← Sign Out</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginLeft: 220, flex: 1, padding: 32, minHeight: '100vh' }}>
        {pages[page]}
      </div>
    </div>
  );
}
