import React, { useState, useEffect } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, subDays, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Video, Plus, Youtube, Calendar, Clock, Archive, UploadCloud, ExternalLink } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, getDocs, setDoc, doc, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { v4 as uuidv4 } from 'uuid';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

export const CalendarView = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [showProjectSelect, setShowProjectSelect] = useState<{eventId: string, x: number, y: number} | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDriveLinked, setIsDriveLinked] = useState(!!localStorage.getItem('drive_linked'));
  
  const [view, setView] = useState<'month' | 'week'>('month');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  const [accessToken, setAccessToken] = useState<string | null>(localStorage.getItem('google_calendar_token'));
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (accessToken) {
      localStorage.setItem('google_calendar_token', accessToken);
    } else {
      localStorage.removeItem('google_calendar_token');
    }
  }, [accessToken]);

  const extractClientInfo = (description: string) => {
    if (!description) return { name: '', email: '', phone: '' };
    
    const emailMatch = description.match(/(?:mailto:)?([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i);
    const phoneMatch = description.match(/(?:\+?(\d{1,3}))?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4})/);
    
    // Clean description from HTML for parsing
    const cleanText = description.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
    
    const labelMatch = description.match(/(?:Client|Name|Customer|Buyer|Contact|Người đặt|Tên kh|Tên|Khách hàng|Khách|Người liên hệ|Tên người đặt):\s*([^\n\r,;<>]+)/i);
    let name = '';
    
    if (labelMatch) {
      name = labelMatch[1].trim();
    } else {
      // Look for first capitalized block that looks like a name
      const potentialNames = cleanText.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/);
      if (potentialNames) name = potentialNames[0];
    }

    return {
      name: name || 'Valued Client',
      email: emailMatch ? (emailMatch[1] || emailMatch[0]).trim() : '',
      phone: phoneMatch ? phoneMatch[0].trim() : ''
    };
  };

  const getStatusConfig = (status: string | undefined) => {
    const s = status || 'Draft';
    const configs: Record<string, { bg: string, text: string, border: string, dot: string, label: string }> = {
      'Confirmed': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', dot: 'bg-emerald-500', label: 'CONFIRMED' },
      'Draft': { bg: 'bg-white/5', text: 'text-white/40', border: 'border-white/10', dot: 'bg-white/20', label: 'DRAFT' },
      'Editing': { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', dot: 'bg-amber-500', label: 'EDITING' },
      'Completed': { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20', dot: 'bg-indigo-500', label: 'COMPLETED' },
      'New Arrival': { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20', dot: 'bg-pink-500', label: 'NEW ARRIVAL' },
      'Scheduled': { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/20', dot: 'bg-sky-500', label: 'SCHEDULED' },
      'Archived': { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20', dot: 'bg-amber-500', label: 'ARCHIVED' },
    };
    return configs[s] || configs['Draft'];
  };

  const parseDescriptionSections = (description: string) => {
    if (!description) return { items: [], intake: [], orderId: '', photographers: '' };
    const sections: any = { items: [], intake: [], orderId: '', photographers: '' };
    
    // Clean description from HTML for parsing
    const cleanText = description.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
    
    // 1. Order ID
    const orderIdMatch = description.match(/<b>Order ID<\/b>\s*<br>\s*([a-zA-Z0-9\-_]+)/i) || 
                        description.match(/Order ID[:\s]+([a-zA-Z0-9\-_]+)/i);
    if (orderIdMatch) sections.orderId = orderIdMatch[1];

    // 2. Order Items / Booked packages
    const itemsSection = description.match(/<b>Order Items<\/b>([\s\S]*?)(?:<b>|$)/i) ||
                        description.match(/Booked packages and services[\s=]+([\s\S]*?)(?:Location|Entry|Amenities|$)/i);
    if (itemsSection) {
      sections.items = itemsSection[1]
        .split(/<br>|•|◦|\n|-/)
        .map(s => s.replace(/<[^>]*>?/gm, '').trim())
        .filter(s => s.length > 3 && !s.includes('====') && !s.includes('----'));
    }

    // 3. Intake / Specific Details
    const intakePatterns = [
      { q: "Entry Notes", pattern: /(?:Entry Notes|How will we access)[^=]*[=\s]+([\s\S]*?)(?:Amenities|Client|Location|Photographers|$)/i },
      { q: "Amenities/Features", pattern: /(?:Amenities or features to highlight)[^=]*[=\s]+([\s\S]*?)(?:Client|Preferences|Photographers|$)/i },
      { q: "Client Preferences", pattern: /(?:Client Preferences)[^=]*[=\s]+([\s\S]*?)(?:Photographers|$)/i },
      { q: "Access Code", pattern: /(?:Gate code|Lockbox|Code)[:\s]+([a-zA-Z0-9]+)/i }
    ];

    intakePatterns.forEach(p => {
      const match = description.match(p.pattern);
      if (match && match[1].trim() && match[1].trim().length > 1) {
        sections.intake.push({ q: p.q, a: match[1].replace(/<[^>]*>?/gm, '').trim() });
      }
    });

    // 4. Photographers
    const photoMatch = description.match(/Photographers[:\s\r\n=]+([\s\S]*?)(?:$)/i);
    if (photoMatch) sections.photographers = photoMatch[1].replace(/<[^>]*>?/gm, '').trim();

    // 5. Fallback Intake (HTML list)
    if (sections.intake.length === 0) {
      const intakeSection = description.match(/<b>Intake Answers<\/b>([\s\S]*?)(?:<b>Order ID|$)/i);
      if (intakeSection) {
        const rawIntake = intakeSection[1];
        const pairs = rawIntake.split(/•\s*<b>/);
        sections.intake = pairs.slice(1).map(p => {
           const parts = p.split(/<\/b>\s*<br>\s*/);
           return {
             q: parts[0]?.replace(/<[^>]*>?/gm, '').trim(),
             a: parts[1]?.replace(/<[^>]*>?/gm, '').trim()
           };
        }).filter(p => p.q && p.a);
      }
    }

    return sections;
  };

  useEffect(() => {
    const fetchLocalEvents = async () => {
      if (!user) return;
      try {
        // Fetch all events for the user to ensure they are available immediately
        const q = query(collection(db, `users/${user.uid}/calendar_events`));
        const snapshot = await getDocs(q);
        const localEvents = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data(),
          // Ensure dates are parsed correctly if they come from Firestore
          date: doc.data().date 
        }));
        
        if (localEvents.length > 0) {
          setEvents(localEvents);
          console.log("Loaded local events from Firestore:", localEvents.length);
        }
      } catch (e) {
        handleFirestoreError(e, OperationType.GET, `users/${user.uid}/calendar_events`);
      }
    };
    fetchLocalEvents();
  }, [user]);

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
    setSyncProgress(1);
    try {
      const timeMin = startOfMonth(subMonths(currentDate, 1)).toISOString();
      const timeMax = endOfMonth(addMonths(currentDate, 6)).toISOString();
      
      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Google Calendar API Error:", errorData);
        if (response.status === 401) setAccessToken(null);
        setIsLoadingEvents(false);
        return;
      }

      const data = await response.json();

      if (data.items) {
        const freshEvents = data.items.map((item: any) => {
          const extracted = extractClientInfo(item.description || '');
          return {
            id: item.id,
            title: item.summary || 'Untitled Event',
            date: item.start.dateTime || item.start.date,
            description: item.description || '',
            location: item.location || '',
            htmlLink: item.htmlLink || '',
            type: 'meeting',
            clientName: extracted.name,
            clientEmail: extracted.email,
            clientPhone: extracted.phone
          };
        }).filter((e: any) => e.date);
        
        if (user && freshEvents.length > 0) {
          const total = freshEvents.length;
          for (let i = 0; i < total; i++) {
            const evt = freshEvents[i];
            try {
              await setDoc(doc(db, `users/${user.uid}/calendar_events`, evt.id), {
                ...evt,
                updatedAt: serverTimestamp()
              }, { merge: true });
            } catch(err) {
              handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/calendar_events/${evt.id}`);
            }
            
            if (i % 5 === 0 || i === total - 1) {
              setSyncProgress(Math.round(((i + 1) / total) * 100));
            }
          }
          
          try {
            const q = query(collection(db, `users/${user.uid}/calendar_events`));
            const snapshot = await getDocs(q);
            const syncedEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setEvents(syncedEvents);
          } catch(err) {
            handleFirestoreError(err, OperationType.GET, `users/${user.uid}/calendar_events`);
          }

          // Sync dates on existing project videos
          for (const proj of projects) {
            try {
              const vidsSnapshot = await getDocs(query(collection(db, `projects/${proj.id}/videos`)));
              for (const vidDoc of vidsSnapshot.docs) {
                const vidData = vidDoc.data();
                if (vidData.eventId) {
                  const matchingEvent = freshEvents.find((evt: any) => evt.id === vidData.eventId);
                  if (matchingEvent && matchingEvent.date !== vidData.eventDate) {
                    await updateDoc(doc(db, `projects/${proj.id}/videos/${vidDoc.id}`), {
                      eventDate: matchingEvent.date,
                      updatedAt: serverTimestamp()
                    });
                  }
                }
              }
            } catch(e) {
              console.error("Error syncing video dates:", e);
            }
          }
        }
      }
    } catch (e) {
      console.error("Fetch Exception:", e);
    } finally {
      setTimeout(() => {
        setIsLoadingEvents(false);
        setSyncProgress(0);
      }, 500);
    }
  };

  const nextMonth = () => {
    if (view === 'month') {
      setCurrentDate(addMonths(currentDate, 1));
    } else {
      setCurrentDate(addDays(currentDate, 7));
    }
  };

  const prevMonth = () => {
    if (view === 'month') {
      setCurrentDate(subMonths(currentDate, 1));
    } else {
      setCurrentDate(subDays(currentDate, 7));
    }
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const dateFormat = "d";
  let formattedDate = "";

  const handleCreateVideoFromEvent = async (event: any, projectId: string) => {
    if (!projectId) return;
    try {
      const videoId = uuidv4();
      await setDoc(doc(db, `projects/${projectId}/videos/${videoId}`), {
         name: event.title,
         description: `Auto-generated from Google Calendar Event: \nDate: ${format(parseISO(event.date), 'PPP')}\nLink: ${event.htmlLink || ''}`,
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

  const generateStoragePath = (event: any) => {
    if (!event) return '';
    const parsed = parseDescriptionSections(event.description);
    const shooter = parsed.photographers || event.shooter || 'Unknown_Shooter';
    const date = format(parseISO(event.date), 'MM-dd-yyyy');
    const orderName = (event.location || event.title).replace(/[^a-zA-Z0-9\s-]/g, '').trim();
    return `syncspace / ${shooter} / ${date} / ${orderName}`;
  };

  const [activeTab, setActiveTab] = useState<'general' | 'editing' | 'deliver'>('general');
  const [isSaving, setIsSaving] = useState(false);

  const filteredEvents = events.filter(e => {
    const searchLower = searchQuery.toLowerCase();
    return (
      (e.title || '').toLowerCase().includes(searchLower) ||
      (e.location || '').toLowerCase().includes(searchLower) ||
      (e.clientName || '').toLowerCase().includes(searchLower) ||
      (e.clientEmail || '').toLowerCase().includes(searchLower)
    );
  });

  const selectedEvent = events.find(e => e.id === selectedEventId);

  const handleUpdateOrder = async (eventId: string, updates: any) => {
    if (!user) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, `users/${user.uid}/calendar_events/${eventId}`), {
        ...updates,
        updatedAt: serverTimestamp()
      });
      // Update local state
      setEvents(events.map(e => e.id === eventId ? { ...e, ...updates } : e));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/calendar_events/${eventId}`);
    } finally {
      setIsSaving(false);
    }
  };

  const calculateProgress = (tasks: any[]) => {
    if (!tasks || tasks.length === 0) return 0;
    const done = tasks.filter(t => t.done).length;
    return Math.round((done / tasks.length) * 100);
  };

  const handleToggleTask = async (eventId: string, taskId: string) => {
    if (!selectedEvent) return;
    const newTasks = (selectedEvent.tasks || []).map((t: any) => 
      t.id === taskId ? { ...t, done: !t.done } : t
    );
    const newProgress = calculateProgress(newTasks);
    await handleUpdateOrder(eventId, { tasks: newTasks, progress: newProgress });
  };

  const defaultTasks = [
    { id: '1', text: 'Color Grading', done: false },
    { id: '2', text: 'Sound Design', done: false },
    { id: '3', text: 'Subtitles', done: false },
    { id: '4', text: 'Music Overlay', done: false },
    { id: '5', text: 'Final Export', done: false }
  ];

  return (
    <div className="flex-1 flex flex-col h-full relative z-0 overflow-hidden">
      <header className="h-12 shrink-0 border-b border-white/10 flex items-center justify-between px-6 bg-[#050505]">
        <div className="flex items-center gap-6">
           <h1 className="text-xs font-black uppercase tracking-[0.2em] text-white">Order Calendar</h1>
           {accessToken ? (
              <div className="text-[9px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-mono uppercase border border-emerald-500/20">Live</div>
           ) : (
              <button 
                onClick={authenticateCalendar}
                className="text-[9px] text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-0.5 rounded font-mono uppercase transition-colors border border-indigo-500/20"
              >
                Sync with Google
              </button>
           )}
        </div>
        
        <div className="flex items-center gap-6">
           <div className="flex items-center bg-black/40 rounded border border-white/10 p-0.5">
              <button 
                onClick={() => setView('month')}
                className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest transition-all rounded ${view === 'month' ? 'bg-white/10 text-white shadow-sm' : 'text-white/20 hover:text-white/40'}`}
              >
                Month
              </button>
              <button 
                onClick={() => setView('week')}
                className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest transition-all rounded ${view === 'week' ? 'bg-white/10 text-white shadow-sm' : 'text-white/20 hover:text-white/40'}`}
              >
                Week
              </button>
           </div>
           
           <div className="flex items-center gap-3">
              <button 
                onClick={goToToday}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-[9px] font-black uppercase tracking-widest text-white/60 hover:text-white border border-white/10 rounded transition-all"
              >
                Today
              </button>
              <div className="flex items-center gap-1.5">
                 <button onClick={prevMonth} className="p-1.5 hover:bg-white/5 rounded-full transition-all text-white/40 hover:text-white">
                   <ChevronLeft className="w-4 h-4" />
                 </button>
                 <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white w-28 text-center bg-white/5 py-1 rounded">
                   {format(currentDate, view === 'month' ? "MMM yyyy" : "MMM d, yy")}
                 </span>
                 <button onClick={nextMonth} className="p-1.5 hover:bg-white/5 rounded-full transition-all text-white/40 hover:text-white">
                   <ChevronRight className="w-4 h-4" />
                 </button>
              </div>
           </div>
           
           <button 
             disabled={!accessToken || isLoadingEvents}
             onClick={() => accessToken && fetchCalendarEvents(accessToken)}
             className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded text-[10px] uppercase font-bold transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)]"
           >
              <Calendar className="w-3 h-3" />
              {isLoadingEvents ? 'Syncing...' : 'Sync Cloud'}
           </button>
        </div>
      </header>

      {/* Sync Progress Bar */}
      {isLoadingEvents && syncProgress > 0 && (
        <div className="h-1 bg-[#121214] w-full relative overflow-hidden shrink-0">
          <div 
            className="h-full bg-indigo-500 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(79,70,229,0.5)]"
            style={{ width: `${syncProgress}%` }}
          />
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative bg-[#080809] p-5 gap-5">
        {/* Calendar Section */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
           {/* Search Input Lowered */}
           <div className="relative group max-w-xl">
              <Plus className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-indigo-400 transition-colors" />
              <input 
                type="text"
                placeholder="Search orders, clients, locations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#121214] border border-white/5 rounded-xl py-3.5 pl-12 pr-4 text-[11px] text-white focus:outline-none focus:border-indigo-500/30 transition-all shadow-xl"
              />
           </div>

           <div className="flex-1 flex flex-col border border-white/5 rounded-2xl overflow-hidden bg-[#121214] shadow-2xl">
              <div className="grid grid-cols-7 w-full border-b border-white/5 bg-[#0D0D0E]">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                  <div key={d} className="p-3 text-center text-[10px] font-black uppercase tracking-[0.2em] text-white/20">
                    {d}
                  </div>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0A0A0B]">
                 <div className="grid grid-cols-7 w-full shrink-0">
                   {(() => {
                      const start = view === 'month' ? startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }) : startOfWeek(currentDate, { weekStartsOn: 1 });
                      const end = view === 'month' ? endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }) : endOfWeek(currentDate, { weekStartsOn: 1 });
                      const daysArr = [];
                      let d = start;
                      while (d <= end) {
                         const cloneDay = d;
                         const dayEvents = filteredEvents.filter(e => isSameDay(parseISO(e.date), cloneDay));
                         const isToday = isSameDay(cloneDay, new Date());
                         const isCurrentMonth = isSameMonth(cloneDay, currentDate);
                         const isSelected = isSameDay(cloneDay, selectedDate);
                          daysArr.push(
                          <div
                            key={cloneDay.toString()}
                            onClick={() => setSelectedDate(cloneDay)}
                            className={`min-h-[100px] border border-white/5 p-1 flex flex-col transition-all cursor-pointer relative group ${
                              !isCurrentMonth && view === 'month' ? "opacity-10 bg-black" : "opacity-100 bg-[#121214]"
                            } ${isSelected ? 'bg-indigo-500/[0.05] ring-1 ring-inset ring-indigo-500/20' : ''} hover:bg-white/[0.02]`}
                          >
                            <div className="flex justify-between items-start mb-1 h-6">
                               <span className={`text-[10px] font-mono leading-none flex items-center justify-center p-1.5 min-w-[20px] rounded ${
                                 isToday 
                                  ? "bg-indigo-600 text-white font-black shadow-lg shadow-indigo-500/40" 
                                  : isSelected ? "text-indigo-400 font-black" : "text-white/20"
                               }`}>
                                 {format(cloneDay, 'd')}
                               </span>
                            </div>
                            
                            <div className="space-y-0.5 px-1 overflow-y-auto custom-scrollbar-thin">
                              {dayEvents.slice(0, 4).map(evt => {
                                 const config = getStatusConfig(evt.isArchived ? 'Archived' : evt.status);
                                 return (
                                   <div 
                                     key={evt.id} 
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       setSelectedEventId(evt.id);
                                     }}
                                     className={`relative border rounded px-1.5 py-1 transition-all cursor-pointer ${config.bg} ${config.text} ${config.border} hover:scale-[1.02] shadow-sm`}
                                   >
                                      <div className="text-[9px] font-black truncate uppercase tracking-tight leading-none">
                                        {evt.location || evt.title}
                                      </div>
                                   </div>
                                 );
                              })}
                              {dayEvents.length > 4 && (
                                <div className="text-[8px] text-white/20 pl-1 font-black uppercase tracking-widest pt-1">
                                   + {dayEvents.length - 4} More
                                </div>
                              )}
                            </div>
                          </div>
                         );
                         d = addDays(d, 1);
                      }
                      return daysArr;
                   })()}
                 </div>
              </div>
           </div>
        </div>

        {/* Sidebar: Shoots on Date */}
        <div className="w-full md:w-80 shrink-0 flex flex-col gap-5">
           <div className="bg-[#121214] border border-white/5 rounded-2xl p-5 flex-1 flex flex-col overflow-hidden shadow-2xl relative">
              <div className="flex items-center justify-between mb-4">
                 <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 truncate pr-2">
                    {isSameDay(selectedDate, new Date()) ? 'TODAY\'S AGENDA' : format(selectedDate, 'MMM do, yyyy')}
                 </h2>
                 <div className="w-12 h-px bg-white/10 shrink-0" />
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1">
                 {filteredEvents.filter(e => isSameDay(parseISO(e.date), selectedDate)).length > 0 ? (
                    filteredEvents
                       .filter(e => isSameDay(parseISO(e.date), selectedDate))
                       .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime())
                       .map(evt => {
                          const config = getStatusConfig(evt.isArchived ? 'Archived' : evt.status);
                          return (
                             <div 
                               key={`side-${evt.id}`} 
                               onClick={() => setSelectedEventId(evt.id)}
                               className={`p-3 bg-white/[0.02] border rounded-xl transition-all cursor-pointer group hover:bg-[#1A1A1C] relative overflow-hidden ${config.border}`}
                             >
                                <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500/[0.03] blur-xl rounded-full -mr-8 -mt-8" />
                                <div className="flex justify-between items-start mb-3 relative">
                                   <div className="text-[9px] font-mono text-white/30 uppercase">{format(parseISO(evt.date), 'HH:mm')}</div>
                                   <div className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-wider ${config.bg} ${config.text}`}>
                                      {config.label}
                                   </div>
                                </div>
                                <div className="text-[10px] font-black text-white uppercase tracking-tight truncate mb-1">
                                  {evt.location || evt.title}
                                </div>
                                <div className="text-[9px] text-white/20 uppercase tracking-widest flex items-center gap-1.5">
                                   <div className={`w-1 h-1 rounded-full ${config.dot}`} />
                                   {evt.clientName || 'Private Client'}
                                </div>
                             </div>
                          );
                       })
                 ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                       <div className="w-12 h-12 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center">
                          <Calendar className="w-5 h-5 text-white/10" />
                       </div>
                       <div className="space-y-1">
                          <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">No Sessions</p>
                          <p className="text-[8px] text-white/10 leading-relaxed uppercase tracking-tighter">Day is clear</p>
                       </div>
                    </div>
                 )}
              </div>
           </div>

           <div className="bg-[#121214] border border-white/5 rounded-2xl p-5 shadow-lg group">
              <div className="flex items-center gap-3 mb-4">
                 <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/20 group-hover:scale-110 transition-transform">
                    <Video className="w-4 h-4 text-white" />
                 </div>
                 <div className="space-y-0.5">
                    <div className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">OPERATIONAL LOAD</div>
                    <div className="text-[10px] font-bold text-white uppercase tracking-tight">System Status</div>
                 </div>
              </div>
              <div className="flex gap-2 items-center">
                 <div className="flex-1 h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                    <motion.div 
                       initial={{ width: 0 }}
                       animate={{ width: '65%' }}
                       className="h-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" 
                    />
                 </div>
                 <div className="text-[9px] font-mono text-indigo-400 font-bold">65%</div>
              </div>
           </div>
        </div>
      </div>

          {/* NOTION STYLE POPUP MODAL */}
          <AnimatePresence>
            {selectedEvent && (
               <div className="absolute inset-0 z-[2000] flex items-center justify-center p-4 md:p-8 overflow-hidden pointer-events-none">
              {/* Backdrop */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-auto"
                onClick={() => setSelectedEventId(null)}
              />
              
              {/* Modal Container */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 10 }}
                className="relative w-full max-w-6xl h-full max-h-[92vh] bg-[#0A0A0B] border border-white/5 rounded-2xl shadow-[0_40px_100px_rgba(0,0,0,1)] flex flex-col overflow-hidden pointer-events-auto"
              >
                 {/* Modal Header */}
                 <div className="px-8 py-5 bg-[#0D0D0E]/90 border-b border-white/5 relative shrink-0">
                    <div className="absolute top-5 right-8 flex items-center gap-2">
                       <button 
                         onClick={() => handleUpdateOrder(selectedEvent.id, { isArchived: !selectedEvent.isArchived })}
                         className={`p-1.5 rounded-lg transition-all ${
                            selectedEvent.isArchived 
                              ? 'bg-amber-500/20 text-amber-500' 
                              : 'text-white/20 hover:text-white hover:bg-white/5'
                         }`}
                         title={selectedEvent.isArchived ? "Unarchive" : "Archive"}
                       >
                          <Archive className="w-5 h-5" />
                       </button>
                       <button 
                         onClick={() => setSelectedEventId(null)}
                         className="p-1.5 text-white/20 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                       >
                          <Plus className="w-5 h-5 rotate-45" />
                       </button>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                       <div className="flex items-center gap-5">
                          <div className={`w-10 h-10 rounded-xl ${getStatusConfig(selectedEvent.isArchived ? 'Archived' : selectedEvent.status).bg} border ${getStatusConfig(selectedEvent.isArchived ? 'Archived' : selectedEvent.status).border} flex items-center justify-center shadow-lg`}>
                             <Calendar className={`w-5 h-5 ${getStatusConfig(selectedEvent.isArchived ? 'Archived' : selectedEvent.status).text}`} />
                          </div>
                          <div className="space-y-0.5">
                             <div className={`text-[9px] font-mono uppercase tracking-[0.3em] ${getStatusConfig(selectedEvent.isArchived ? 'Archived' : selectedEvent.status).text} font-black opacity-60`}>
                                {selectedEvent.isArchived ? 'ARCHIVED SESSION' : (`${getStatusConfig(selectedEvent.status).label} / ORDER SUMMARY`)}
                             </div>
                             <h2 className="text-2xl font-black text-white uppercase tracking-tighter leading-tight max-w-2xl">
                                {selectedEvent.location || selectedEvent.title}
                             </h2>
                          </div>
                       </div>
                       
                       <div className="flex items-center gap-4">
                          <div className="flex flex-col items-end">
                             <div className="flex items-center gap-1.5 text-[10px] font-mono text-white/40">
                                <Clock className="w-3 h-3" />
                                {format(parseISO(selectedEvent.date), 'MMM do, yyyy @ HH:mm')}
                             </div>
                          </div>
                          <div className="h-8 w-px bg-white/10 mx-2" />
                          <div className="flex gap-2">
                             <a 
                                href={(() => {
                                   const oid = parseDescriptionSections(selectedEvent.description).orderId;
                                   return oid ? `https://app.fotello.co/dashboard/listings/${oid}` : "https://app.fotello.co/dashboard/listings";
                                })()}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded font-black text-[9px] uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                             >
                                <ExternalLink className="w-3 h-3" /> Fotello
                             </a>
                             <button 
                               className="px-4 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded font-black text-[9px] uppercase tracking-widest transition-all"
                               onClick={() => setShowProjectSelect({ eventId: selectedEvent.id, x: 0, y: 0 })}
                             >
                                Link
                             </button>
                             <button 
                               className="px-4 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded font-black text-[9px] uppercase tracking-widest transition-all"
                             >
                                Project
                             </button>
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* Modal Tabs */}
                 <div className="px-8 bg-[#0D0D0E]/60 border-b border-white/5 flex gap-6 shrink-0">
                    {[
                       { id: 'general', label: 'Order Info' },
                       { id: 'editing', label: 'In Production' },
                       { id: 'deliver', label: 'Delivery' }
                    ].map((tab) => (
                       <button
                         key={tab.id}
                         onClick={() => setActiveTab(tab.id as any)}
                         className={`py-3 text-[9px] uppercase font-black tracking-[0.3em] transition-all relative ${
                           activeTab === tab.id 
                             ? 'text-white' 
                             : 'text-white/20 hover:text-white/40'
                         }`}
                       >
                          {tab.label}
                          {activeTab === tab.id && (
                             <motion.div 
                                layoutId="activeTab"
                                className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500"
                             />
                          )}
                       </button>
                    ))}
                 </div>

                 {/* Modal Content */}
                 <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-[#080809]">
                    {activeTab === 'general' && (() => {
                       const parsed = parseDescriptionSections(selectedEvent.description);
                       return (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-500">
                           {/* Left Column: Client & Order Items */}
                           <div className="lg:col-span-4 space-y-6">
                              {/* Client Details Card */}
                              <div className="bg-[#121214] border border-white/5 rounded-xl p-5 relative overflow-hidden group">
                                 <h3 className="text-[9px] font-black uppercase text-white/30 tracking-[0.3em] mb-4 flex items-center gap-2">
                                    Client Details
                                 </h3>
                                 <div className="flex justify-between items-end border-b border-white/5 pb-2 mb-4">
                                    <div className="text-[9px] uppercase font-bold text-white/20 tracking-wider">Order ID</div>
                                    <div className="text-[10px] font-mono text-indigo-400">{parsed.orderId || 'Unknown'}</div>
                                 </div>
                                 <div className="space-y-4 relative">
                                    <div className="flex justify-between items-end border-b border-white/5 pb-2">
                                       <div className="text-[9px] uppercase font-bold text-white/20 tracking-wider">Name</div>
                                       <div className="text-xs font-bold text-white tracking-tight">{selectedEvent.clientName || 'Unspecified'}</div>
                                    </div>
                                    <div className="flex justify-between items-end border-b border-white/5 pb-2">
                                       <div className="text-[9px] uppercase font-bold text-white/20 tracking-wider">Email</div>
                                       <div className="text-[10px] font-mono text-indigo-400 truncate max-w-[150px]">{selectedEvent.clientEmail || 'N/A'}</div>
                                    </div>
                                    <div className="flex justify-between items-end border-b border-white/5 pb-2">
                                       <div className="text-[9px] uppercase font-bold text-white/20 tracking-wider">Phone</div>
                                       <div className="text-xs font-mono text-white/60">{selectedEvent.clientPhone || 'N/A'}</div>
                                    </div>
                                 </div>
                              </div>

                              {/* Order Items Card */}
                              <div className="bg-[#121214] border border-white/5 rounded-xl p-5">
                                 <h3 className="text-[9px] font-black uppercase text-white/30 tracking-[0.3em] mb-4">
                                    Order Items
                                 </h3>
                                 <div className="space-y-1.5">
                                    {parsed.items.length > 0 ? parsed.items.map((item: string, i: number) => (
                                       <div key={i} className="flex items-center gap-2 bg-white/[0.02] border border-white/5 px-2.5 py-1.5 rounded transition-all">
                                          <div className="w-1 h-1 bg-emerald-500/40 rounded-full shrink-0" />
                                          <div className="text-[9px] font-bold text-white/70 uppercase tracking-tight truncate">{item}</div>
                                       </div>
                                    )) : (
                                       <div className="text-[9px] text-white/20 italic py-4">No items recorded.</div>
                                    )}
                                 </div>
                              </div>
                           </div>

                           {/* Central Column: Intake & Details */}
                           <div className="lg:col-span-8 space-y-6">
                              {/* Intake Details Card */}
                              <div className="bg-[#121214] border border-white/5 rounded-xl p-6 relative group/card overflow-hidden">
                                 <h3 className="text-[9px] font-black uppercase text-white/30 tracking-[0.3em] mb-6 flex items-center gap-2">
                                    Intake Answers
                                 </h3>
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 relative">
                                    {parsed.intake.length > 0 ? parsed.intake.map((pair: any, i: number) => (
                                       <div key={i} className="space-y-1.5">
                                          <div className="text-[8px] font-black text-white/25 uppercase tracking-widest leading-relaxed">
                                             {pair.q}
                                          </div>
                                          <div className="text-[10px] font-black text-white uppercase tracking-tight">
                                             {pair.a}
                                          </div>
                                       </div>
                                    )) : (
                                       <div className="col-span-2 text-[9px] text-white/20 italic py-8 border border-dashed border-white/5 rounded tracking-[0.2em] text-center">
                                          No intake details available
                                       </div>
                                    )}
                                 </div>
                              </div>

                              {/* Original Order Details */}
                              <div className="bg-[#121214] border border-white/5 rounded-xl p-6 relative overflow-hidden group/intel">
                                 <h3 className="text-[9px] font-black uppercase text-white/30 tracking-[0.3em] mb-4">
                                    Original Order Details
                                 </h3>
                                 <div className="h-[200px] overflow-y-auto custom-scrollbar p-4 bg-black/40 border border-white/5 rounded text-[10px] leading-relaxed text-white/40 font-mono shadow-inner group-hover/intel:border-white/10 transition-all">
                                    <div 
                                       dangerouslySetInnerHTML={{ 
                                          __html: selectedEvent.description 
                                             .replace(/<b>/g, '<span class="text-white font-bold">')
                                             .replace(/<\/b>/g, '</span>')
                                       }} 
                                    />
                                    <div className="mt-8 text-[8px] text-white/10 uppercase tracking-[0.4em] text-center italic border-t border-white/5 pt-4">End of order details</div>
                                 </div>
                              </div>
                           </div>
                        </div>
                       );
                    })()}

                    {activeTab === 'editing' && (
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-300">
                          <div className="space-y-6">
                             <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                   <label className="text-[8px] uppercase font-bold text-white/30 tracking-widest">Field Shooter</label>
                                   <select 
                                      value={selectedEvent.shooter || ''}
                                      onChange={(e) => handleUpdateOrder(selectedEvent.id, { shooter: e.target.value })}
                                      className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-[11px] text-white focus:border-indigo-500/50 outline-none transition-all"
                                   >
                                      <option value="">N/A</option>
                                      <option value="Kyle">Kyle</option>
                                      <option value="Jack">Jack</option>
                                   </select>
                                </div>
                                <div className="space-y-1.5">
                                   <label className="text-[8px] uppercase font-bold text-white/30 tracking-widest">Live Status</label>
                                   <select 
                                      value={selectedEvent.status || 'Draft'}
                                      onChange={(e) => handleUpdateOrder(selectedEvent.id, { status: e.target.value })}
                                      className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-[11px] text-white focus:border-indigo-500/50 outline-none transition-all"
                                   >
                                      <option value="Draft">Draft</option>
                                      <option value="Confirmed">Confirmed</option>
                                      <option value="Editing">Editing</option>
                                      <option value="Review">Review</option>
                                      <option value="Completed">Completed</option>
                                      <option value="Delivered">Delivered</option>
                                   </select>
                                </div>
                             </div>

                             <div className="space-y-1.5">
                                <label className="text-[8px] uppercase font-bold text-white/30 tracking-widest">Lead Editor</label>
                                <input 
                                   type="text" 
                                   placeholder="Assignment name..."
                                   value={selectedEvent.editor || ''}
                                   onChange={(e) => handleUpdateOrder(selectedEvent.id, { editor: e.target.value })}
                                   className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-[11px] text-white focus:border-indigo-500/50 outline-none transition-all"
                                />
                             </div>

                             <div className="space-y-4 pt-4">
                                <div className="space-y-1.5">
                                   <label className="text-[8px] uppercase font-bold text-white/30 tracking-widest">Ingest Source (Raw Link)</label>
                                   <input 
                                      type="url" 
                                      placeholder="Cloud storage URI"
                                      value={selectedEvent.uploadLink || ''}
                                      onChange={(e) => handleUpdateOrder(selectedEvent.id, { uploadLink: e.target.value })}
                                      className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-[11px] text-white focus:border-indigo-500/50 outline-none transition-all font-mono"
                                   />
                                </div>
                                <div className="space-y-1.5">
                                   <label className="text-[8px] uppercase font-bold text-white/30 tracking-widest">Final Master (Output Link)</label>
                                   <input 
                                      type="url" 
                                      placeholder="Deliverable URI"
                                      value={selectedEvent.finalLink || ''}
                                      onChange={(e) => handleUpdateOrder(selectedEvent.id, { finalLink: e.target.value })}
                                      className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-[11px] text-white focus:border-indigo-500/50 outline-none transition-all font-mono"
                                   />
                                </div>
                             </div>
                          </div>

                          <div className="space-y-6">
                             <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/5 rounded-lg">
                                <input 
                                   type="checkbox" 
                                   checked={selectedEvent.sentMailToEditor || false}
                                   onChange={(e) => handleUpdateOrder(selectedEvent.id, { sentMailToEditor: e.target.checked })}
                                   className="w-4 h-4 rounded bg-black/40 border-white/10 text-indigo-500 focus:ring-0"
                                />
                                <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Editor notification sent</span>
                             </div>

                             <div className="space-y-4">
                                <div className="space-y-1.5">
                                   <label className="text-[8px] uppercase font-bold text-white/30 tracking-widest">Music Architecture</label>
                                   <input 
                                      type="text" 
                                      placeholder="Ref link or track name"
                                      value={selectedEvent.music || ''}
                                      onChange={(e) => handleUpdateOrder(selectedEvent.id, { music: e.target.value })}
                                      className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-[11px] text-white focus:border-indigo-500/50 outline-none transition-all"
                                   />
                                </div>
                                <div className="space-y-1.5">
                                   <label className="text-[8px] uppercase font-bold text-white/30 tracking-widest">Execution Directives</label>
                                   <textarea 
                                      placeholder="Specific technical instructions..."
                                      value={selectedEvent.notes || ''}
                                      onChange={(e) => handleUpdateOrder(selectedEvent.id, { notes: e.target.value })}
                                      className="w-full h-32 bg-black/40 border border-white/10 rounded px-3 py-2 text-[11px] text-white focus:border-indigo-500/50 outline-none resize-none transition-all"
                                   />
                                </div>
                             </div>
                          </div>
                       </div>
                    )}

                    {activeTab === 'deliver' && (
                       <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-300">
                          <div className="space-y-4 bg-white/5 p-6 rounded-xl border border-white/5">
                             <div className="flex justify-between items-center">
                                <h3 className="text-xs font-bold text-white uppercase tracking-[0.2em]">Completion Vector</h3>
                                <span className="text-sm font-mono text-indigo-400 font-bold">{selectedEvent.progress || 0}%</span>
                             </div>
                             <div className="h-2.5 bg-black/40 rounded-full overflow-hidden border border-white/10 p-0.5">
                                <div 
                                   className="h-full bg-indigo-500 rounded-full transition-all duration-700 ease-out shadow-[0_0_20px_rgba(79,70,229,0.4)]"
                                   style={{ width: `${selectedEvent.progress || 0}%` }}
                                />
                             </div>
                          </div>

                          <div className="space-y-4">
                             <div className="flex items-center justify-between">
                                <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-[0.3em]">Integrity Checklist</h4>
                                <button 
                                  onClick={() => {
                                    const newTask = { id: uuidv4(), text: 'New Target', done: false };
                                    const newTasks = [...(selectedEvent.tasks || []), newTask];
                                    handleUpdateOrder(selectedEvent.id, { tasks: newTasks });
                                  }}
                                  className="text-[9px] uppercase font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                                >
                                   <Plus className="w-3 h-3 inline mr-1" /> Add Vector
                                </button>
                             </div>
                             
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {(selectedEvent.tasks && selectedEvent.tasks.length > 0 ? selectedEvent.tasks : defaultTasks).map((task: any) => (
                                   <div 
                                     key={task.id} 
                                     onClick={() => handleToggleTask(selectedEvent.id, task.id)}
                                     className={`flex items-center justify-between p-4 bg-white/2 border rounded-lg cursor-pointer transition-all ${task.done ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/5 hover:border-white/20'}`}
                                   >
                                      <div className="flex items-center gap-3">
                                         <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${task.done ? 'bg-emerald-500 border-emerald-500' : 'bg-black/40 border-white/20'}`}>
                                            {task.done && <Plus className="w-4 h-4 text-white rotate-45" style={{ transform: 'rotate(0deg)' }} />}
                                         </div>
                                         <span className={`text-[11px] font-bold tracking-tight uppercase ${task.done ? 'text-white/30 line-through' : 'text-white/80'}`}>
                                            {task.text}
                                         </span>
                                      </div>
                                   </div>
                                ))}
                             </div>
                          </div>

                          <div className="flex justify-center pt-8">
                             <div className="text-[9px] text-white/20 uppercase tracking-[0.4em] italic">End of delivery list</div>
                          </div>
                       </div>
                    )}
                 </div>

                  {/* Modal Footer */}
                  <div className="px-10 py-4 border-t border-white/5 bg-[#0D0D0E] flex items-center justify-between shrink-0">
                     <div className="flex-1 flex justify-center">
                        <button 
                          onClick={() => setIsUploadModalOpen(true)}
                          className={`flex items-center gap-3 px-8 py-2.5 rounded-lg font-black uppercase tracking-[0.2em] transition-all hover:scale-105 active:scale-95 group ${
                            selectedEvent.isUploaded 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                          }`}
                        >
                           <UploadCloud className={`w-4 h-4 ${!selectedEvent.isUploaded && 'group-hover:animate-bounce'}`} />
                           <span className="text-xs">{selectedEvent.isUploaded ? 'Already Uploaded' : 'Upload Raw'}</span>
                        </button>
                     </div>

                     <div className="flex items-center gap-6 absolute right-10">
                        {!isDriveLinked && (
                          <button 
                            onClick={() => {
                              localStorage.setItem('drive_linked', 'true');
                              setIsDriveLinked(true);
                            }}
                            className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400 hover:text-indigo-300 transition-all border border-indigo-500/20 px-3 py-1.5 rounded bg-indigo-500/5"
                          >
                             Link Storage
                          </button>
                        )}
                        <button 
                          onClick={() => setSelectedEventId(null)}
                          className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 hover:text-white transition-all"
                        >
                           Exit
                        </button>
                     </div>
                  </div>

                  {/* Upload Modal Overlay */}
                  <AnimatePresence>
                     {isUploadModalOpen && (
                        <div className="absolute inset-0 z-[3000] flex items-center justify-center p-8">
                           <motion.div 
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="absolute inset-0 bg-black/90 backdrop-blur-md"
                              onClick={() => setIsUploadModalOpen(false)}
                           />
                           <motion.div 
                              initial={{ opacity: 0, scale: 0.95, y: 20 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: 20 }}
                              className="relative w-full max-w-xl bg-[#121214] border border-white/10 rounded-2xl overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,1)]"
                           >
                              <div className="p-8 space-y-8">
                                 <div className="space-y-2">
                                    <h3 className="text-lg font-black text-white uppercase tracking-tighter">Prepare Ingest</h3>
                                    <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-white/40">Automated path generation for cloud storage</p>
                                 </div>
                                 
                                 <div className="space-y-4">
                                    <div className="p-4 bg-black/40 border border-white/5 rounded-xl space-y-3">
                                       <div className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Active Destination</div>
                                       <div className="font-mono text-[11px] text-white/60 leading-relaxed break-all">
                                          {generateStoragePath(selectedEvent)}
                                       </div>
                                    </div>

                                    <div className="space-y-4">
                                       <div className="h-40 border-2 border-dashed border-white/5 bg-white/[0.01] rounded-2xl flex flex-col items-center justify-center gap-4 transition-all hover:bg-white/[0.03] hover:border-indigo-500/30 cursor-pointer group">
                                          <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform">
                                             <Plus className="w-6 h-6" />
                                          </div>
                                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Drop Materials or Click to Select</span>
                                       </div>

                                       <div className="relative">
                                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20">
                                             <ExternalLink className="w-4 h-4" />
                                          </div>
                                          <input 
                                             type="text"
                                             placeholder="Or paste an existing cloud storage link..."
                                             className="w-full bg-black/60 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-xs text-white focus:border-indigo-500/50 transition-all outline-none"
                                             onChange={(e) => {
                                                if (e.target.value.length > 5) {
                                                   handleUpdateOrder(selectedEvent.id, { uploadLink: e.target.value });
                                                }
                                             }}
                                          />
                                       </div>
                                    </div>
                                 </div>

                                 <div className="flex gap-4">
                                    <button 
                                       onClick={() => {
                                          handleUpdateOrder(selectedEvent.id, { isUploaded: true });
                                          setIsUploadModalOpen(false);
                                       }}
                                       className="flex-1 bg-indigo-600 hover:bg-indigo-500 py-4 rounded-xl text-xs font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-indigo-500/20 transition-all active:scale-95"
                                    >
                                       Mark as Uploaded
                                    </button>
                                    <button 
                                       onClick={() => setIsUploadModalOpen(false)}
                                       className="px-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-white/40 transition-all"
                                    >
                                       Cancel
                                    </button>
                                 </div>
                              </div>
                           </motion.div>
                        </div>
                     )}
                  </AnimatePresence>
                </motion.div>
            </div>
         )}
         </AnimatePresence>
         
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
