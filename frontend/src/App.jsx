// src/App.jsx
import React, { useState } from 'react';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import DataHistory from './pages/DataHistory';
import ActionHistory from './pages/ActionHistory';
import Profile from './pages/Profile';
import Login from './pages/Login';
import { useAuth } from './context/AuthContext';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-gray-800 font-sans antialiased pb-12">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="max-w-7xl mx-auto px-4">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'sensor-history' && <DataHistory />}
        {activeTab === 'action-history' && <ActionHistory />}
        {activeTab === 'profile' && <Profile />}
      </main>
    </div>
  );
}