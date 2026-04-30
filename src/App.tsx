import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { UserProfile, UserRole } from './types';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import ChatAgent from './components/ChatAgent';
import AdminPanel from './components/AdminPanel';
import CaseDetails from './components/CaseDetails';
import { LayoutDashboard, MessageSquare, Shield, LogOut, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type View = 'dashboard' | 'chat' | 'admin' | 'case-details';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('dashboard');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Fetch or create profile
        const profileDoc = await getDoc(doc(db, 'users', u.uid));
        if (profileDoc.exists()) {
          setProfile(profileDoc.data() as UserProfile);
        } else {
          // Default to agent for new users
          const newProfile: UserProfile = {
            uid: u.uid,
            email: u.email || '',
            role: UserRole.AGENT,
            name: u.displayName || u.email?.split('@')[0] || 'User'
          };
          // Check if it's the bootstrap admin
          if (u.email === 'jtrapero2013@gmail.com') {
            newProfile.role = UserRole.ADMIN;
          }
          await setDoc(doc(db, 'users', u.uid), newProfile);
          setProfile(newProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
  }, []);

  const handleLogout = () => auth.signOut();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans text-slate-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col p-4">
        <div className="mb-8 px-2">
          <h1 className="text-xl font-bold text-blue-600 flex items-center gap-2">
            <span className="p-1.5 bg-blue-600 text-white rounded-lg">BC</span>
            Case AI Pro
          </h1>
        </div>

        <nav className="flex-1 space-y-1">
          <button
            onClick={() => setView('dashboard')}
            className={`sidebar-link w-full text-left ${view === 'dashboard' ? 'active' : ''}`}
          >
            <LayoutDashboard size={20} /> Dashboard
          </button>
          <button
            onClick={() => setView('chat')}
            className={`sidebar-link w-full text-left ${view === 'chat' ? 'active' : ''}`}
          >
            <MessageSquare size={20} /> Nuevo Caso
          </button>
          {profile?.role === UserRole.ADMIN && (
            <button
              onClick={() => setView('admin')}
              className={`sidebar-link w-full text-left ${view === 'admin' ? 'active' : ''}`}
            >
              <Shield size={20} /> Panel Admin
            </button>
          )}
        </nav>

        <div className="pt-4 border-t border-slate-200">
          <div className="px-2 mb-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Usuario</p>
            <p className="text-sm font-medium truncate">{profile?.name || user.email}</p>
            <p className="text-[10px] text-slate-500 uppercase">{profile?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="sidebar-link w-full text-left text-red-500 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={20} /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto relative p-8">
        <AnimatePresence mode="wait">
          {view === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Dashboard 
                onViewCase={(id) => {
                  setSelectedCaseId(id);
                  setView('case-details');
                }} 
              />
            </motion.div>
          )}
          {view === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="h-[calc(100vh-4rem)]"
            >
              <ChatAgent onFinished={(id) => {
                setSelectedCaseId(id);
                setView('case-details');
              }} />
            </motion.div>
          )}
          {view === 'admin' && (
            <motion.div
              key="admin"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <AdminPanel />
            </motion.div>
          )}
          {view === 'case-details' && selectedCaseId && (
            <motion.div
              key="case-details"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <CaseDetails 
                caseId={selectedCaseId} 
                onBack={() => setView('dashboard')} 
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
