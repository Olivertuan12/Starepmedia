import React from 'react';
import { useAuth } from '../lib/AuthContext';
import { Settings as SettingsIcon, Shield, Globe, Database, HardDrive, Youtube, Key } from 'lucide-react';

export const Settings = () => {
  const { user } = useAuth();

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050505]">
      <header className="h-14 shrink-0 border-b border-white/10 flex items-center justify-between px-6 bg-[#050505]">
         <div className="flex items-center gap-3">
            <SettingsIcon className="w-5 h-5 text-indigo-500" />
            <h1 className="text-sm font-bold uppercase tracking-widest text-[#E0E0E0]">Security & Integrations</h1>
         </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 max-w-4xl custom-scrollbar">
         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Account Info */}
            <div className="space-y-6">
               <div className="space-y-2">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                     <Shield className="w-4 h-4 text-emerald-400" />
                     Workspace Login
                  </h2>
                  <p className="text-[10px] text-white/30 italic">Account để bảo mật ID & Project. Không có quyền truy cập file/lịch.</p>
               </div>

               <div className="bg-[#121214] border border-white/5 rounded-xl p-6 relative overflow-hidden">
                  <div className="flex items-center gap-4">
                     <img src={user?.photoURL || ''} alt="" className="w-12 h-12 rounded-full border-2 border-indigo-500/50" />
                     <div>
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">{user?.displayName}</h3>
                        <p className="text-xs text-white/40 font-mono italic">{user?.email}</p>
                     </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                     <div className="text-[10px] font-mono text-emerald-400 uppercase tracking-tighter">Verified Session</div>
                     <button className="text-[9px] uppercase font-bold text-white/40 hover:text-white transition-colors">Switch Account</button>
                  </div>
                  {/* Decorative element */}
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 blur-3xl rounded-full -mr-10 -mt-10" />
               </div>

               <div className="space-y-4">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                     <Globe className="w-4 h-4 text-blue-400" />
                     External Connectivity
                  </h2>
                  
                  <div className="space-y-3">
                     <div className="flex items-center justify-between p-3 bg-[#121214] border border-white/5 rounded-lg group hover:border-indigo-500/30 transition-colors">
                        <div className="flex items-center gap-3">
                           <Youtube className="w-4 h-4 text-orange-400" />
                           <div className="text-xs font-bold text-white uppercase tracking-wider">Calendar Sync</div>
                        </div>
                        <div className="text-[9px] text-emerald-400 px-2 py-0.5 bg-emerald-500/10 rounded font-mono uppercase">Connected</div>
                     </div>

                     <div className="flex items-center justify-between p-3 bg-[#121214] border border-white/5 rounded-lg group hover:border-white/10 transition-colors opacity-50">
                        <div className="flex items-center gap-3">
                           <HardDrive className="w-4 h-4 text-indigo-400" />
                           <div className="text-xs font-bold text-white uppercase tracking-wider">Storage Link</div>
                        </div>
                        <div className="text-[9px] text-white/20 px-2 py-0.5 bg-white/5 rounded font-mono uppercase">Disconnected</div>
                     </div>
                  </div>
               </div>
            </div>

            {/* Config Info */}
            <div className="space-y-6">
               <div className="space-y-2">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                     <Key className="w-4 h-4 text-orange-400" />
                     Google Client ID Setup
                  </h2>
                  <p className="text-[10px] text-white/40 leading-relaxed italic pr-4">
                     To connect external services like Calendar and Drive independently, you need a Google OAuth Client ID. 
                     Create one in the <a href="https://console.cloud.google.com/apis/credentials" target="_blank" className="text-indigo-400 hover:underline">Google Cloud Console</a>.
                  </p>
               </div>

               <div className="bg-[#121214] border border-white/5 rounded-xl p-6 space-y-4">
                  <div className="space-y-2">
                     <label className="text-[9px] font-bold uppercase tracking-widest text-white/20">Authorized Redirect URI</label>
                     <div className="flex items-center bg-[#050505] border border-white/10 rounded overflow-hidden">
                        <code className="flex-1 p-2 text-[10px] text-indigo-300 font-mono truncate">
                           {window.location.origin}/oauthCallback
                        </code>
                        <button 
                          onClick={() => navigator.clipboard.writeText(`${window.location.origin}/oauthCallback`)}
                          className="bg-white/5 hover:bg-white/10 text-[9px] font-bold uppercase px-3 py-2 text-white/60 transition-colors"
                        >
                           Copy
                        </button>
                     </div>
                  </div>

                  <div className="p-4 bg-orange-500/5 border border-orange-500/10 rounded-lg">
                     <h4 className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-1 italic">Important</h4>
                     <p className="text-[9px] text-orange-400/60 leading-relaxed italic">
                        Make sure your Client ID has scopes for: <br/>
                        • calendar.readonly <br/>
                        • drive.readonly
                     </p>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};
