import React, { useState } from 'react';

function token() { return localStorage.getItem('token'); }

const SAMPLES = {
  students: 'Name\nAlice Johnson\nBob Smith\nCharlie Davis',
  attendance: 'Date,Student Name,Present\n2024-03-01,Alice Johnson,Yes\n2024-03-01,Bob Smith,No',
  'employee-attendance': 'Date,Employee Name,Office Entry,Site Entry,Site Exit,Office Exit\n2024-03-01,Alice Johnson,09:00,09:30,17:00,17:30',
};

export default function DataImport() {
  const [type, setType] = useState('students');
  const [csv, setCsv] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  const showMsg = (text, t = 'success') => { setMsg({ text, type: t }); setTimeout(() => setMsg({ text: '', type: '' }), 4000); };

  const doImport = async () => {
    if (!csv.trim()) return showMsg('Paste CSV data first', 'error');
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5001/api/import-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ type, csvData: csv }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      showMsg(`✓ Imported ${data.count} records!`);
      setCsv('');
    } catch (err) { showMsg(err.message, 'error'); }
    finally { setLoading(false); }
  };

  const TYPES = [
    { id: 'students', label: 'Students', icon: '🎓' },
    { id: 'attendance', label: 'Student Attendance', icon: '📅' },
    { id: 'employee-attendance', label: 'Employee Time Records', icon: '👔' },
  ];

  const inp = { width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, fontFamily: 'inherit', background: '#f8fafc' };

  return (
    <div style={{ animation: 'fadeUp .3s ease' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>Import CSV</h1>
        <p style={{ marginTop: 5, color: '#64748b', fontSize: 14 }}>Bulk import data from CSV files</p>
      </div>

      <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,.06)', marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>Select Import Type</h3>
        <div style={{ display: 'flex', gap: 10 }}>
          {TYPES.map(t => (
            <button key={t.id} onClick={() => setType(t.id)} style={{
              padding: '10px 18px', borderRadius: 10, fontFamily: 'inherit',
              fontWeight: 700, fontSize: 13, transition: 'all .2s',
              border: `2px solid ${type === t.id ? '#6366f1' : '#e2e8f0'}`,
              background: type === t.id ? '#ede9fe' : '#fff',
              color: type === t.id ? '#6366f1' : '#64748b',
            }}>{t.icon} {t.label}</button>
          ))}
        </div>
      </div>

      {msg.text && (
        <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 16, fontWeight: 600, fontSize: 13, background: msg.type === 'error' ? '#fee2e2' : '#dcfce7', color: msg.type === 'error' ? '#dc2626' : '#16a34a' }}>{msg.text}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>📋 Sample Format</h3>
          <pre style={{ background: '#f1f5f9', padding: 14, borderRadius: 8, fontSize: 12, color: '#475569', overflowX: 'auto', lineHeight: 1.6 }}>{SAMPLES[type]}</pre>
          <button onClick={() => setCsv(SAMPLES[type])} style={{ marginTop: 12, padding: '8px 16px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', fontWeight: 600, fontSize: 12, fontFamily: 'inherit' }}>
            Use Sample Data
          </button>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>📂 Paste CSV Data</h3>
          <textarea
            value={csv} onChange={e => setCsv(e.target.value)}
            placeholder={`Paste CSV here...\n\n${SAMPLES[type]}`}
            style={{ ...inp, minHeight: 160, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6 }}
          />
          <button onClick={doImport} disabled={loading} style={{ marginTop: 12, width: '100%', padding: '11px', borderRadius: 10, border: 'none', background: loading ? '#94a3b8' : '#0f172a', color: '#fbbf24', fontWeight: 700, fontSize: 14, fontFamily: 'inherit' }}>
            {loading ? 'Importing...' : '⬆ Import Now'}
          </button>
        </div>
      </div>
    </div>
  );
}
