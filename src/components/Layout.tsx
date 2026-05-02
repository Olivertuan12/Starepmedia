import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Home, Folder, Video, Book, Calendar, CheckSquare, Settings, Users, ChevronLeft, Menu, GripVertical } from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'motion/react';

export const Layout = () => {
  const { user, logOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [navItems, setNavItems] = useState([
    { id: 'projects', label: 'Projects', path: '/projects', icon: Home, color: 'text-indigo-400' },
    { id: 'roadmap', label: 'Roadmap', path: '/roadmap', icon: Book, color: 'text-emerald-400' },
    { id: 'calendar', label: 'Calendar', path: '/calendar', icon: Calendar, color: 'text-orange-400' },
    { id: 'customers', label: 'Customers', path: '/customers', icon: Users, color: 'text-pink-400' },
  ]);

  return (
    <div className="flex h-screen w-full bg-[#0A0A0B] text-[#E0E0E0] font-sans">
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.div 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 256, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            className="h-full bg-[#121214] border-r border-white/10 flex flex-col flex-shrink-0 relative z-50 overflow-hidden"
          >
            <div className="p-4 h-14 border-b border-white/10 flex items-center justify-between shrink-0">
               <div className="font-semibold tracking-tight text-lg flex items-center gap-2">
                 <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center shadow-[0_0_10px_rgba(79,70,229,0.4)]">
                    <div className="w-3 h-3 bg-white rounded-sm"></div>
                 </div>
                 <span className="text-white text-xs uppercase tracking-widest font-bold ml-1">SyncSpace</span>
               </div>
               <button 
                 onClick={() => setIsSidebarOpen(false)}
                 className="p-1.5 hover:bg-white/5 rounded text-white/20 hover:text-white transition-all"
               >
                 <ChevronLeft className="w-4 h-4" />
               </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-1 custom-scrollbar">
               <div className="text-[11px] uppercase tracking-widest text-white/30 font-bold px-2 py-2 mb-2 flex items-center justify-between">
                  <span>Workspace</span>
               </div>
               
               <div className="space-y-1">
                 {navItems.map((item) => (
                   <div key={item.id} className="group relative">
                     <Link 
                       to={item.path} 
                       className={`flex items-center gap-3 p-2.5 text-[11px] font-bold uppercase tracking-wider rounded transition-all border border-transparent ${
                         location.pathname === item.path 
                           ? 'bg-indigo-500/10 text-white border-indigo-500/20' 
                           : 'text-white/40 hover:bg-white/5 hover:text-white hover:border-white/5'
                       }`}
                     >
                        <item.icon className={`w-4 h-4 ${location.pathname === item.path ? item.color : 'text-white/20 group-hover:text-white/60 transition-colors'}`} />
                        {item.label}
                     </Link>
                   </div>
                 ))}
               </div>
            </div>

            <div className="p-4 border-t border-white/5 mt-auto bg-[#0d0d0f] flex flex-col gap-3">
               <Link 
                 to="/settings"
                 className={`flex items-center gap-3 p-2.5 text-[11px] font-bold uppercase tracking-wider rounded transition-all border border-transparent ${
                   location.pathname === '/settings'
                     ? 'bg-indigo-500/10 text-white border-indigo-500/20' 
                     : 'text-white/40 hover:bg-white/5 hover:text-white hover:border-white/5'
                 }`}
               >
                  <Settings className={`w-4 h-4 ${location.pathname === '/settings' ? 'text-white' : 'text-white/20 group-hover:text-white/60 transition-colors'}`} />
                  Sta Rep Media Settings
               </Link>
               
               <div className="flex items-center gap-3">
                 <img src={user?.photoURL || ''} alt="Avatar" className="w-8 h-8 rounded-full border-2 border-white/5 shadow-xl" />
                 <div className="flex-1 min-w-0">
                   <p className="text-[11px] font-black truncate text-white uppercase tracking-wider">{user?.displayName}</p>
                   <p className="text-[9px] text-white/30 uppercase font-mono truncate">{user?.email}</p>
                 </div>
                 <button onClick={() => logOut().then(() => navigate('/'))} className="text-white/20 hover:text-white p-2 rounded-lg transition-colors hover:bg-white/5">
                    <LogOut className="w-3.5 h-3.5" />
                 </button>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Toggle for closed sidebar */}
      {!isSidebarOpen && (
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => setIsSidebarOpen(true)}
          className="fixed top-4 left-4 z-[60] w-10 h-10 bg-[#121214] border border-white/10 rounded-lg flex items-center justify-center text-white/40 hover:text-white shadow-xl"
        >
          <Menu className="w-5 h-5" />
        </motion.button>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-[#050505] z-0">
         <Outlet />
      </div>
    </div>
  );
};
