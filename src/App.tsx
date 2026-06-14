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
import CoraVectorAvatar from './components/CoraVectorAvatar';
import { LayoutDashboard, MessageSquare, Shield, LogOut, Loader2, Sparkles, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import FacialRecognitionModal from './components/FacialRecognitionModal';

type View = 'dashboard' | 'chat' | 'admin' | 'case-details';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('dashboard');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [isFacialModalOpen, setIsFacialModalOpen] = useState(false);

  useEffect(() => {
    const handleSetAppView = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && typeof customEvent.detail === 'string') {
        setView(customEvent.detail as View);
      }
    };
    window.addEventListener('change-app-view', handleSetAppView);
    return () => {
      window.removeEventListener('change-app-view', handleSetAppView);
    };
  }, []);

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
      <div className="min-h-screen flex items-center justify-center bg-[#030409]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen flex bg-[#faf8f5] font-sans text-[#1c2621] antialiased overflow-hidden selection:bg-[#0f4c3a]/15 selection:text-[#0f4c3a] relative">
      {/* Ambient background organic glow gradients */}
      <div className="absolute top-0 left-1/4 w-[750px] h-[750px] bg-emerald-700/5 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute bottom-10 right-10 w-[600px] h-[600px] bg-amber-600/5 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarHovered ? 260 : 80 }}
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
        className="bg-[#f5f1ea]/90 backdrop-blur-lg border-r border-[#1c2621]/6 flex flex-col p-4 z-20 overflow-hidden shadow-[4px_0_24px_rgba(15,76,58,0.02)]"
      >
        <div className="mb-10 px-2 flex items-center h-10 select-none">
          <div className="p-2.5 bg-gradient-to-br from-[#0f4c3a] to-[#25423a] text-white rounded-xl shrink-0 shadow-md shadow-[#0f4c3a]/10">
            <span className="font-extrabold text-xs tracking-wider uppercase">BC</span>
          </div>
          <AnimatePresence>
            {isSidebarHovered && (
              <motion.h1 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="text-md font-black bg-gradient-to-r from-[#0f4c3a] to-[#436e61] bg-clip-text text-transparent ml-3 whitespace-nowrap tracking-wide uppercase"
              >
                Business Case
              </motion.h1>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 space-y-2">
          <SidebarNavItem 
            icon={<LayoutDashboard size={22} />} 
            label="Dashboard" 
            isActive={view === 'dashboard'} 
            onClick={() => setView('dashboard')} 
            isExpanded={isSidebarHovered}
          />
          <SidebarNavItem 
            icon={<MessageSquare size={22} />} 
            label="Chat Inteligente" 
            isActive={view === 'chat'} 
            onClick={() => setView('chat')} 
            isExpanded={isSidebarHovered}
          />
          <SidebarNavItem 
            icon={<Sparkles size={22} className="text-[#0f4c3a] animate-pulse animate-[pulse_2.5s_infinite]" />} 
            label="Asistente Cora 🎙️" 
            isActive={false} 
            onClick={() => {
              (window as any).coraAutoStart = true;
              setView('dashboard');
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('open-new-case-form'));
                window.dispatchEvent(new CustomEvent('cora-floating-click'));
              }, 120);
            }} 
            isExpanded={isSidebarHovered}
          />
          <SidebarNavItem 
            icon={<Camera size={22} className="text-[#0f4c3a]/80 hover:text-[#0f4c3a]" />} 
            label="Acceso Facial" 
            isActive={isFacialModalOpen} 
            onClick={() => setIsFacialModalOpen(true)} 
            isExpanded={isSidebarHovered}
          />
          {profile?.role === UserRole.ADMIN && (
            <SidebarNavItem 
              icon={<Shield size={22} />} 
              label="Panel Admin" 
              isActive={view === 'admin'} 
              onClick={() => setView('admin')} 
              isExpanded={isSidebarHovered}
            />
          )}
        </nav>

        <div className="pt-4 border-t border-[#1c2621]/6">
          <div className="px-2 mb-4 h-12 flex flex-col justify-center">
            {isSidebarHovered ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <p className="text-[9px] font-bold text-[#6a7470] uppercase tracking-widest mb-0.5 opacity-70">Usuario</p>
                <p className="text-sm font-black text-[#1c2621] truncate">{profile?.name || user.email}</p>
                <p className="text-[10px] font-bold uppercase tracking-tight text-[#0f4c3a]">{profile?.role === UserRole.ADMIN ? '👑 Administrador' : '💼 Consultor'}</p>
              </motion.div>
            ) : (
              <div className="flex justify-center">
                <div className="w-8 h-8 rounded-xl bg-[#e2dfd9] border border-[#1c2621]/5 flex items-center justify-center text-xs font-black text-[#0f4c3a]">
                  {profile?.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
                </div>
              </div>
            )}
          </div>
          
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 p-3 w-full rounded-xl transition-all cursor-pointer ${
              isSidebarHovered ? 'justify-start px-4 hover:bg-rose-500/10 text-rose-700' : 'justify-center text-slate-400 hover:text-rose-700'
            }`}
            title="Cerrar Sesión"
          >
            <LogOut size={22} />
            {isSidebarHovered && <span className="font-extrabold text-sm">Salir</span>}
          </button>
        </div>
      </motion.aside>

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
              <AdminPanel onViewCase={(id) => {
                setSelectedCaseId(id);
                setView('case-details');
              }} />
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

      {/* Global Persistent Floating Cora Avatar in the Top-Right Corner */}
      <div className="fixed top-4 right-6 z-40">
        <button 
          onClick={() => {
            (window as any).coraAutoStart = true;
            setView('dashboard');
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('open-new-case-form'));
              window.dispatchEvent(new CustomEvent('cora-floating-click'));
            }, 120);
          }}
          className="relative flex items-center justify-center p-1 w-16 h-16 rounded-full border border-slate-200 bg-white/95 backdrop-blur-md shadow-xl hover:shadow-2xl hover:scale-110 active:scale-95 duration-350 ease-out cursor-pointer group select-none transition-all"
          title="Consúltale a Cora (Asistente de Voz)"
        >
          {/* Subtle spinning dashed aura border */}
          <span className="absolute -inset-1 rounded-full border-2 border-dashed border-indigo-500/30 animate-[spin_12s_linear_infinite] group-hover:border-indigo-500/60" />
          
          <div className="w-14 h-14 rounded-full overflow-hidden shrink-0">
            <CoraVectorAvatar speaking={false} isListening={false} className="w-14 h-14" />
          </div>

          {/* Floating animated green status ring */}
          <span className="absolute bottom-0.5 right-0.5 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white"></span>
          </span>

          {/* Elegant descriptive hover popover badge */}
          <div className="absolute right-full mr-3.5 top-1/2 -translate-y-1/2 bg-slate-900/90 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl whitespace-nowrap shadow-lg opacity-0 -translate-x-3 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 pointer-events-none">
            🎙️ Hablar con Cora
          </div>
        </button>
      </div>

      {/* Biometric Face Modal overlay */}
      <AnimatePresence>
        {isFacialModalOpen && (
          <FacialRecognitionModal onClose={() => setIsFacialModalOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function SidebarNavItem({ icon, label, isActive, onClick, isExpanded }: { 
  icon: React.ReactNode, 
  label: string, 
  isActive: boolean, 
  onClick: () => void,
  isExpanded: boolean 
}) {
  return (
    <button
      onClick={onClick}
      className={`sidebar-link w-full flex items-center transition-all ${
        isActive ? 'active' : ''
      } ${isExpanded ? 'justify-start px-4' : 'justify-center px-0'}`}
      title={!isExpanded ? label : undefined}
    >
      <div className="shrink-0">{icon}</div>
      <AnimatePresence>
        {isExpanded && (
          <motion.span
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="ml-3 font-bold text-sm whitespace-nowrap"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
