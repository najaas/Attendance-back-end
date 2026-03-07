import React, { useState, useEffect, useCallback } from 'react';

const STATUS = [
  { id: 'Present', color: '#16a34a', bg: '#dcfce7' },
  { id: 'Absent',  color: '#dc2626', bg: '#fee2e2' },
  { id: 'Late',    color: '#ea580c', bg: '#ffedd5' },
  { id: 'Leave',   color: '#6366f1', bg: '#ede9fe' },
];

function token() { return localStorage.getItem('token'); }

export default function AttendancePage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState([]);
  // ✅ attendanceData = { "Alice Johnson": "Present", "Bob Smith": "Absent", ... }
  const [attendanceData, setAttendanceData] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(null);
  const [msg, setMsg] = useState({ text: '', type: '' });

  const showMsg = (text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 2500);
  };

  // Fetch students once
  useEffect(() => {
    fetch('http://localhost:5001/api/students', {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then(r => r.json())
      .then(setStudents)
      .catch(console.error);
  }, []);

  // Fetch attendance for selected date
  const fetchAttendance = useCallback(() => {
    if (!date) return;
    setLoading(true);
    fetch(`http://localhost:5001/api/attendance/date/${date}`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then(r => r.json())
      .then(data => {
        // data = { "Alice Johnson": "Present", "Bob Smith": "Absent", ... }
        setAttendanceData(data || {});
      })
      .catch(() => setAttendanceData({}))
      .finally(() => setLoading(false));
  }, [date]);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  // ✅ Mark one student — sends STRING status, not boolean
  const markOne = async (studentName, status) => {
    setSaving(studentName);
    try {
      const res = await fetch('http://localhost:5001/api/attendance/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({ date, studentName, status }), // status = "Present" etc
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      // ✅ Update only this student in local state — others untouched
      setAttendanceData(prev => ({ ...prev, [studentName]: status }));
      showMsg(`${studentName} → ${status}`);
    } catch (err) {
      showMsg(err.message, 'error');
    } finally {
      setSaving(null);
    }
  };

  // Mark all students with same status
  const markAll = async (status) => {
    setSaving('__all__');
    for (const s of students) {
      await fetch('http://localhost:5001/api/attendance/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ date, studentName: s.name, status }),
      }).catch(() => {});
    }
    // Update all in local state
    const all = {};
    students.forEach(s => { all[s.name] = status; });
    setAttendanceData(prev => ({ ...prev, ...all }));
    showMsg(`All students → ${status}`);
    setSaving(null);
  };

  // Summary counts
  const counts = STATUS.map(s => ({
    ...s,
    count: Object.values(attendanceData).filter(v => v === s.id).length,
  }));
  const unmarked = students.filter(s => !attendanceData[s.name]).length;

  return (
    <div style={{ animation: 'fadeUp .3s ease' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: -.5 }}>Attendance</h1>
        <p style={{ marginTop: 5, color: '#64748b', fontSize: 14 }}>Mark daily student attendance</p>
      </div>

      {/* Controls card */}
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,.06)', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 6, letterSpacing: .5 }}>DATE</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, fontFamily: 'inherit', background: '#f8fafc', color: '#0f172a', width: 200 }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => markAll('Present')}
              disabled={saving === '__all__'}
              style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: '#15803d', color: '#fff', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', opacity: saving === '__all__' ? .6 : 1 }}
            >✓ All Present</button>
            <button
              onClick={() => markAll('Absent')}
              disabled={saving === '__all__'}
              style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', opacity: saving === '__all__' ? .6 : 1 }}
            >✗ All Absent</button>
          </div>

          {/* Summary */}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
            {counts.map(s => (
              <span key={s.id} style={{ padding: '5px 14px', borderRadius: 20, background: s.bg, color: s.color, fontWeight: 700, fontSize: 12, border: `1px solid ${s.color}30` }}>
                {s.id}: {s.count}
              </span>
            ))}
            {unmarked > 0 && (
              <span style={{ padding: '5px 14px', borderRadius: 20, background: '#f1f5f9', color: '#64748b', fontWeight: 700, fontSize: 12 }}>
                Unmarked: {unmarked}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Message */}
      {msg.text && (
        <div style={{
          padding: '10px 16px', borderRadius: 10, marginBottom: 16, fontWeight: 600, fontSize: 13,
          background: msg.type === 'error' ? '#fee2e2' : '#dcfce7',
          color: msg.type === 'error' ? '#dc2626' : '#16a34a',
        }}>{msg.text}</div>
      )}

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,.06)', overflow: 'hidden' }}>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 1fr', padding: '12px 20px', background: '#0f172a' }}>
          <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: 11, letterSpacing: .5 }}>STUDENT NAME</span>
          <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: 11, letterSpacing: .5 }}>STATUS</span>
          <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: 11, letterSpacing: .5 }}>MARK AS</span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>Loading...</div>
        ) : students.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 56, color: '#94a3b8' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🎓</div>
            No students found. Add students first.
          </div>
        ) : (
          students.map((student, i) => {
            const currentStatus = attendanceData[student.name] || '';
            const isSaving = saving === student.name;
            const statusCfg = STATUS.find(s => s.id === currentStatus);

            return (
              <div
                key={student.id}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 160px 1fr',
                  alignItems: 'center', padding: '13px 20px',
                  background: i % 2 === 0 ? '#f8fafc' : '#fff',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                {/* Name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 8,
                    background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 800, fontSize: 13, flexShrink: 0,
                  }}>{student.name[0]}</div>
                  <span style={{ fontWeight: 600, color: '#0f172a', fontSize: 14 }}>{student.name}</span>
                </div>

                {/* Current status badge */}
                <div>
                  {statusCfg ? (
                    <span style={{
                      display: 'inline-block', padding: '4px 12px', borderRadius: 20,
                      background: statusCfg.bg, color: statusCfg.color,
                      fontWeight: 700, fontSize: 12,
                    }}>{currentStatus}</span>
                  ) : (
                    <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>
                  )}
                </div>

                {/* Status buttons — ✅ sends string, not boolean */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {STATUS.map(s => (
                    <button
                      key={s.id}
                      onClick={() => markOne(student.name, s.id)}
                      disabled={isSaving}
                      style={{
                        padding: '5px 12px', borderRadius: 8, fontFamily: 'inherit',
                        fontWeight: 700, fontSize: 11, transition: 'all .15s',
                        cursor: isSaving ? 'not-allowed' : 'pointer',
                        border: `2px solid ${currentStatus === s.id ? s.color : '#e2e8f0'}`,
                        background: currentStatus === s.id ? s.color : '#fff',
                        color: currentStatus === s.id ? '#fff' : '#94a3b8',
                        opacity: isSaving ? .6 : 1,
                      }}
                    >{s.id}</button>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
