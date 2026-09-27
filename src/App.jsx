import React, { useState, useMemo, useEffect, useRef } from 'react';
import { MapPin, Calendar, Clock, Users, Plus, X, Search, Filter, Loader2, MessageSquare, Send, Trash2, CalendarOff, Camera, LogIn, UserPlus, LogOut, UserCircle, Eye, EyeOff, ChevronLeft, Compass, Ticket, Crown } from 'lucide-react';

// ИМПОРТЫ FIREBASE
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, collection, addDoc, updateDoc, arrayUnion, arrayRemove, deleteDoc, setDoc, getDoc } from 'firebase/firestore';

// ==========================================
// 🚨 ВСТАВЬТЕ СВОИ КЛЮЧИ FIREBASE СЮДА
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyAM1bfODGs8qCRfYxy906cuct0955Juda8",
  authDomain: "meet-point-73afa.firebaseapp.com",
  projectId: "meet-point-73afa",
  storageBucket: "meet-point-73afa.firebasestorage.app",
  messagingSenderId: "975617549003",
  appId: "1:975617549003:web:e0e2f7233c6fca0e26314e"
};
// ==========================================

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const CATEGORIES = ['Все', 'Настольные игры', 'Кино', 'Спорт', 'Еда и напитки', 'Искусство', 'Музыка', 'Образование', 'Другое'];

