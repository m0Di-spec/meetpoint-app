import React, { useState, useMemo, useEffect, useRef } from 'react';
import { MapPin, Calendar, Clock, Users, Plus, X, Search, Filter, Navigation, Loader2, MessageSquare, Send, Trash2, CalendarOff, Camera, LogIn, UserPlus, LogOut } from 'lucide-react';

// ИМПОРТЫ FIREBASE (Убрали Storage, оставили только Auth и Firestore)
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, updateProfile, signOut } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, collection, addDoc, updateDoc, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';

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
  
  // Состояния для экрана авторизации
  const [authMode, setAuthMode] = useState('login'); // 'login' или 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Остальные состояния
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Все');
  const [filterDate, setFilterDate] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const [userName, setUserName] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [activeTab, setActiveTab] = useState('info'); 
  const messagesEndRef = useRef(null);

  // Форма создания
  const [newEvent, setNewEvent] = useState({ title: '', description: '', date: '', time: '', location: '', category: 'Другое', maxAttendees: '' });
  
  // Фото (теперь храним сразу обработанную картинку)
  const [imagePreview, setImagePreview] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Следим за тем, вошел пользователь или нет
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
      if (currentUser) {
        if (currentUser.displayName) {
          setUserName(currentUser.displayName);
        } else {
          setShowProfileModal(true);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // АВТОРИЗАЦИЯ
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        setShowProfileModal(true);
      }
    } catch (error) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') setAuthError('Эта почта уже занята');
      else if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') setAuthError('Неверная почта или пароль');
      else if (error.code === 'auth/weak-password') setAuthError('Пароль слишком простой (минимум 6 символов)');
      else setAuthError('Произошла ошибка. Проверьте данные.');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Ошибка при выходе:", error);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!userName.trim() || !user) return;
    try {
      await updateProfile(user, { displayName: userName.trim() });
      setShowProfileModal(false);
    } catch (error) {
      console.error("Ошибка сохранения профиля:", error);
    }
  };

  // Чат и Мероприятия
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      await addDoc(messagesRef, { text: newMessage.trim(), userId: user.uid, userName: user.displayName || userName, createdAt: new Date().toISOString() });
      setNewMessage('');
    } catch (error) {
      console.error("Ошибка отправки сообщения:", error);
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
    });
    return () => unsubscribe();
  }, [user]);

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      const matchesSearch = event.title?.toLowerCase().includes(searchQuery.toLowerCase()) || event.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'Все' || event.category === selectedCategory;
      const matchesDate = filterDate === '' || event.date === filterDate;
      return matchesSearch && matchesCategory && matchesDate;
    });
  }, [events, searchQuery, selectedCategory, filterDate]);

  // МАГИЯ СЖАТИЯ ИЗОБРАЖЕНИЯ БЕЗ STORAGE
  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Создаем виртуальный холст для сжатия
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 600; // Уменьшаем ширину до 600px для экономии места в БД
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // Получаем легкий текстовый код картинки (jpeg, 70% качества)
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7); 
          setImagePreview(compressedBase64);
        };
        img.src = event.target.result;
      };
      
      reader.readAsDataURL(file);
    }
  };

  // Создание мероприятия
  const handleCreateEvent = async (e) => {
    e.preventDefault();
    if (!user || !newEvent.title || !newEvent.date || !newEvent.time || !newEvent.location) return;

    setIsUploading(true);
    
    // Если картинку не выбрали, ставим красивую стандартную обложку
    const finalImageUrl = imagePreview || 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&q=80&w=800';

    try {
      const eventsRef = collection(db, 'events');
      await addDoc(eventsRef, {
        ...newEvent,
        attendees: 1, 
        attendeesList: [{ id: user.uid, name: user.displayName || userName }], 
        maxAttendees: newEvent.maxAttendees ? parseInt(newEvent.maxAttendees) : null,
        image: finalImageUrl, // Сохраняем текстовый код картинки прямо в документ
        organizer: user.displayName || userName,
        organizerId: user.uid,
        createdAt: new Date().toISOString()
      });

      // Очищаем форму
      setIsCreateModalOpen(false);
      setNewEvent({ title: '', description: '', date: '', time: '', location: '', category: 'Другое', maxAttendees: '' });
      setImagePreview('');
    } catch (error) {
      console.error("Error creating event:", error);
      alert("Ошибка при создании мероприятия.");
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
      await updateDoc(eventRef, { attendees: event.attendees + 1, attendeesList: arrayUnion({ id: user.uid, name: user.displayName || userName }) });
      if (selectedEvent && selectedEvent.docId === event.docId) {
        setSelectedEvent(prev => ({ ...prev, attendees: prev.attendees + 1, attendeesList: [...(prev.attendeesList || []), { id: user.uid, name: user.displayName || userName }] }));
        setActiveTab('chat');
      }
    } catch (error) { console.error("Error joining event:", error); }
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
    } catch (error) { console.error("Error leaving event:", error); }
  };

  const handleDeleteEvent = async (event) => {
    if (!user || !event.docId || event.organizerId !== user.uid) return;
    try {
      const eventRef = doc(db, 'events', event.docId);
      await deleteDoc(eventRef); 
      setSelectedEvent(null);
      setShowDeleteConfirm(false);
    } catch (error) { console.error("Error deleting event:", error); }
  };

  // ЭКРАН ЗАГРУЗКИ
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  // ЭКРАН АВТОРИЗАЦИИ
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden">
          <div className="bg-indigo-600 p-8 text-center">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Navigation className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">MeetPoint</h1>
            <p className="text-indigo-100">Находите компанию для любых дел</p>
          </div>
          
          <div className="p-8">
            <div className="flex gap-4 mb-8 border-b border-gray-100 pb-4">
              <button onClick={() => {setAuthMode('login'); setAuthError('');}} className={`flex-1 font-semibold text-lg transition-colors ${authMode === 'login' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>Вход</button>
              <button onClick={() => {setAuthMode('register'); setAuthError('');}} className={`flex-1 font-semibold text-lg transition-colors ${authMode === 'register' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>Регистрация</button>
            </div>

            <form onSubmit={handleAuth} className="space-y-5">
              {authError && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl text-center">{authError}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="ваша@почта.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Пароль</label>
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="Минимум 6 символов" />
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 active:scale-95 transition-all flex justify-center items-center gap-2">
                {authMode === 'login' ? <><LogIn className="w-5 h-5"/> Войти</> : <><UserPlus className="w-5 h-5"/> Зарегистрироваться</>}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ОСНОВНОЙ ИНТЕРФЕЙС ПРИЛОЖЕНИЯ
  return (
    <div className="min-h-screen bg-gray-50 text-slate-800 font-sans">
      
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-inner">
              <Navigation className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">MeetPoint</h1>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors" title="Выйти">
              <LogOut className="w-5 h-5" />
            </button>
            <button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full text-sm font-medium transition-all shadow-sm active:scale-95">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Создать</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <div className="mb-8 space-y-4 sm:space-y-0 sm:flex sm:items-center sm:justify-between gap-4">
          <div className="flex gap-2 flex-1 max-w-lg">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-5 w-5 text-gray-400" /></div>
              <input type="text" placeholder="Искать..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl leading-5 bg-white focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="block w-[130px] px-2 py-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>

          <div className="flex overflow-x-auto pb-2 sm:pb-0 hide-scrollbar gap-2">
            {CATEGORIES.map(category => (
              <button key={category} onClick={() => setSelectedCategory(category)} className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${selectedCategory === category ? 'bg-indigo-100 text-indigo-800 ring-1 ring-indigo-200' : 'bg-white text-gray-600 border border-gray-200'}`}>
                {category}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400"><Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-500" /></div>
        ) : filteredEvents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredEvents.map(event => (
              <div key={event.docId} onClick={() => setSelectedEvent(event)} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-lg transition-all cursor-pointer group flex flex-col h-full">
                <div className="relative h-48 bg-gray-200 overflow-hidden">
                  <img src={event.image} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold text-indigo-700 shadow-sm">{event.category}</div>
                </div>
                
                <div className="p-5 flex flex-col flex-grow">
                  <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2 leading-tight">{event.title}</h3>
                  <div className="space-y-2 mb-4 flex-grow">
                    <div className="flex items-center text-sm text-gray-600"><Calendar className="w-4 h-4 mr-2 text-gray-400" /> <span>{event.date} • {event.time}</span></div>
                    <div className="flex items-start text-sm text-gray-600"><MapPin className="w-4 h-4 mr-2 text-gray-400 shrink-0 mt-0.5" /> <span className="line-clamp-2">{event.location}</span></div>
                  </div>
                  <div className="pt-4 border-t border-gray-100 flex items-center justify-between mt-auto">
                    <div className="flex items-center text-sm font-medium text-gray-700"><Users className="w-4 h-4 mr-1.5 text-indigo-500" /> {event.attendees}{event.maxAttendees && `/${event.maxAttendees}`}</div>
                    <button onClick={(e) => { e.stopPropagation(); if (event.organizerId === user?.uid) return; event.attendeesList?.some(a => a.id === user?.uid) ? handleLeaveEvent(event) : handleJoinEvent(event); }} className={`px-4 py-1.5 rounded-full text-sm font-medium z-10 ${event.organizerId === user?.uid ? 'bg-purple-50 text-purple-700' : event.attendeesList?.some(a => a.id === user?.uid) ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}>
                      {event.organizerId === user?.uid ? 'Ваше' : event.attendeesList?.some(a => a.id === user?.uid) ? 'Не пойду' : 'Пойду'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 border-dashed">
            <h3 className="text-lg font-medium text-gray-900">Пока ничего нет</h3>
            <p className="text-gray-500 mb-4">Станьте первым, кто создаст мероприятие!</p>
          </div>
        )}
      </main>
      
      {/* МОДАЛКА СОЗДАНИЯ С ФОТО */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/50 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b flex justify-between items-center shrink-0">
              <h3 className="text-xl font-bold">Новое мероприятие</h3>
              <button onClick={() => {setIsCreateModalOpen(false); setImagePreview('');}} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            
            <form id="createEventForm" onSubmit={handleCreateEvent} className="p-6 overflow-y-auto space-y-4">
              
              {/* ЗАГРУЗКА ФОТО (Переделана на Base64) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Обложка</label>
                <div className="relative w-full h-40 bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center overflow-hidden group hover:bg-gray-100 transition-colors cursor-pointer">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center text-gray-500 flex flex-col items-center">
                      <Camera className="w-8 h-8 mb-2 text-indigo-400 group-hover:scale-110 transition-transform" />
                      <span className="text-sm font-medium">Сделать фото или выбрать</span>
                    </div>
                  )}
                  {/* Скрытый инпут вызывает камеру/галерею */}
                  <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
                <input required type="text" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Поход в горы" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
                <textarea value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})} className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" rows="2"></textarea>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Дата *</label>
                  <input required type="date" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} className="w-full px-4 py-2 border rounded-xl focus:ring-2 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Время *</label>
                  <input required type="time" value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} className="w-full px-4 py-2 border rounded-xl focus:ring-2 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Место *</label>
                <input required type="text" value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})} className="w-full px-4 py-2 border rounded-xl focus:ring-2 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Категория</label>
                  <select value={newEvent.category} onChange={e => setNewEvent({...newEvent, category: e.target.value})} className="w-full px-4 py-2 border rounded-xl outline-none bg-white">
                    {CATEGORIES.filter(c => c !== 'Все').map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Лимит людей</label>
                  <input type="number" value={newEvent.maxAttendees} onChange={e => setNewEvent({...newEvent, maxAttendees: e.target.value})} className="w-full px-4 py-2 border rounded-xl outline-none" placeholder="Без лимита" />
                </div>
              </div>
            </form>

            <div className="p-4 border-t bg-gray-50 shrink-0">
              <button type="submit" form="createEventForm" disabled={isUploading} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors flex justify-center items-center gap-2 disabled:bg-indigo-400">
                {isUploading ? <><Loader2 className="w-5 h-5 animate-spin" /> Обработка...</> : 'Опубликовать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* МОДАЛКА ПРОФИЛЯ ПРИ ПЕРВОМ ВХОДЕ */}
      {showProfileModal && (
        <div className="fixed inset-0 z-[60] bg-gray-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
            <h3 className="text-2xl font-bold mb-2">Как вас зовут?</h3>
            <p className="text-gray-500 mb-6">Это имя будут видеть другие участники</p>
            <form onSubmit={handleSaveProfile}>
              <input type="text" required value={userName} onChange={e => setUserName(e.target.value)} className="w-full px-4 py-4 border-2 rounded-xl text-center text-lg mb-6 outline-none focus:border-indigo-500" placeholder="Ваше Имя" />
              <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700">Начать</button>
            </form>
          </div>
        </div>
      )}

      {/* ДЕТАЛИ И ЧАТ */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm p-4 flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-3xl w-full max-w-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh] overflow-hidden">
            <div className="relative h-64 shrink-0">
              <img src={selectedEvent.image} className="w-full h-full object-cover" />
              <button onClick={() => { setSelectedEvent(null); setActiveTab('info'); }} className="absolute top-4 right-4 bg-black/40 text-white p-2 rounded-full"><X className="w-5 h-5" /></button>
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-6 pt-20">
                <span className="px-3 py-1 bg-indigo-500 text-white text-xs font-bold rounded-full mb-3 inline-block">{selectedEvent.category}</span>
                <h2 className="text-2xl font-bold text-white">{selectedEvent.title}</h2>
              </div>
            </div>

            <div className="flex border-b px-6 shrink-0 bg-white">
              <button onClick={() => setActiveTab('info')} className={`py-4 mr-6 font-medium border-b-2 ${activeTab === 'info' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>Информация</button>
              <button onClick={() => setActiveTab('chat')} className={`py-4 font-medium border-b-2 flex items-center gap-2 ${activeTab === 'chat' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}><MessageSquare className="w-4 h-4" /> Чат</button>
            </div>

            <div className="overflow-y-auto flex-1 bg-gray-50">
              {activeTab === 'info' ? (
                <div className="p-6 bg-white">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="flex gap-3"><div className="bg-indigo-50 p-2 rounded-xl"><Calendar className="w-5 h-5 text-indigo-600" /></div><div><p className="font-semibold">{selectedEvent.date}</p><p className="text-sm text-gray-500">{selectedEvent.time}</p></div></div>
                    <div className="flex gap-3"><div className="bg-indigo-50 p-2 rounded-xl"><MapPin className="w-5 h-5 text-indigo-600" /></div><p className="font-semibold">{selectedEvent.location}</p></div>
                    <div className="flex gap-3"><div className="bg-indigo-50 p-2 rounded-xl"><Users className="w-5 h-5 text-indigo-600" /></div><div><p className="font-semibold">{selectedEvent.attendees} {selectedEvent.maxAttendees && `из ${selectedEvent.maxAttendees}`}</p><p className="text-sm text-gray-500">участников</p></div></div>
                  </div>
                  <p className="text-gray-600 mb-6 whitespace-pre-wrap">{selectedEvent.description}</p>
                </div>
              ) : (
                <div className="flex flex-col h-full min-h-[300px]">
                  {!isParticipant ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                      <MessageSquare className="w-12 h-12 text-gray-300 mb-3" />
                      <p className="text-gray-500 mb-4">Присоединитесь, чтобы общаться</p>
                      <button onClick={() => handleJoinEvent(selectedEvent)} className="px-6 py-2 bg-indigo-600 text-white rounded-full font-medium">Присоединиться</button>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                        {messages.map(msg => (
                          <div key={msg.id} className={`flex flex-col ${msg.userId === user?.uid ? 'items-end' : 'items-start'}`}>
                            <div className="text-[10px] text-gray-400 mb-1 px-1">{msg.userName}</div>
                            <div className={`px-4 py-2 rounded-2xl max-w-[85%] ${msg.userId === user?.uid ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-gray-800 border rounded-tl-none'}`}>{msg.text}</div>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </div>
                      <form onSubmit={handleSendMessage} className="p-4 bg-white border-t flex gap-2 shrink-0">
                        <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Сообщение..." className="flex-1 px-4 py-2 border rounded-full outline-none" />
                        <button type="submit" disabled={!newMessage.trim()} className="bg-indigo-600 text-white p-2 rounded-full disabled:opacity-50"><Send className="w-5 h-5 ml-0.5" /></button>
                      </form>
                    </>
                  )}
                </div>
              )}
            </div>

            {activeTab === 'info' && (
              <div className="p-4 bg-white border-t flex justify-between items-center shrink-0">
                <span className="text-sm text-gray-500">{selectedEvent.organizerId === user?.uid ? 'Ваше событие' : isParticipant ? 'Вы идете' : 'Есть места'}</span>
                {selectedEvent.organizerId === user?.uid ? (
                  showDeleteConfirm ? (
                    <div className="flex gap-2"><button onClick={() => handleDeleteEvent(selectedEvent)} className="px-4 py-2 bg-red-600 text-white font-bold rounded-xl">Удалить</button><button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 bg-gray-100 font-bold rounded-xl">Отмена</button></div>
                  ) : (
                    <button onClick={() => setShowDeleteConfirm(true)} className="px-4 py-2 bg-red-50 text-red-600 font-bold rounded-xl flex items-center gap-2"><Trash2 className="w-4 h-4"/> Удалить</button>
                  )
                ) : isParticipant ? (
                  <button onClick={() => handleLeaveEvent(selectedEvent)} className="px-6 py-2.5 bg-gray-100 font-bold rounded-xl flex items-center gap-2"><CalendarOff className="w-4 h-4"/> Не пойду</button>
                ) : (
                  <button onClick={() => handleJoinEvent(selectedEvent)} disabled={selectedEvent.maxAttendees && selectedEvent.attendees >= selectedEvent.maxAttendees} className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:bg-gray-300">Присоединиться</button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}