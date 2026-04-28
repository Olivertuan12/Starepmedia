import React, { useState, useEffect } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Video, Plus, Youtube } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, getDocs, setDoc, doc, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { v4 as uuidv4 } from 'uuid';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

export const CalendarView = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<any[]>([]);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [showProjectSelect, setShowProjectSelect] = useState<{eventId: string, x: number, y: number} | null>(null);
  
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  useEffect(() => {
    const fetchProjects = async () => {
      if (!user) return;
      try {
        const q = query(collection(db, 'projects'), where('ownerId', '==', user.uid));
        const snapshot = await getDocs(q);
        const projs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setProjects(projs);
        if (projs.length > 0) setSelectedProjectId(projs[0].id);
      } catch(e) {
        handleFirestoreError(e, OperationType.GET, 'projects');
      }
    };
    fetchProjects();
  }, [user]);

  const authenticateCalendar = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/calendar.readonly');
      provider.setCustomParameters({
        prompt: 'consent'
      });
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setAccessToken(credential.accessToken);
        fetchCalendarEvents(credential.accessToken);
      }
    } catch (e) {
      console.error("Error authenticating calendar:", e);
    }
  };

  const fetchCalendarEvents = async (token: string) => {
    setIsLoadingEvents(true);
    try {
      const timeMin = startOfMonth(currentDate).toISOString();
      const timeMax = endOfMonth(addMonths(currentDate, 1)).toISOString();
      
      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.items) {
        const formattedEvents = data.items.map((item: any) => ({
          id: item.id,
          title: item.summary || 'Untitled Event',
          date: item.start.dateTime || item.start.date,
          type: 'meeting'
        })).filter((e: any) => e.date);
        
        setEvents(formattedEvents);
        
        // Sync dates on videos
        for (const proj of projects) {
          try {
            const vidsSnapshot = await getDocs(query(collection(db, `projects/${proj.id}/videos`)));
            vidsSnapshot.forEach(async (vidDoc) => {
              const vidData = vidDoc.data();
              if (vidData.eventId) {
                 const matchingEvent = formattedEvents.find((evt: any) => evt.id === vidData.eventId);
                 if (matchingEvent && matchingEvent.date !== vidData.eventDate) {
                   await updateDoc(doc(db, `projects/${proj.id}/videos/${vidDoc.id}`), {
                     eventDate: matchingEvent.date,
                     updatedAt: serverTimestamp()
                   });
                 }
              }
            });
          } catch(e) {
            console.error("Error syncing video dates:", e);
          }
        }
      }
    } catch(e) {
      console.error("Error fetching calendar events", e);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  useEffect(() => {
    if (accessToken) {
      fetchCalendarEvents(accessToken);
    }
  }, [currentDate, accessToken]);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const dateFormat = "d";
  const rows = [];
  let days = [];
  let day = startDate;
  let formattedDate = "";

  const handleCreateVideoFromEvent = async (event: any, projectId: string) => {
    if (!projectId) return;
    try {
      const videoId = uuidv4();
      await setDoc(doc(db, `projects/${projectId}/videos/${videoId}`), {
         name: event.title,
         description: `Auto-generated from Google Calendar Event: \nDate: ${format(parseISO(event.date), 'PPP')}`,
         status: 'New Arrival',
         createdAt: serverTimestamp(),
         updatedAt: serverTimestamp(),
         eventDate: event.date,
         eventId: event.id
      });
      setShowProjectSelect(null);
      navigate(`/projects/${projectId}`);
    } catch(e) {
      handleFirestoreError(e, OperationType.CREATE, `projects/${projectId}/videos`);
    }
  };

  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      formattedDate = format(day, dateFormat);
      const cloneDay = day;
      const dayEvents = events.filter(e => isSameDay(parseISO(e.date), cloneDay));

      days.push(
        <div
          className={`flex-1 min-h-[100px] border border-white/5 p-2 bg-[#121214] flex flex-col ${!isSameMonth(day, monthStart) ? "text-white/20 bg-black/40" : "text-white/80"} ${isSameDay(day, new Date()) ? 'border-indigo-500/50 relative' : ''}`}
          key={day.toString()}
        >
          {isSameDay(day, new Date()) && <div className="absolute top-0 right-0 w-2 h-2 bg-indigo-500 rounded-bl-sm" />}
          <span className="text-[10px] uppercase font-bold tracking-widest">{formattedDate}</span>
          
          <div className="mt-2 space-y-1 flex-1 overflow-y-auto custom-scrollbar">
            {dayEvents.map(evt => (
               <div key={evt.id} className="bg-[#1A1A1C] border border-white/10 rounded p-1.5 group hover:border-indigo-500/30 transition-colors">
                  <div className="text-[10px] font-medium truncate text-white mb-1">{evt.title}</div>
                  <button 
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setShowProjectSelect({ eventId: evt.id, x: rect.left, y: rect.bottom });
                    }}
                    className="flex w-full items-center justify-center gap-1 bg-white/5 hover:bg-white/10 text-[9px] uppercase font-bold py-1 rounded text-white/50 hover:text-white transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    New Video
                  </button>
               </div>
            ))}
          </div>
        </div>
      );
      day = addDays(day, 1);
    }
    rows.push(
      <div className="flex w-full" key={day.toString()}>
        {days}
      </div>
    );
    days = [];
  }

  return (
    <div className="flex-1 flex flex-col h-full relative z-0">
      <header className="h-14 shrink-0 border-b border-white/10 flex items-center justify-between px-6 bg-[#050505]">
        <div className="flex items-center gap-4">
           <h1 className="text-sm font-bold uppercase tracking-widest text-[#E0E0E0]">Google Calendar</h1>
           {accessToken ? (
              <div className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-mono uppercase">Connected</div>
           ) : (
              <button 
                onClick={authenticateCalendar}
                className="text-[10px] text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-0.5 rounded font-mono uppercase transition-colors"
              >
                Connect Google Account
              </button>
           )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-1 hover:bg-white/5 rounded text-white/40 hover:text-white border border-transparent hover:border-white/10"><ChevronLeft className="w-4 h-4"/></button>
            <span className="text-xs font-bold uppercase tracking-widest w-32 text-center text-white/80">
              {format(currentDate, "MMMM yyyy")}
            </span>
            <button onClick={nextMonth} className="p-1 hover:bg-white/5 rounded text-white/40 hover:text-white border border-transparent hover:border-white/10"><ChevronRight className="w-4 h-4"/></button>
          </div>
          <button 
            disabled={!accessToken || isLoadingEvents}
            onClick={() => accessToken && fetchCalendarEvents(accessToken)}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 disabled:cursor-not-allowed text-white rounded text-[10px] uppercase font-bold transition-colors shadow-[0_0_15px_rgba(59,130,246,0.5)]"
          >
            <Youtube className="w-3 h-3" />
            {isLoadingEvents ? 'Syncing...' : 'Sync Events'}
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto bg-[#050505] p-6 pb-20">
         <div className="w-full flex-col flex border border-white/5 rounded-lg overflow-hidden bg-[#1A1A1C] shadow-2xl">
            <div className="flex w-full border-b border-white/5 bg-[#121214]">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="flex-1 p-2 text-center text-[10px] font-bold uppercase tracking-widest text-white/40">
                  {d}
                </div>
              ))}
            </div>
            <div className="flex flex-col w-full bg-[#050505]">
               {rows}
            </div>
         </div>
      </div>
      
      {showProjectSelect && (
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setShowProjectSelect(null)} />
          <div 
            className="fixed z-[101] bg-[#1A1A1C] border border-white/10 rounded-lg shadow-2xl p-4 w-64 flex flex-col gap-3"
            style={{ top: showProjectSelect.y + 10, left: showProjectSelect.x }}
          >
             <h3 className="text-xs font-bold text-white uppercase tracking-widest">Select Target Project</h3>
             {projects.length > 0 ? (
               <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
                 {projects.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleCreateVideoFromEvent(events.find(e => e.id === showProjectSelect.eventId), p.id)}
                      className="px-3 py-2 text-xs text-left bg-black hover:bg-indigo-500/20 hover:text-indigo-400 border border-white/5 hover:border-indigo-500/50 rounded transition-colors text-white/70"
                    >
                      {p.name || 'Untitled Project'}
                    </button>
                 ))}
               </div>
             ) : (
               <div className="text-xs text-white/40 italic">No projects found.</div>
             )}
          </div>
        </>
      )}
    </div>
  );
};
