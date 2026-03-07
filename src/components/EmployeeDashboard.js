import React, { useState, useEffect } from 'react';

function token() { return localStorage.getItem('token'); }
const todayStr = () => new Date().toISOString().split('T')[0];
const nowTime = () => new Date().toTimeString().slice(0, 5);

export default function EmployeeDashboard({ user, onLogout }) {
  const [tab, setTab] = useState('checkin');
  const [date, setDate] = useState(todayStr());
  const [form, setForm] = useState({ officeEntryTime: nowTime(), siteEntryTime: '', siteExitTime: '', officeExitTime: '' });
  const [existing, setExisting] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  const showMsg = (text, type = 'success') => { setMsg({ text, type }); setTimeout(() => setMsg({ text: '', type: '' }), 3000); };
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    fetch(`http://localhost:5001/api/employee-attendance/${date}`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json()).then(setExisting).catch(() => setExisting(null));
  }, [date]);

  useEffect(() => {
    fetch('http://localhost:5001/api/employee-attendance-history', { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json()).then(setHistory).catch(console.error);
  }, [existing]);

  const submit = async () => {
    if (!form.officeEntryTime) return showMsg('Office entry time required', 'error');
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5001/api/employee-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ date, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setExisting(data);
      showMsg('Attendance recorded!');
    } catch (err) { showMsg(err.message, 'error'); }
    finally { setLoading(false); }
  };

  const TIME_FIELDS = [
    { key: 'officeEntryTime', label: 'Office Entry', icon: '🏢', required: true },
    { key: 'siteEntryTime',   label: 'Site Entry',   icon: '🏗️', required: false },
    { key: 'siteExitTime',    label: 'Site Exit',    icon: '🚪', required: false },
    { key: 'officeExitTime',  label: 'Office Exit',  icon: '🏠', required: false },
  ];

  const inp = { width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, fontFamily: 'inherit', background: '#f8fafc' };

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#0f172a,#1e293b)', padding: '0 32px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>📋</div>
            <div>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>AttendTrack</div>
              <div style={{ color: '#475569', fontSize: 11 }}>Employee Portal</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{user?.name || user?.username}</div>
              <div style={{ color: '#64748b', fontSize: 11 }}>Employee</div>
            </div>
            <button onClick={onLogout} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: 'rgba(220,38,38,.15)', color: '#f87171', fontWeight: 700, fontSize: 12, fontFamily: 'inherit' }}>Sign Out</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 32 }}>
        {/* Tabs */}
        <div style={{ display: 'flex', background: '#fff', borderRadius: 12, padding: 4, marginBottom: 28, width: 'fit-content', boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
          {[['checkin', '🕐 Check In/Out'], ['history', '📊 History']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: '9px 22px', borderRadius: 9, border: 'none', fontFamily: 'inherit',
              fontWeight: 700, fontSize: 13, transition: 'all .2s',
              background: tab === id ? '#0f172a' : 'transparent',
              color: tab === id ? '#fbbf24' : '#94a3b8',
            }}>{label}</button>
          ))}
        </div>

        {msg.text && (
          <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 16, fontWeight: 600, fontSize: 13, background: msg.type === 'error' ? '#fee2e2' : '#dcfce7', color: msg.type === 'error' ? '#dc2626' : '#16a34a' }}>{msg.text}</div>
        )}

        {/* CHECK IN TAB */}
        {tab === 'checkin' && (
          <div style={{ animation: 'fadeUp .3s ease' }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,.06)', marginBottom: 20, maxWidth: 520 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 6 }}>SELECT DATE</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inp, maxWidth: 220 }} />
            </div>

            {existing ? (
              <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,.06)', maxWidth: 520, borderLeft: '4px solid #16a34a' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 12, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>✅</div>
                  <div>
                    <div style={{ fontWeight: 800, color: '#0f172a' }}>Attendance Recorded</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{date}</div>
                  </div>
                </div>
                {TIME_FIELDS.map(tf => existing[tf.key] && (
                  <div key={tf.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 14px', background: '#f8fafc', borderRadius: 8, marginBottom: 6 }}>
                    <span style={{ color: '#64748b', fontSize: 13 }}>{tf.icon} {tf.label}</span>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{existing[tf.key]}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ background: '#fff', borderRadius: 16, padding: 28, boxShadow: '0 2px 12px rgba(0,0,0,.06)', maxWidth: 520 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 20 }}>Record Attendance</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                  {TIME_FIELDS.map(tf => (
                    <div key={tf.key}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 6 }}>
                        {tf.icon} {tf.label.toUpperCase()} {tf.required && <span style={{ color: '#dc2626' }}>*</span>}
                      </label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input type="time" style={{ ...inp }} value={form[tf.key]} onChange={f(tf.key)} />
                        <button onClick={() => f(tf.key)({ target: { value: nowTime() } })} style={{ padding: '0 10px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#f8fafc', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>Now</button>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={submit} disabled={loading} style={{ width: '100%', padding: 13, borderRadius: 12, border: 'none', background: loading ? '#94a3b8' : '#0f172a', color: '#fbbf24', fontWeight: 800, fontSize: 15, fontFamily: 'inherit' }}>
                  {loading ? 'Saving...' : '✓ Submit Attendance'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {tab === 'history' && (
          <div style={{ animation: 'fadeUp .3s ease' }}>
            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,.06)', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', padding: '12px 20px', background: '#0f172a' }}>
                {['Date', 'Office Entry', 'Site Entry', 'Site Exit', 'Office Exit'].map(h => (
                  <span key={h} style={{ color: '#fbbf24', fontWeight: 700, fontSize: 11, letterSpacing: .5 }}>{h}</span>
                ))}
              </div>
              {history.length === 0
                ? <div style={{ textAlign: 'center', padding: 56, color: '#94a3b8' }}><div style={{ fontSize: 36 }}>📊</div><p style={{ marginTop: 8 }}>No records yet</p></div>
                : history.map((r, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', padding: '13px 20px', background: i % 2 === 0 ? '#f8fafc' : '#fff', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>{r.date}</span>
                    {['officeEntryTime', 'siteEntryTime', 'siteExitTime', 'officeExitTime'].map(k => (
                      <span key={k} style={{ color: r[k] ? '#0f172a' : '#cbd5e1', fontSize: 13, fontWeight: r[k] ? 600 : 400 }}>{r[k] || '—'}</span>
                    ))}
                  </div>
                ))
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
