import React from 'react';
import { useAuth } from '../lib/AuthContext';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { LogOut, Home, Folder, Video, Book } from 'lucide-react';

export const Layout = () => {
  const { user, logOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex h-screen w-full bg-[#0A0A0B] text-[#E0E0E0] font-sans border-t-2 border-indigo-600">
      {/* Sidebar */}
      <div className="w-64 bg-[#121214] border-r border-white/10 flex flex-col h-full flex-shrink-0 relative z-10">
        <div className="p-4 h-14 border-b border-white/10 flex items-center justify-between">
           <div className="font-semibold tracking-tight text-lg flex items-center gap-2">
             <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center shadow-[0_0_10px_rgba(79,70,229,0.4)]">
                <div className="w-3 h-3 bg-white rounded-sm"></div>
             </div>
             <span className="text-white text-xs uppercase tracking-widest font-bold ml-1">SyncSpace</span>
           </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-1">
           <div className="text-[11px] uppercase tracking-widest text-white/30 font-bold px-2 py-2">Workspace</div>
           <Link to="/projects" className="flex items-center gap-2 p-2 text-xs text-white/60 hover:bg-white/5 hover:text-white rounded transition-colors border border-transparent hover:border-white/5">
              <Home className="w-4 h-4 text-indigo-400" />
              Projects
           </Link>
           <Link to="/roadmap" className="flex items-center gap-2 p-2 text-xs text-white/60 hover:bg-white/5 hover:text-white rounded transition-colors border border-transparent hover:border-white/5 mt-1">
              <Book className="w-4 h-4 text-emerald-400" />
              Roadmap
           </Link>
        </div>

        <div className="p-4 border-t border-white/5 mt-auto">
           <div className="flex items-center gap-3">
             <img src={user?.photoURL || ''} alt="Avatar" className="w-7 h-7 rounded-full border-2 border-[#121214] shadow-md" />
             <div className="flex-1 min-w-0">
               <p className="text-[11px] font-bold truncate text-white uppercase tracking-wider">{user?.displayName}</p>
               <p className="text-[9px] text-white/40 uppercase font-mono truncate">{user?.email}</p>
             </div>
             <button onClick={() => logOut().then(() => navigate('/'))} className="text-white/40 hover:text-white p-1 rounded-md transition-colors hover:bg-white/5 border border-transparent hover:border-white/5">
               <LogOut className="w-3 h-3" />
             </button>
           </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-[#050505] shadow-inner">
         <Outlet />
      </div>
    </div>
  );
};
