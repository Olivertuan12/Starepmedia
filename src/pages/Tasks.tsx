import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { CheckCircle2, Circle, Clock, AlertCircle, ExternalLink, HardDrive } from 'lucide-react';
import { format } from 'date-fns';

export const Tasks = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllTasks = async () => {
      if (!user) return;
      try {
        setLoading(true);
        // In this implementation, tasks are videos and documents. 
        // We fetch all videos across all projects owned by the user.
        const projectsSnapshot = await getDocs(query(collection(db, 'projects'), where('ownerId', '==', user.uid)));
        const allTasks: any[] = [];
        
        for (const projectDoc of projectsSnapshot.docs) {
          const videosSnapshot = await getDocs(collection(db, `projects/${projectDoc.id}/videos`));
          videosSnapshot.forEach(vDoc => {
            allTasks.push({
              id: vDoc.id,
              projectId: projectDoc.id,
              projectName: projectDoc.data().name,
              type: 'video',
              ...vDoc.data()
            });
          });

          const docsSnapshot = await getDocs(collection(db, `projects/${projectDoc.id}/documents`));
          docsSnapshot.forEach(dDoc => {
            allTasks.push({
              id: dDoc.id,
              projectId: projectDoc.id,
              projectName: projectDoc.data().name,
              type: 'document',
              ...dDoc.data()
            });
          });
        }
        
        setTasks(allTasks.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0)));
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, 'all-tasks');
      } finally {
        setLoading(false);
      }
    };

    fetchAllTasks();
  }, [user]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050505]">
      <header className="h-14 shrink-0 border-b border-white/10 flex items-center justify-between px-6 bg-[#050505]">
         <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-indigo-500" />
            <h1 className="text-sm font-bold uppercase tracking-widest text-[#E0E0E0]">Master Task List</h1>
         </div>
         <div className="text-[10px] text-white/30 font-mono uppercase tracking-widest">
            {tasks.length} Items trackings
         </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
         {loading ? (
            <div className="flex items-center justify-center h-32">
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            </div>
         ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-20 border border-dashed border-white/10 rounded-xl">
               <AlertCircle className="w-8 h-8 text-white/10 mb-3" />
               <h3 className="text-sm font-bold text-white uppercase tracking-widest">The Archive is Empty</h3>
               <p className="text-xs text-white/40 mt-1 italic">Initialize a new project to construct the narrative.</p>
            </div>
         ) : (
            <div className="grid grid-cols-1 gap-3">
               {tasks.map(task => (
                  <div key={task.id} className="bg-[#121214] border border-white/5 rounded-lg p-4 hover:border-white/10 transition-all group flex items-center gap-4">
                     <div className="w-10 h-10 rounded bg-[#1A1A1C] flex items-center justify-center shrink-0 border border-white/5">
                        {task.type === 'video' ? <Video className="w-5 h-5 text-indigo-400" /> : <Book className="w-5 h-5 text-emerald-400" />}
                     </div>
                     
                     <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                           <span className="text-[9px] uppercase font-bold text-white/30 tracking-widest bg-white/5 px-1.5 py-0.5 rounded">
                              {task.projectName}
                           </span>
                           <span className={`text-[9px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded ${
                              task.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400' :
                              task.status === 'Editing' ? 'bg-indigo-500/10 text-indigo-400' :
                              'bg-white/5 text-white/40'
                           }`}>
                              {task.status || 'New Arrival'}
                           </span>
                        </div>
                        <h4 className="text-xs font-bold text-white truncate group-hover:text-indigo-400 transition-colors">
                           {task.name || 'Untitled'}
                        </h4>
                        <p className="text-[10px] text-white/40 font-mono mt-1 line-clamp-1 italic pr-10">
                           {task.description || 'No description provided.'}
                        </p>
                     </div>

                     <div className="flex items-center gap-6 pr-4">
                        {task.eventDate && (
                           <div className="flex flex-col items-end">
                              <span className="text-[8px] uppercase font-bold text-white/20 tracking-tighter">Deadline</span>
                              <span className="text-[10px] font-mono text-orange-400">{new Date(task.eventDate).toLocaleDateString()}</span>
                           </div>
                        )}
                        
                        <div className="flex items-center gap-2">
                           <a 
                             href="#" 
                             className="p-2 bg-white/5 hover:bg-white/10 rounded transition-colors text-white/40 hover:text-white border border-transparent hover:border-white/10"
                             title="Drive Link"
                           >
                              <HardDrive className="w-3.5 h-3.5" />
                           </a>
                           <button className="p-2 bg-white/5 hover:bg-white/10 rounded transition-colors text-white/40 hover:text-white border border-transparent hover:border-white/10">
                              <ExternalLink className="w-3.5 h-3.5" />
                           </button>
                        </div>
                     </div>
                  </div>
               ))}
            </div>
         )}
      </div>
    </div>
  );
};

// Reuse icons from lucide-react in current scope if not imported
import { Video, Book } from 'lucide-react';
