import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import AdminLayout from './components/AdminLayout';
import EmployeeDashboard from './components/EmployeeDashboard';
import './App.css';

function decodeToken(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    return JSON.parse(atob(pad ? base64 + '='.repeat(4 - pad) : base64));
  } catch { return null; }
}

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const payload = decodeToken(token);
      if (payload) setUser(payload);
      else localStorage.removeItem('token');
    }
  }, []);

  const handleLogin = (token) => {
    localStorage.setItem('token', token);
    const payload = decodeToken(token);
    if (payload) setUser(payload);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  if (!user) return <Login onLogin={handleLogin} />;

  if (user.role === 'admin') {
    return <AdminLayout user={user} onLogout={handleLogout} />;
  }

  // Employee / student
  return <EmployeeDashboard user={user} onLogout={handleLogout} />;
}

export default App;
