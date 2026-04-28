import React from 'react';
import { useAuth } from '../lib/AuthContext';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Video, Book } from 'lucide-react';

export const Login = () => {
  const { user, signIn, loading } = useAuth();
  
  if (loading) return <div className="h-screen w-full flex items-center justify-center">Loading...</div>;
  if (user) return <Navigate to="/projects" />;

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#0A0A0B] p-6 text-[#E0E0E0] font-sans">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
         <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[150px]" />
         <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[150px]" />
      </div>
      
      <motion.div 
         initial={{ opacity: 0, y: 20 }}
         animate={{ opacity: 1, y: 0 }}
         className="z-10 bg-[#121214] border border-white/10 p-8 rounded-lg shadow-2xl w-full max-w-sm flex flex-col items-center relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent"></div>
        
        <div className="flex justify-center mb-6">
           <div className="w-10 h-10 bg-indigo-600 rounded flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.3)]">
             <div className="w-4 h-4 bg-white rounded-sm"></div>
           </div>
        </div>
        
        <h1 className="text-xl font-bold text-center text-white mb-1 uppercase tracking-widest">SyncSpace</h1>
        <p className="text-white/40 text-center text-[10px] uppercase tracking-widest mb-8 font-mono">Professional Workspace</p>
        
        <div className="space-y-3 w-full mb-8">
          <div className="flex gap-3 p-3 rounded bg-white/5 border border-white/5 items-center">
            <span className="text-indigo-400 text-lg">📄</span>
            <div>
               <h3 className="text-white text-xs font-bold uppercase tracking-widest">Documents</h3>
               <p className="text-white/40 text-[10px] font-mono uppercase tracking-tighter mt-0.5">Specifications & Briefs</p>
            </div>
          </div>
          <div className="flex gap-3 p-3 rounded bg-white/5 border border-white/5 items-center">
            <span className="text-indigo-400 text-lg">🎬</span>
            <div>
               <h3 className="text-white text-xs font-bold uppercase tracking-widest">Video Assets</h3>
               <p className="text-white/40 text-[10px] font-mono uppercase tracking-tighter mt-0.5">Frame-accurate reviews</p>
            </div>
          </div>
        </div>
        
        <button
          onClick={signIn}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-4 rounded text-xs tracking-widest transition-colors flex items-center justify-center gap-3 uppercase"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4 bg-white rounded p-0.5" />
          Authenticate
        </button>
      </motion.div>
    </div>
  );
};
