import React, { useState, useMemo, useEffect, useRef } from 'react';
import { MapPin, Calendar, Clock, Users, Plus, X, Search, Filter, Loader2, MessageSquare, Send, Trash2, CalendarOff, Camera, LogIn, UserPlus, LogOut, UserCircle, Eye, EyeOff } from 'lucide-react';

// ИМПОРТЫ FIREBASE (Добавлен sendPasswordResetEmail)
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
  const [authMessage, setAuthMessage] = useState(''); // Для успешного сброса пароля
  const [showPassword, setShowPassword] = useState(false); // Глазик

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

  // Сжатие изображения для Firestore
  const compressImage = (file, isAvatar = false) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = isAvatar ? 150 : 400; // Жесткое сжатие для Firestore
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.5); // Качество 0.5
          resolve(compressedBase64);
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
    setAuthError('');
    setAuthMessage('');
    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') setAuthError('Эта почта уже занята');
      else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') setAuthError('Неверная почта или пароль');
      else if (error.code === 'auth/weak-password') setAuthError('Пароль слишком простой');
      else setAuthError(`Ошибка: ${error.message}`);
    }
  };

  const handleResetPassword = async () => {
    setAuthError('');
    setAuthMessage('');
    if (!email) {
      setAuthError('Введите вашу почту (Email) для сброса пароля.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setAuthMessage('Письмо для сброса пароля отправлено! Проверьте вашу почту. Не забудьте проверить папку спам.');
    } catch (error) {
      if (error.code === 'auth/user-not-found') setAuthError('Пользователь с такой почтой не найден.');
      else setAuthError(`Ошибка: ${error.message}`);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!userProfile.name.trim() || !user) return;
    setIsProfileSaving(true);
    try {
      await setDoc(doc(db, "users", user.uid), userProfile);
      setShowProfileModal(false);
      setIsFirstLogin(false);
    } catch (error) {
      alert("Ошибка сохранения: " + error.message);
    } finally {
      setIsProfileSaving(false);
    }
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
    } catch (error) {
      alert("Ошибка отправки: " + error.message);
    }
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
    }, (error) => {
      alert("Ошибка загрузки ленты: " + error.message);
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
        const matchesSearch = event.title?.toLowerCase().includes(query) || event.description?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      if (selectedCategory !== 'Все' && event.category !== selectedCategory) return false;
      if (filterCity) {
        const cityMatch = event.city?.toLowerCase().includes(filterCity.toLowerCase()) || event.location?.toLowerCase().includes(filterCity.toLowerCase());
        if (!cityMatch) return false;
      }
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
    if (!user || !newEvent.title || !newEvent.date || !newEvent.time || !newEvent.location) return;
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
    } catch (error) {
      alert(`Ошибка при сохранении: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleJoinEvent = async (event) => {
    if (!user || !event.docId || (event.maxAttendees && event.attendees >= event.maxAttendees)) return;
    const alreadyJoined = event.attendeesList?.some(a => a.id === user.uid);
    if (alreadyJoined) return;
    try {
      const eventRef = doc(db, 'events', event.docId);
      await updateDoc(eventRef, { 
        attendees: event.attendees + 1, 
        attendeesList: arrayUnion({ id: user.uid, name: userProfile.name || 'Участник', avatar: userProfile.avatar || '' }) 
      });
      if (selectedEvent && selectedEvent.docId === event.docId) {
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
      if (selectedEvent && selectedEvent.docId === event.docId) {
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

  // ЭКРАН ЗАГРУЗКИ
  if (isAuthLoading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-indigo-600" /></div>;
  }

  // ЭКРАН АВТОРИЗАЦИИ
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden">
          <div className="bg-indigo-600 p-8 text-center" style={{ paddingTop: 'max(env(safe-area-inset-top), 2rem)' }}>
            <h1 className="text-4xl font-extrabold text-white mb-2">MeetPoint</h1>
            <p className="text-indigo-100">Ваши люди, ваши правила</p>
          </div>
          <div className="p-8">
            <div className="flex gap-4 mb-8 border-b border-gray-100 pb-4">
              <button onClick={() => {setAuthMode('login'); setAuthError(''); setAuthMessage('');}} className={`flex-1 font-semibold text-lg transition-colors ${authMode === 'login' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>Вход</button>
              <button onClick={() => {setAuthMode('register'); setAuthError(''); setAuthMessage('');}} className={`flex-1 font-semibold text-lg transition-colors ${authMode === 'register' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>Регистрация</button>
            </div>
            
            <form onSubmit={handleAuth} className="space-y-5">
              {authError && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl text-center font-medium">{authError}</div>}
              {authMessage && <div className="p-3 bg-green-50 text-green-600 text-sm rounded-xl text-center font-medium">{authMessage}</div>}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="ваша@почта.com" />
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700">Пароль</label>
                  {authMode === 'login' && (
                    <button type="button" onClick={handleResetPassword} className="text-xs text-indigo-600 font-medium hover:underline">
                      Забыли пароль?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Минимум 6 символов" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}
                  </button>
                </div>
              </div>
              
              <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 active:scale-95 transition-all flex justify-center items-center gap-2">
                {authMode === 'login' ? <><LogIn className="w-5 h-5"/> Войти</> : <><UserPlus className="w-5 h-5"/> Создать аккаунт</>}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ГЛАВНЫЙ ЭКРАН
  return (
    <div className="min-h-screen bg-gray-50 text-slate-800 font-sans pb-10" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      
      {/* ШАПКА: style paddingTop для iOS */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm" style={{ paddingTop: 'max(env(safe-area-inset-top), 0.5rem)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between pb-2">
          <div className="flex items-center">
            <h1 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
              MeetPoint
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            <button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full text-sm font-medium transition-all shadow-sm active:scale-95">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Создать</span>
            </button>
            <button onClick={() => setShowProfileModal(true)} className="relative w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border-2 border-gray-200 hover:border-indigo-400 transition-colors">
              {userProfile.avatar ? (
                <img src={userProfile.avatar} className="w-full h-full object-cover" alt="Профиль" />
              ) : (
                <UserCircle className="w-6 h-6 text-gray-400" />
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* ВКЛАДКИ */}
        <div className="flex bg-gray-200/50 p-1 rounded-2xl mb-6 max-w-md mx-auto sm:mx-0 overflow-x-auto hide-scrollbar gap-1">
          <button onClick={() => setFeedTab('all')} className={`whitespace-nowrap flex-1 py-2 px-3 rounded-xl text-sm font-semibold transition-all ${feedTab === 'all' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>Все</button>
          <button onClick={() => setFeedTab('going')} className={`whitespace-nowrap flex-1 py-2 px-3 rounded-xl text-sm font-semibold transition-all ${feedTab === 'going' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>Я иду</button>
          <button onClick={() => setFeedTab('organized')} className={`whitespace-nowrap flex-1 py-2 px-3 rounded-xl text-sm font-semibold transition-all ${feedTab === 'organized' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>Организую</button>
        </div>

        {/* ПОИСК И ФИЛЬТРЫ */}
        <div className="mb-6">
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-5 w-5 text-gray-400" /></div>
              <input type="text" placeholder="Искать..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-2xl leading-5 bg-white focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" />
            </div>
            <button onClick={() => setShowFilters(!showFilters)} className={`p-3 rounded-2xl border transition-all shadow-sm ${showFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
              <Filter className="w-5 h-5" />
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 gap-3 mb-4 p-4 bg-white rounded-2xl shadow-sm border border-gray-100">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Город</label>
                <input type="text" placeholder="Все города" value={filterCity} onChange={(e) => setFilterCity(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Дата</label>
                <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
            </div>
          )}

          <div className="flex overflow-x-auto pb-2 hide-scrollbar gap-2">
            {CATEGORIES.map(category => (
              <button key={category} onClick={() => setSelectedCategory(category)} className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${selectedCategory === category ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* ЛЕНТА */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>
        ) : filteredEvents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredEvents.map(event => (
              <div key={event.docId} onClick={() => setSelectedEvent(event)} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-lg transition-all cursor-pointer group flex flex-col h-full relative">
                <div className="relative h-48 bg-gray-200 overflow-hidden">
                  <img src={event.image} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-indigo-700 shadow-sm">{event.category}</div>
                  {event.organizerId === user?.uid && <div className="absolute top-3 right-3 bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">Моё</div>}
                </div>
                
                <div className="p-5 flex flex-col flex-grow">
                  <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2 leading-tight">{event.title}</h3>
                  <div className="space-y-2 mb-4 flex-grow">
                    <div className="flex items-center text-sm text-gray-600"><Calendar className="w-4 h-4 mr-2 text-indigo-400" /> <span className="font-medium">{event.date} • {event.time}</span></div>
                    <div className="flex items-start text-sm text-gray-600"><MapPin className="w-4 h-4 mr-2 text-red-400 shrink-0 mt-0.5" /> <span className="line-clamp-2">{event.city ? `${event.city}, ` : ''}{event.location}</span></div>
                  </div>
                  <div className="pt-4 border-t border-gray-100 flex items-center justify-between mt-auto">
                    <div className="flex items-center text-sm font-medium text-gray-700"><Users className="w-4 h-4 mr-1.5 text-indigo-500" /> {event.attendees}{event.maxAttendees && `/${event.maxAttendees}`}</div>
                    <button onClick={(e) => { e.stopPropagation(); if (event.organizerId === user?.uid) return; event.attendeesList?.some(a => a.id === user?.uid) ? handleLeaveEvent(event) : handleJoinEvent(event); }} className={`px-4 py-1.5 rounded-full text-sm font-bold z-10 transition-colors ${event.organizerId === user?.uid ? 'bg-purple-50 text-purple-700' : event.attendeesList?.some(a => a.id === user?.uid) ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}>
                      {event.organizerId === user?.uid ? 'Орг' : event.attendeesList?.some(a => a.id === user?.uid) ? 'Не пойду' : 'Пойду'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-white rounded-3xl border border-gray-100 border-dashed">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4"><Search className="w-8 h-8 text-gray-300"/></div>
            <h3 className="text-lg font-bold text-gray-900">Ничего не найдено</h3>
            <p className="text-gray-500 mb-4 mt-2 max-w-sm mx-auto">По вашим фильтрам пока нет мероприятий.</p>
          </div>
        )}
      </main>

      {/* МОДАЛКА ПРОФИЛЯ */}
      {showProfileModal && (
        <div className="fixed inset-0 z-[60] bg-gray-900/80 backdrop-blur-sm flex items-center justify-center p-4" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden flex flex-col max-h-full">
            <div className="px-6 py-4 border-b flex justify-between items-center shrink-0">
              <h3 className="text-xl font-bold">{isFirstLogin ? 'Добро пожаловать!' : 'Ваш Профиль'}</h3>
              {!isFirstLogin && <button onClick={() => setShowProfileModal(false)} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-5 h-5" /></button>}
            </div>

            <form id="profileForm" onSubmit={handleSaveProfile} className="p-6 overflow-y-auto space-y-4">
              <div className="flex flex-col items-center mb-4">
                <div className="relative w-28 h-28 bg-gray-50 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden group cursor-pointer">
                  {userProfile.avatar ? (
                    <img src={userProfile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-8 h-8 text-gray-400" />
                  )}
                  <input type="file" accept="image/*" onChange={handleAvatarChange} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                </div>
                <span className="text-xs text-gray-400 mt-2 font-medium">Сменить фото</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Имя и Фамилия *</label>
                <input required type="text" value={userProfile.name} onChange={e => setUserProfile({...userProfile, name: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Иван Иванов" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ваш город</label>
                <input type="text" value={userProfile.city} onChange={e => setUserProfile({...userProfile, city: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Москва" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">О себе и интересы</label>
                <textarea value={userProfile.interests} onChange={e => setUserProfile({...userProfile, interests: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" rows="3"></textarea>
              </div>
            </form>

            <div className="p-4 border-t bg-white shrink-0 flex flex-col gap-3 pb-8">
              <button type="submit" form="profileForm" disabled={isProfileSaving} className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 disabled:bg-indigo-400">
                {isProfileSaving ? 'Сохранение...' : 'Сохранить изменения'}
              </button>
              {!isFirstLogin && (
                <button onClick={handleLogout} className="w-full bg-red-50 text-red-600 font-bold py-3.5 rounded-xl hover:bg-red-100 flex items-center justify-center gap-2">
                  <LogOut className="w-5 h-5" /> Выйти из аккаунта
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* МОДАЛКА СОЗДАНИЯ */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[50] overflow-y-auto bg-gray-900/80 backdrop-blur-sm p-4 flex items-center justify-center" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden flex flex-col max-h-full">
            <div className="px-6 py-4 border-b flex justify-between items-center shrink-0">
              <h3 className="text-xl font-bold">Новое мероприятие</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            
            <form id="createEventForm" onSubmit={handleCreateEvent} className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Обложка</label>
                <div className="relative w-full h-40 bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center overflow-hidden">
                  {imagePreview ? <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" /> : <div className="text-center text-gray-500"><Camera className="w-8 h-8 mx-auto mb-2 text-indigo-400" /><span className="text-sm font-medium">Сделать фото</span></div>}
                  <input type="file" accept="image/*" onChange={handleEventImageChange} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                </div>
              </div>
              <div><label className="block text-sm text-gray-700 mb-1">Название *</label><input required type="text" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" /></div>
              <div><label className="block text-sm text-gray-700 mb-1">Описание</label><textarea value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" rows="2"></textarea></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm text-gray-700 mb-1">Город *</label><input required type="text" value={newEvent.city} onChange={e => setNewEvent({...newEvent, city: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                <div><label className="block text-sm text-gray-700 mb-1">Адрес *</label><input required type="text" value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm text-gray-700 mb-1">Дата *</label><input required type="date" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                <div><label className="block text-sm text-gray-700 mb-1">Время *</label><input required type="time" value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm text-gray-700 mb-1">Категория</label><select value={newEvent.category} onChange={e => setNewEvent({...newEvent, category: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500">{CATEGORIES.filter(c => c !== 'Все').map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div>
                <div><label className="block text-sm text-gray-700 mb-1">Лимит людей</label><input type="number" value={newEvent.maxAttendees} onChange={e => setNewEvent({...newEvent, maxAttendees: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Без лимита" /></div>
              </div>
            </form>

            <div className="p-4 border-t bg-white shrink-0 pb-8">
              <button type="submit" form="createEventForm" disabled={isUploading} className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 disabled:bg-indigo-400">
                {isUploading ? 'Создание...' : 'Опубликовать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ДЕТАЛИ И ЧАТ */}
      {selectedEvent && (
        <div className="fixed inset-0 z-[50] bg-gray-900/90 backdrop-blur-sm p-0 sm:p-4 flex items-end sm:items-center justify-center">
          <div className="bg-white sm:rounded-3xl w-full max-w-2xl flex flex-col h-[95vh] sm:h-auto sm:max-h-[90vh] overflow-hidden" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <div className="relative h-64 shrink-0">
              <img src={selectedEvent.image} className="w-full h-full object-cover" alt="Обложка" />
              <button onClick={() => { setSelectedEvent(null); setActiveTab('info'); }} className="absolute top-4 right-4 bg-black/50 backdrop-blur-md text-white p-2.5 rounded-full hover:bg-black/70 transition-colors"><X className="w-5 h-5" /></button>
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-6 pt-20">
                <span className="px-3 py-1 bg-indigo-500 text-white text-xs font-bold rounded-full mb-3 inline-block shadow-sm">{selectedEvent.category}</span>
                <h2 className="text-3xl font-extrabold text-white leading-tight">{selectedEvent.title}</h2>
              </div>
            </div>

            <div className="flex border-b px-6 shrink-0 bg-white">
              <button onClick={() => setActiveTab('info')} className={`py-4 mr-6 font-semibold border-b-2 transition-colors ${activeTab === 'info' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>Информация</button>
              <button onClick={() => setActiveTab('chat')} className={`py-4 font-semibold border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'chat' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}><MessageSquare className="w-4 h-4" /> Чат</button>
            </div>

            <div className="overflow-y-auto flex-1 bg-gray-50">
              {activeTab === 'info' ? (
                <div className="p-6 bg-white pb-20">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                    <div className="flex gap-3 items-center"><div className="bg-indigo-50 p-2.5 rounded-2xl"><Calendar className="w-5 h-5 text-indigo-600" /></div><div><p className="font-bold text-gray-900">{selectedEvent.date}</p><p className="text-sm text-gray-500">{selectedEvent.time}</p></div></div>
                    <div className="flex gap-3 items-center"><div className="bg-red-50 p-2.5 rounded-2xl"><MapPin className="w-5 h-5 text-red-500" /></div><div><p className="font-bold text-gray-900">{selectedEvent.city}</p><p className="text-sm text-gray-500">{selectedEvent.location}</p></div></div>
                    <div className="flex gap-3 items-center"><div className="bg-emerald-50 p-2.5 rounded-2xl"><Users className="w-5 h-5 text-emerald-600" /></div><div><p className="font-bold text-gray-900">{selectedEvent.attendees} {selectedEvent.maxAttendees && `из ${selectedEvent.maxAttendees}`}</p><p className="text-sm text-gray-500">участников</p></div></div>
                  </div>
                  <div className="mb-8"><h4 className="text-lg font-bold mb-3">Описание</h4><p className="text-gray-600 whitespace-pre-wrap">{selectedEvent.description || 'Организатор не оставил описание.'}</p></div>
                  <div className="border-t pt-6"><h4 className="text-lg font-bold mb-4">Участники <span className="bg-gray-100 px-3 py-1 rounded-full text-sm">{selectedEvent.attendeesList?.length}</span></h4>
                    <div className="flex flex-wrap gap-3">
                      {selectedEvent.attendeesList?.map(attendee => (
                        <div key={attendee.id} className="flex items-center gap-2 bg-gray-50 pr-4 pl-1.5 py-1.5 rounded-full border border-gray-200">
                          {attendee.avatar ? <img src={attendee.avatar} className="w-8 h-8 rounded-full object-cover" alt="av" /> : <UserCircle className="w-8 h-8 text-gray-400" />}
                          <span className="text-sm font-bold text-gray-700">{attendee.name}</span>
                          {attendee.id === selectedEvent.organizerId && <span className="text-[10px] uppercase font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full ml-1">Орг</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col h-full min-h-[400px]">
                  {!isParticipant ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                      <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-4"><MessageSquare className="w-10 h-10 text-indigo-300" /></div>
                      <h3 className="text-xl font-bold mb-2">Приватный чат</h3><p className="text-gray-500 mb-6">Доступно только участникам. Присоединяйтесь!</p>
                      <button onClick={() => handleJoinEvent(selectedEvent)} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold">Присоединиться</button>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 p-4 space-y-4 overflow-y-auto pb-10">
                        {messages.map(msg => (
                          <div key={msg.id} className={`flex flex-col ${msg.userId === user?.uid ? 'items-end' : 'items-start'}`}>
                            <div className="flex items-center gap-2 mb-1 px-1">{msg.userId !== user?.uid && msg.userAvatar && <img src={msg.userAvatar} className="w-5 h-5 rounded-full" alt="av" />}<span className="text-[11px] font-medium text-gray-500">{msg.userName}</span></div>
                            <div className={`px-4 py-2.5 rounded-2xl max-w-[85%] text-[15px] ${msg.userId === user?.uid ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm'}`}>{msg.text}</div>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </div>
                      <form onSubmit={handleSendMessage} className="p-4 bg-white border-t flex gap-2 shrink-0" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)' }}>
                        <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Сообщение..." className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-full outline-none focus:ring-2 focus:ring-indigo-500" />
                        <button type="submit" disabled={!newMessage.trim()} className="bg-indigo-600 text-white w-12 h-12 flex items-center justify-center rounded-full disabled:bg-indigo-300"><Send className="w-5 h-5 ml-1" /></button>
                      </form>
                    </>
                  )}
                </div>
              )}
            </div>

            {activeTab === 'info' && (
              <div className="p-4 sm:p-5 bg-white border-t flex justify-between items-center shrink-0" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)' }}>
                <span className="text-sm font-medium text-gray-500 hidden sm:block">{selectedEvent.organizerId === user?.uid ? 'Вы организатор' : isParticipant ? 'Вы идете на событие' : 'Есть места'}</span>
                {selectedEvent.organizerId === user?.uid ? (
                  showDeleteConfirm ? (
                    <div className="flex gap-2 w-full sm:w-auto"><button onClick={() => handleDeleteEvent(selectedEvent)} className="flex-1 px-6 py-3 bg-red-600 text-white font-bold rounded-xl">Удалить</button><button onClick={() => setShowDeleteConfirm(false)} className="flex-1 px-6 py-3 bg-gray-100 font-bold rounded-xl">Отмена</button></div>
                  ) : (<button onClick={() => setShowDeleteConfirm(true)} className="w-full sm:w-auto px-6 py-3.5 bg-red-50 text-red-600 font-bold rounded-xl flex items-center justify-center gap-2"><Trash2 className="w-5 h-5"/> Отменить</button>)
                ) : isParticipant ? (
                  <button onClick={() => handleLeaveEvent(selectedEvent)} className="w-full sm:w-auto px-8 py-3.5 bg-gray-100 text-gray-700 font-bold rounded-xl flex items-center justify-center gap-2"><CalendarOff className="w-5 h-5"/> Не пойду</button>
                ) : (
                  <button onClick={() => handleJoinEvent(selectedEvent)} disabled={selectedEvent.maxAttendees && selectedEvent.attendees >= selectedEvent.maxAttendees} className="w-full sm:w-auto px-10 py-3.5 bg-indigo-600 text-white font-bold rounded-xl disabled:bg-gray-300">Присоединиться</button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}