export default function App() {
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  const [authMode, setAuthMode] = useState('login'); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [userProfile, setUserProfile] = useState({ name: '', city: '', interests: '', avatar: '' });
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [isProfileSaving, setIsProfileSaving] = useState(false);

  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [feedTab, setFeedTab] = useState('all'); // 'all', 'going', 'organized'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Все');
  const [showFilters, setShowFilters] = useState(false);
  const [filterCity, setFilterCity] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [activeTab, setActiveTab] = useState('info'); 
  const messagesEndRef = useRef(null);

  const [newEvent, setNewEvent] = useState({ title: '', description: '', city: '', date: '', time: '', location: '', category: 'Другое', maxAttendees: '' });
  const [imagePreview, setImagePreview] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // === БЛОКИРОВКА ПРОКРУТКИ ФОНА ===
  useEffect(() => {
    if (showProfileModal || isCreateModalOpen || selectedEvent) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [showProfileModal, isCreateModalOpen, selectedEvent]);

  const compressImage = (file, isAvatar = false) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = isAvatar ? 150 : 400;
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.5));
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const docRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserProfile(docSnap.data());
          if (docSnap.data().city) setNewEvent(prev => ({...prev, city: docSnap.data().city}));
        } else {
          setIsFirstLogin(true);
          setShowProfileModal(true);
        }
      } else {
        setUserProfile({ name: '', city: '', interests: '', avatar: '' });
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError(''); setAuthMessage('');
    try {
      if (authMode === 'login') await signInWithEmailAndPassword(auth, email, password);
      else await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') setAuthError('Эта почта уже занята');
      else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') setAuthError('Неверная почта или пароль');
      else if (error.code === 'auth/weak-password') setAuthError('Пароль слишком простой');
      else setAuthError(`Ошибка: ${error.message}`);
    }
  };

  const handleResetPassword = async () => {
    setAuthError(''); setAuthMessage('');
    if (!email) { setAuthError('Введите почту (Email) для сброса.'); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      setAuthMessage('Письмо отправлено! Проверьте почту.');
    } catch (error) {
      if (error.code === 'auth/user-not-found') setAuthError('Пользователь не найден.');
      else setAuthError(`Ошибка: ${error.message}`);
    }
  };

  const handleLogout = async () => await signOut(auth);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!userProfile.name.trim() || !user) return;
    setIsProfileSaving(true);
    try {
      await setDoc(doc(db, "users", user.uid), userProfile);
      setShowProfileModal(false);
      setIsFirstLogin(false);
    } catch (error) { alert("Ошибка сохранения: " + error.message); } 
    finally { setIsProfileSaving(false); }
  };

  const handleAvatarChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const base64 = await compressImage(e.target.files[0], true);
      setUserProfile({...userProfile, avatar: base64});
    }
  };

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    if (!user || !selectedEvent) { setMessages([]); return; }
    const messagesRef = collection(db, 'events', selectedEvent.docId, 'messages');
    const unsubscribe = onSnapshot(messagesRef, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      msgs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [user, selectedEvent]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !selectedEvent) return;
    try {
      const messagesRef = collection(db, 'events', selectedEvent.docId, 'messages');
      await addDoc(messagesRef, { text: newMessage.trim(), userId: user.uid, userName: userProfile.name || 'Гость', userAvatar: userProfile.avatar || '', createdAt: new Date().toISOString() });
      setNewMessage('');
    } catch (error) { alert("Ошибка отправки: " + error.message); }
  };

  useEffect(() => {
    if (!user) return;
    const eventsRef = collection(db, 'events');
    setIsLoading(true);
    const unsubscribe = onSnapshot(eventsRef, (snapshot) => {
      const eventsData = snapshot.docs.map(doc => ({ ...doc.data(), docId: doc.id }));
      eventsData.sort((a, b) => new Date(a.date) - new Date(b.date));
      setEvents(eventsData);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      if (feedTab === 'going') {
        const isParticipant = event.attendeesList?.some(a => a.id === user?.uid);
        const isOrganizer = event.organizerId === user?.uid;
        if (!isParticipant || isOrganizer) return false;
      }
      if (feedTab === 'organized') {
        const isOrganizer = event.organizerId === user?.uid;
        if (!isOrganizer) return false;
      }
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!(event.title?.toLowerCase().includes(query) || event.description?.toLowerCase().includes(query))) return false;
      }
      if (selectedCategory !== 'Все' && event.category !== selectedCategory) return false;
      if (filterCity && !(event.city?.toLowerCase().includes(filterCity.toLowerCase()) || event.location?.toLowerCase().includes(filterCity.toLowerCase()))) return false;
      if (filterDate && event.date !== filterDate) return false;
      return true;
    });
  }, [events, feedTab, searchQuery, selectedCategory, filterCity, filterDate, user]);

  const handleEventImageChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const base64 = await compressImage(e.target.files[0], false);
      setImagePreview(base64);
    }
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    if (!user || !newEvent.title || !newEvent.date || !newEvent.time || !newEvent.location || !newEvent.city) return;
    setIsUploading(true);
    const finalImageUrl = imagePreview || 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&q=80&w=600';
    try {
      const eventsRef = collection(db, 'events');
      await addDoc(eventsRef, {
        ...newEvent,
        attendees: 1, 
        attendeesList: [{ id: user.uid, name: userProfile.name || 'Организатор', avatar: userProfile.avatar || '' }], 
        maxAttendees: newEvent.maxAttendees ? parseInt(newEvent.maxAttendees) : null,
        image: finalImageUrl, 
        organizer: userProfile.name || 'Организатор',
        organizerId: user.uid,
        createdAt: new Date().toISOString()
      });
      setIsCreateModalOpen(false);
      setNewEvent({ title: '', description: '', city: userProfile.city || '', date: '', time: '', location: '', category: 'Другое', maxAttendees: '' });
      setImagePreview('');
    } catch (error) { alert(`Ошибка при сохранении: ${error.message}`); } 
    finally { setIsUploading(false); }
  };

  const handleJoinEvent = async (event) => {
    if (!user || !event.docId || (event.maxAttendees && event.attendees >= event.maxAttendees)) return;
    if (event.attendeesList?.some(a => a.id === user.uid)) return;
    try {
      const eventRef = doc(db, 'events', event.docId);
      await updateDoc(eventRef, { attendees: event.attendees + 1, attendeesList: arrayUnion({ id: user.uid, name: userProfile.name || 'Участник', avatar: userProfile.avatar || '' }) });
      if (selectedEvent?.docId === event.docId) {
        setSelectedEvent(prev => ({ ...prev, attendees: prev.attendees + 1, attendeesList: [...(prev.attendeesList || []), { id: user.uid, name: userProfile.name, avatar: userProfile.avatar }] }));
        setActiveTab('chat');
      }
    } catch (error) { alert("Ошибка присоединения: " + error.message); }
  };

  const isParticipant = useMemo(() => {
    if (!user || !selectedEvent) return false;
    return selectedEvent.attendeesList?.some(a => a.id === user.uid) || selectedEvent.organizerId === user.uid;
  }, [user, selectedEvent]);

  const handleLeaveEvent = async (event) => {
    if (!user || !event.docId || event.organizerId === user.uid) return; 
    const userToRemove = event.attendeesList?.find(a => a.id === user.uid);
    if (!userToRemove) return;
    try {
      const eventRef = doc(db, 'events', event.docId);
      await updateDoc(eventRef, { attendees: Math.max(0, event.attendees - 1), attendeesList: arrayRemove(userToRemove) });
      if (selectedEvent?.docId === event.docId) {
        setSelectedEvent(prev => ({ ...prev, attendees: Math.max(0, prev.attendees - 1), attendeesList: prev.attendeesList.filter(a => a.id !== user.uid) }));
      }
    } catch (error) { alert("Ошибка выхода: " + error.message); }
  };

  const handleDeleteEvent = async (event) => {
    if (!user || !event.docId || event.organizerId !== user.uid) return;
    try {
      const eventRef = doc(db, 'events', event.docId);
      await deleteDoc(eventRef); 
      setSelectedEvent(null);
      setShowDeleteConfirm(false);
    } catch (error) { alert("Ошибка удаления: " + error.message); }
  };

  if (isAuthLoading) {
    return <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-purple-50 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-orange-500" /></div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-purple-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden border border-gray-100">
          <div className="bg-gradient-to-r from-orange-500 to-purple-600 p-10 text-center" style={{ paddingTop: 'max(env(safe-area-inset-top), 2.5rem)' }}>
            <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tight">MeetPoint</h1>
            <p className="text-orange-100 font-medium text-lg">Ваши люди, ваши правила</p>
          </div>
          <div className="p-8">
            <div className="flex gap-4 mb-8 bg-gray-50 p-1.5 rounded-full">
              <button onClick={() => {setAuthMode('login'); setAuthError(''); setAuthMessage('');}} className={`flex-1 py-2.5 font-bold text-sm rounded-full transition-all ${authMode === 'login' ? 'bg-white shadow-sm text-purple-700' : 'text-gray-500 hover:text-gray-700'}`}>Вход</button>
              <button onClick={() => {setAuthMode('register'); setAuthError(''); setAuthMessage('');}} className={`flex-1 py-2.5 font-bold text-sm rounded-full transition-all ${authMode === 'register' ? 'bg-white shadow-sm text-purple-700' : 'text-gray-500 hover:text-gray-700'}`}>Регистрация</button>
            </div>
            <form onSubmit={handleAuth} className="space-y-5">
              {authError && <div className="p-4 bg-red-50 text-red-600 text-sm rounded-2xl text-center font-semibold border border-red-100">{authError}</div>}
              {authMessage && <div className="p-4 bg-green-50 text-green-600 text-sm rounded-2xl text-center font-semibold border border-green-100">{authMessage}</div>}
              <div><label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Email</label><input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-800" placeholder="ваша@почта.com" /></div>
              <div>
                <div className="flex justify-between items-center mb-1.5 ml-1 mr-1"><label className="block text-sm font-bold text-gray-700">Пароль</label>{authMode === 'login' && <button type="button" onClick={handleResetPassword} className="text-xs text-orange-500 font-bold hover:text-orange-600">Забыли?</button>}</div>
                <div className="relative"><input type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-5 pr-12 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-800" placeholder="Минимум 6 символов" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-3.5 text-gray-400 hover:text-purple-500 transition-colors">{showPassword ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}</button></div>
              </div>
              <button type="submit" className="w-full mt-6 bg-gradient-to-r from-orange-500 to-purple-600 text-white font-bold py-4 rounded-2xl hover:opacity-90 active:scale-[0.98] transition-all flex justify-center items-center gap-2 shadow-lg shadow-purple-200">{authMode === 'login' ? <><LogIn className="w-5 h-5"/> Войти в аккаунт</> : <><UserPlus className="w-5 h-5"/> Создать аккаунт</>}</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-purple-50 text-slate-800 font-sans pb-24">
      
      <header className="bg-white/70 backdrop-blur-lg border-b border-gray-100 sticky top-0 z-30 pt-[env(safe-area-inset-top)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between pb-2 mt-2">
          <h1 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-purple-600 tracking-tight">MeetPoint</h1>
          <div className="flex items-center gap-3">
            <button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-purple-600 text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95"><Plus className="w-4 h-4" /><span className="hidden sm:inline">Создать</span></button>
            <button onClick={() => setShowProfileModal(true)} className="relative w-10 h-10 rounded-full bg-white flex items-center justify-center overflow-hidden border-2 border-transparent hover:border-purple-300 shadow-sm transition-colors p-0.5">{userProfile.avatar ? <img src={userProfile.avatar} className="w-full h-full object-cover rounded-full" alt="Профиль" /> : <UserCircle className="w-full h-full text-gray-300" />}</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* ПОИСК И ФИЛЬТРЫ */}
        <div className="mb-8">
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Search className="h-5 w-5 text-gray-400" /></div>
              <input type="text" placeholder="Найти событие..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="block w-full pl-11 pr-4 py-3.5 bg-white border-none rounded-full font-medium focus:ring-2 focus:ring-purple-500 outline-none shadow-sm" />
            </div>
            <button onClick={() => setShowFilters(!showFilters)} className={`p-3.5 rounded-full transition-all shadow-sm flex items-center justify-center ${showFilters ? 'bg-purple-100 text-purple-600' : 'bg-white text-gray-500 hover:bg-gray-50'}`}><Filter className="w-5 h-5" /></button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 gap-4 mb-5 p-5 bg-white/80 backdrop-blur-md rounded-[24px] shadow-sm border border-white">
              <div><label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">Город</label><input type="text" placeholder="Любой город" value={filterCity} onChange={(e) => setFilterCity(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-purple-500 outline-none" /></div>
              <div><label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">Дата</label><input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-purple-500 outline-none text-gray-600" /></div>
            </div>
          )}

          <div className="flex overflow-x-auto pb-2 hide-scrollbar gap-2">
            {CATEGORIES.map(category => (
              <button key={category} onClick={() => setSelectedCategory(category)} className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-bold transition-all ${selectedCategory === category ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50 shadow-sm border border-gray-100'}`}>{category}</button>
            ))}
          </div>
        </div>

        {/* ЛЕНТА СОБЫТИЙ */}
        <h2 className="text-2xl font-extrabold text-gray-900 mb-5 pl-1">
          {feedTab === 'all' ? 'Все события' : feedTab === 'going' ? 'Вы идёте' : 'Ваши события'}
        </h2>
        
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-orange-500" /></div>
        ) : filteredEvents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredEvents.map(event => (
              <div key={event.docId} onClick={() => setSelectedEvent(event)} className="bg-white rounded-[2rem] p-2 shadow-sm hover:shadow-xl transition-all cursor-pointer group flex flex-col h-full border border-white/50">
                <div className="relative h-48 bg-gray-100 rounded-[1.5rem] overflow-hidden">
                  <img src={event.image} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
                  <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-bold text-purple-700 shadow-sm">{event.category}</div>
                  {event.organizerId === user?.uid && <div className="absolute top-3 right-3 bg-gradient-to-r from-orange-500 to-purple-500 text-white px-3.5 py-1.5 rounded-full text-xs font-bold shadow-sm">Моё</div>}
                </div>
                <div className="p-4 flex flex-col flex-grow">
                  <h3 className="text-xl font-extrabold text-gray-900 mb-3 line-clamp-2 leading-tight">{event.title}</h3>
                  <div className="space-y-2.5 mb-4 flex-grow">
                    <div className="flex items-center text-sm text-gray-600 font-medium"><Calendar className="w-4 h-4 mr-2.5 text-purple-400" /> <span>{event.date} • {event.time}</span></div>
                    <div className="flex items-start text-sm text-gray-600 font-medium"><MapPin className="w-4 h-4 mr-2.5 text-orange-400 shrink-0 mt-0.5" /> <span className="line-clamp-2">{event.city ? `${event.city}, ` : ''}{event.location}</span></div>
                  </div>
                  <div className="pt-4 border-t border-gray-50 flex items-center justify-between mt-auto">
                    <div className="flex items-center text-sm font-bold text-gray-500"><Users className="w-4 h-4 mr-1.5 text-gray-400" /> {event.attendees}{event.maxAttendees && `/${event.maxAttendees}`}</div>
                    <button onClick={(e) => { e.stopPropagation(); if (event.organizerId === user?.uid) return; event.attendeesList?.some(a => a.id === user?.uid) ? handleLeaveEvent(event) : handleJoinEvent(event); }} className={`px-5 py-2 rounded-full text-sm font-bold z-10 transition-colors ${event.organizerId === user?.uid ? 'bg-gray-100 text-gray-600' : event.attendeesList?.some(a => a.id === user?.uid) ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'}`}>{event.organizerId === user?.uid ? 'Орг' : event.attendeesList?.some(a => a.id === user?.uid) ? 'Не пойду' : 'Пойду'}</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-white/50 backdrop-blur-sm rounded-[3rem] border border-white">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-5 shadow-sm"><Search className="w-8 h-8 text-gray-300"/></div>
            <h3 className="text-xl font-extrabold text-gray-900">Событий не найдено</h3>
            <p className="text-gray-500 mb-4 mt-2 max-w-sm mx-auto font-medium">Попробуйте изменить параметры поиска или создайте свое мероприятие!</p>
          </div>
        )}
      </main>

      {/* НИЖНЯЯ ПАНЕЛЬ НАВИГАЦИИ (ТАББАР) */}
      {!selectedEvent && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-gray-100 z-40 pb-[max(env(safe-area-inset-bottom),0.5rem)] shadow-[0_-10px_40px_rgba(0,0,0,0.03)]">
          <div className="flex justify-around items-center h-16 max-w-md mx-auto px-2">
            
            <button onClick={() => setFeedTab('all')} className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all ${feedTab === 'all' ? 'text-purple-600' : 'text-gray-400 hover:text-gray-600'}`}>
              <div className={`p-1.5 rounded-xl transition-all ${feedTab === 'all' ? 'bg-purple-50' : ''}`}><Compass className="w-6 h-6" /></div>
              <span className="text-[10px] font-bold">Все</span>
            </button>
            
            <button onClick={() => setFeedTab('going')} className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all ${feedTab === 'going' ? 'text-orange-500' : 'text-gray-400 hover:text-gray-600'}`}>
              <div className={`p-1.5 rounded-xl transition-all ${feedTab === 'going' ? 'bg-orange-50' : ''}`}><Ticket className="w-6 h-6" /></div>
              <span className="text-[10px] font-bold">Я иду</span>
            </button>
            
            <button onClick={() => setFeedTab('organized')} className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all ${feedTab === 'organized' ? 'text-purple-600' : 'text-gray-400 hover:text-gray-600'}`}>
              <div className={`p-1.5 rounded-xl transition-all ${feedTab === 'organized' ? 'bg-purple-50' : ''}`}><Crown className="w-6 h-6" /></div>
              <span className="text-[10px] font-bold">Мои</span>
            </button>

          </div>
        </nav>
      )}

      {/* МОДАЛКА ПРОФИЛЯ */}
      {showProfileModal && (
        <div className="fixed inset-0 z-[100] bg-gray-900/40 backdrop-blur-md flex items-center justify-center p-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
          <div className="bg-white rounded-[32px] w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] shadow-2xl">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center shrink-0">
              <h3 className="text-xl font-extrabold">{isFirstLogin ? 'Настройка профиля' : 'Ваш Профиль'}</h3>
              {!isFirstLogin && <button onClick={() => setShowProfileModal(false)} className="p-2 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors"><X className="w-5 h-5 text-gray-600" /></button>}
            </div>
            <form id="profileForm" onSubmit={handleSaveProfile} className="p-6 overflow-y-auto space-y-5">
              <div className="flex flex-col items-center mb-2">
                <div className="relative w-28 h-28 bg-gray-50 rounded-full flex items-center justify-center overflow-hidden group cursor-pointer border-4 border-white shadow-md">{userProfile.avatar ? <img src={userProfile.avatar} alt="Avatar" className="w-full h-full object-cover" /> : <Camera className="w-8 h-8 text-gray-300" />}<input type="file" accept="image/*" onChange={handleAvatarChange} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" /></div>
                <span className="text-xs text-purple-600 mt-3 font-bold bg-purple-50 px-3 py-1 rounded-full">Сменить фото</span>
              </div>
              <div><label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Имя и Фамилия *</label><input required type="text" value={userProfile.name} onChange={e => setUserProfile({...userProfile, name: e.target.value})} className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none font-medium text-gray-800" placeholder="Как вас зовут?" /></div>
              <div><label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Ваш город</label><input type="text" value={userProfile.city} onChange={e => setUserProfile({...userProfile, city: e.target.value})} className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none font-medium text-gray-800" placeholder="Москва" /></div>
              <div><label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">О себе и интересы</label><textarea value={userProfile.interests} onChange={e => setUserProfile({...userProfile, interests: e.target.value})} className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none font-medium text-gray-800 resize-none" rows="3" placeholder="Расскажите немного о себе..."></textarea></div>
            </form>
            <div className="p-5 border-t border-gray-50 bg-white shrink-0 flex flex-col gap-3">
              <button type="submit" form="profileForm" disabled={isProfileSaving} className="w-full bg-gray-900 text-white font-bold py-4 rounded-2xl hover:bg-black transition-colors disabled:opacity-50">{isProfileSaving ? 'Сохранение...' : 'Сохранить изменения'}</button>
              {!isFirstLogin && <button onClick={handleLogout} className="w-full text-red-500 font-bold py-3 rounded-2xl hover:bg-red-50 flex items-center justify-center gap-2 transition-colors"><LogOut className="w-4 h-4" /> Выйти</button>}
            </div>
          </div>
        </div>
      )}

      {/* МОДАЛКА СОЗДАНИЯ */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-gray-900/40 backdrop-blur-md p-4 flex items-center justify-center pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
          <div className="bg-white rounded-[32px] w-full max-w-lg overflow-hidden flex flex-col max-h-[95vh] shadow-2xl">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center shrink-0">
              <h3 className="text-xl font-extrabold">Новое событие</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-2 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors"><X className="w-5 h-5 text-gray-600" /></button>
            </div>
            <form id="createEventForm" onSubmit={handleCreateEvent} className="p-6 overflow-y-auto space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">Обложка</label>
                <div className="relative w-full h-44 bg-gray-50 rounded-3xl flex flex-col items-center justify-center overflow-hidden border-2 border-dashed border-gray-200">{imagePreview ? <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" /> : <div className="text-center text-gray-400"><Camera className="w-8 h-8 mx-auto mb-2 text-purple-300" /><span className="text-sm font-bold">Добавить фото</span></div>}<input type="file" accept="image/*" onChange={handleEventImageChange} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" /></div>
              </div>
              <div><label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Название *</label><input required type="text" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-purple-500 font-medium" placeholder="Как назовем встречу?" /></div>
              <div><label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Описание</label><textarea value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})} className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-purple-500 font-medium resize-none" rows="2" placeholder="Кратко о главном..."></textarea></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Город *</label><input required type="text" value={newEvent.city} onChange={e => setNewEvent({...newEvent, city: e.target.value})} className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-purple-500 font-medium" /></div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Место *</label><input required type="text" value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})} className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-purple-500 font-medium" placeholder="Кафе, Парк..." /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Дата *</label><input required type="date" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} className="w-full px-4 py-3.5 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-purple-500 font-medium text-gray-600" /></div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Время *</label><input required type="time" value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} className="w-full px-4 py-3.5 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-purple-500 font-medium text-gray-600" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Категория</label><select value={newEvent.category} onChange={e => setNewEvent({...newEvent, category: e.target.value})} className="w-full px-4 py-3.5 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-purple-500 font-medium text-gray-800">{CATEGORIES.filter(c => c !== 'Все').map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Лимит людей</label><input type="number" value={newEvent.maxAttendees} onChange={e => setNewEvent({...newEvent, maxAttendees: e.target.value})} className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-purple-500 font-medium" placeholder="Без лимита" /></div>
              </div>
            </form>
            <div className="p-5 border-t border-gray-50 bg-white shrink-0">
              <button type="submit" form="createEventForm" disabled={isUploading} className="w-full bg-gradient-to-r from-orange-500 to-purple-600 text-white font-bold py-4 rounded-2xl shadow-md hover:shadow-lg disabled:opacity-50 transition-all">{isUploading ? 'Создание...' : 'Опубликовать событие'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ПОЛНОЭКРАННАЯ КАРТОЧКА СОБЫТИЯ */}
      {selectedEvent && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col h-[100dvh] overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
          <div className="relative h-[35vh] min-h-[250px] shrink-0 bg-gray-200">
            <img src={selectedEvent.image} className="w-full h-full object-cover" alt="Обложка" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
            <button onClick={() => { setSelectedEvent(null); setActiveTab('info'); }} className="absolute top-4 left-4 bg-white/20 backdrop-blur-md text-white p-3 rounded-full hover:bg-white/40 transition-colors z-10 mt-[env(safe-area-inset-top)]"><ChevronLeft className="w-6 h-6" /></button>
            <div className="absolute bottom-0 inset-x-0 p-6 pt-20"><span className="px-4 py-1.5 bg-white/20 backdrop-blur-md text-white text-xs font-bold rounded-full mb-3 inline-block shadow-sm border border-white/30">{selectedEvent.category}</span><h2 className="text-3xl font-extrabold text-white leading-tight drop-shadow-md">{selectedEvent.title}</h2></div>
          </div>
          <div className="flex px-6 shrink-0 bg-white border-b border-gray-100 shadow-sm relative z-10 rounded-t-3xl -mt-6">
            <button onClick={() => setActiveTab('info')} className={`py-5 mr-8 font-extrabold border-b-[3px] transition-colors ${activeTab === 'info' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-400'}`}>О событии</button>
            <button onClick={() => setActiveTab('chat')} className={`py-5 font-extrabold border-b-[3px] flex items-center gap-2 transition-colors ${activeTab === 'chat' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-400'}`}><MessageSquare className="w-5 h-5" /> Чат участников</button>
          </div>
          <div className="flex-1 overflow-y-auto bg-gray-50/50">
            {activeTab === 'info' ? (
              <div className="p-6 pb-24">
                <div className="grid grid-cols-1 gap-4 mb-8">
                  <div className="flex gap-4 items-center bg-white p-4 rounded-3xl shadow-sm border border-gray-50"><div className="bg-purple-50 p-3 rounded-2xl"><Calendar className="w-6 h-6 text-purple-500" /></div><div><p className="font-extrabold text-gray-900 text-lg">{selectedEvent.date}</p><p className="text-sm text-gray-500 font-medium">{selectedEvent.time}</p></div></div>
                  <div className="flex gap-4 items-center bg-white p-4 rounded-3xl shadow-sm border border-gray-50"><div className="bg-orange-50 p-3 rounded-2xl"><MapPin className="w-6 h-6 text-orange-500" /></div><div><p className="font-extrabold text-gray-900 text-lg">{selectedEvent.city}</p><p className="text-sm text-gray-500 font-medium">{selectedEvent.location}</p></div></div>
                  <div className="flex gap-4 items-center bg-white p-4 rounded-3xl shadow-sm border border-gray-50"><div className="bg-blue-50 p-3 rounded-2xl"><Users className="w-6 h-6 text-blue-500" /></div><div><p className="font-extrabold text-gray-900 text-lg">{selectedEvent.attendees} {selectedEvent.maxAttendees && `из ${selectedEvent.maxAttendees}`}</p><p className="text-sm text-gray-500 font-medium">идут на встречу</p></div></div>
                </div>
                <div className="mb-10 bg-white p-6 rounded-3xl shadow-sm border border-gray-50"><h4 className="text-lg font-extrabold mb-3 text-gray-900">Описание</h4><p className="text-gray-600 whitespace-pre-wrap leading-relaxed">{selectedEvent.description || 'Организатор не оставил описание, но точно будет круто!'}</p></div>
                <div>
                  <h4 className="text-lg font-extrabold mb-4 text-gray-900 flex items-center gap-2">Кто идет <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm">{selectedEvent.attendeesList?.length}</span></h4>
                  <div className="flex flex-wrap gap-3">
                    {selectedEvent.attendeesList?.map(attendee => (
                      <div key={attendee.id} className="flex items-center gap-3 bg-white pr-5 pl-2 py-2 rounded-full border border-gray-100 shadow-sm">{attendee.avatar ? <img src={attendee.avatar} className="w-10 h-10 rounded-full object-cover" alt="av" /> : <UserCircle className="w-10 h-10 text-gray-300" />}<span className="text-sm font-bold text-gray-800">{attendee.name}</span>{attendee.id === selectedEvent.organizerId && <span className="text-[10px] uppercase font-extrabold bg-gradient-to-r from-orange-400 to-purple-500 text-white px-2 py-1 rounded-full shadow-sm">Орг</span>}</div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full bg-white">
                {!isParticipant ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50/50"><div className="w-24 h-24 bg-gradient-to-br from-orange-100 to-purple-100 rounded-full flex items-center justify-center mb-6 shadow-sm"><MessageSquare className="w-10 h-10 text-purple-400" /></div><h3 className="text-2xl font-extrabold mb-3 text-gray-900">Приватный чат</h3><p className="text-gray-500 mb-8 font-medium">Общение доступно только для участников. Жмите кнопку внизу, чтобы присоединиться!</p></div>
                ) : (
                  <><div className="flex-1 p-5 space-y-6 overflow-y-auto pb-10">{messages.map(msg => (<div key={msg.id} className={`flex flex-col ${msg.userId === user?.uid ? 'items-end' : 'items-start'}`}><div className="flex items-center gap-2 mb-1.5 px-1">{msg.userId !== user?.uid && msg.userAvatar && <img src={msg.userAvatar} className="w-6 h-6 rounded-full object-cover shadow-sm" alt="av" />}<span className="text-[12px] font-bold text-gray-400">{msg.userName}</span></div><div className={`px-5 py-3.5 rounded-3xl max-w-[85%] text-[15px] font-medium leading-relaxed shadow-sm ${msg.userId === user?.uid ? 'bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>{msg.text}</div></div>))} <div ref={messagesEndRef} /></div><form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-100 flex gap-3 shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.03)] pb-[max(env(safe-area-inset-bottom),1rem)]"><input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Написать в чат..." className="flex-1 px-6 py-4 bg-gray-50 border-none rounded-full outline-none focus:ring-2 focus:ring-purple-500 font-medium" /><button type="submit" disabled={!newMessage.trim()} className="bg-gradient-to-r from-orange-500 to-purple-600 text-white w-14 h-14 flex items-center justify-center rounded-full disabled:opacity-50 shadow-md hover:shadow-lg transition-all"><Send className="w-5 h-5 ml-1" /></button></form></>
                )}
              </div>
            )}
          </div>
          {activeTab === 'info' && (
            <div className="p-4 sm:p-5 bg-white border-t border-gray-100 flex justify-between items-center shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.03)] pb-[max(env(safe-area-inset-bottom),1rem)]">
              {selectedEvent.organizerId === user?.uid ? (
                showDeleteConfirm ? (<div className="flex gap-3 w-full"><button onClick={() => handleDeleteEvent(selectedEvent)} className="flex-1 py-4 bg-red-500 text-white font-bold rounded-2xl shadow-sm hover:bg-red-600">Точно удалить</button><button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-4 bg-gray-100 text-gray-700 font-bold rounded-2xl hover:bg-gray-200">Отмена</button></div>) : (<button onClick={() => setShowDeleteConfirm(true)} className="w-full py-4 bg-red-50 text-red-500 font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"><Trash2 className="w-5 h-5"/> Удалить событие</button>)
              ) : isParticipant ? (
                <button onClick={() => handleLeaveEvent(selectedEvent)} className="w-full py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"><CalendarOff className="w-5 h-5"/> Отменить участие</button>
              ) : (
                <button onClick={() => handleJoinEvent(selectedEvent)} disabled={selectedEvent.maxAttendees && selectedEvent.attendees >= selectedEvent.maxAttendees} className="w-full py-4 bg-gradient-to-r from-orange-500 to-purple-600 text-white font-extrabold text-lg rounded-2xl shadow-lg hover:shadow-xl disabled:opacity-50 transition-all">Присоединиться</button>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}