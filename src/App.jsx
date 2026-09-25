import React, { useState, useMemo, useEffect, useRef } from 'react';
import { MapPin, Calendar, Clock, Users, Plus, X, Search, Filter, Hash, Navigation, Loader2, MessageSquare, Send, Trash2, CalendarOff } from 'lucide-react';

// Firebase imports
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, updateProfile } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, collection, addDoc, updateDoc, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';

// 1. Инициализация Firebase (вне компонента)
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

const CATEGORIES = [
  'Все',
  'Настольные игры',
  'Кино',
  'Спорт',
  'Еда и напитки',
  'Искусство',
  'Музыка',
  'Образование',
  'Другое'
];

export default function App() {
  // State
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Все');
  const [filterDate, setFilterDate] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Новые состояния для профиля и чата
  const [userName, setUserName] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [activeTab, setActiveTab] = useState('info'); // 'info' или 'chat'
  const messagesEndRef = useRef(null);

  // Form State
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    location: '',
    category: 'Другое',
    maxAttendees: '',
    image: ''
  });

  // 2. Авторизация пользователя (анонимная или по токену)
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Проверяем, задано ли имя профиля. Если нет - показываем окно настройки.
        if (currentUser.displayName) {
          setUserName(currentUser.displayName);
        } else {
          setShowProfileModal(true);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Сохранение имени профиля
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

  // Прокрутка чата вниз при новых сообщениях
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Подписка на чат выбранного мероприятия
  useEffect(() => {
    if (!user || !selectedEvent) {
      setMessages([]);
      return;
    }
    
    // Создаем отдельную коллекцию сообщений для каждого мероприятия для безопасности и скорости
    const messagesRef = collection(db, 'artifacts', appId, 'public', 'data', `meetpoint_messages_${selectedEvent.docId}`);
    
    const unsubscribe = onSnapshot(messagesRef, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      msgs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); // Сортировка по времени
      setMessages(msgs);
    }, (error) => console.error("Ошибка загрузки чата:", error));
    
    return () => unsubscribe();
  }, [user, selectedEvent]);

  // Отправка сообщения в чат
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !selectedEvent) return;
    
    try {
      const messagesRef = collection(db, 'artifacts', appId, 'public', 'data', `meetpoint_messages_${selectedEvent.docId}`);
      await addDoc(messagesRef, {
        text: newMessage.trim(),
        userId: user.uid,
        userName: user.displayName || userName,
        createdAt: new Date().toISOString()
      });
      setNewMessage('');
    } catch (error) {
      console.error("Ошибка отправки сообщения:", error);
    }
  };

  // 3. Подписка на данные из облачной базы данных в реальном времени
  useEffect(() => {
    if (!user) return;

    // Путь к публичным данным приложения
    const eventsRef = collection(db, 'artifacts', appId, 'public', 'data', 'meetpoint_events');
    
    setIsLoading(true);
    const unsubscribe = onSnapshot(eventsRef, (snapshot) => {
      const eventsData = snapshot.docs.map(doc => ({
        ...doc.data(),
        docId: doc.id // Сохраняем ID документа Firestore для будущих обновлений
      }));
      
      // Сортировка по дате (в памяти)
      eventsData.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      setEvents(eventsData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching events:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Фильтрация событий (поиск, категории, даты)
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      const matchesSearch = event.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            event.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'Все' || event.category === selectedCategory;
      const matchesDate = filterDate === '' || event.date === filterDate;
      return matchesSearch && matchesCategory && matchesDate;
    });
  }, [events, searchQuery, selectedCategory, filterDate]);

  // 4. Создание нового мероприятия в базе данных
  const handleCreateEvent = async (e) => {
    e.preventDefault();
    if (!user || !newEvent.title || !newEvent.date || !newEvent.time || !newEvent.location) return;

    try {
      const eventsRef = collection(db, 'artifacts', appId, 'public', 'data', 'meetpoint_events');
      await addDoc(eventsRef, {
        ...newEvent,
        attendees: 1, // Создатель сразу становится участником
        attendeesList: [{ id: user.uid, name: user.displayName || userName }], // Сохраняем имя организатора
        maxAttendees: newEvent.maxAttendees ? parseInt(newEvent.maxAttendees) : null,
        image: newEvent.image.trim() || 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&q=80&w=800',
        organizer: user.displayName || userName, // Используем реальное имя
        organizerId: user.uid,
        createdAt: new Date().toISOString()
      });

      setIsCreateModalOpen(false);
      setNewEvent({
        title: '', description: '', date: '', time: '', location: '', category: 'Другое', maxAttendees: '', image: ''
      });
    } catch (error) {
      console.error("Error creating event:", error);
    }
  };

  // 5. Обновление мероприятия (Присоединиться)
  const handleJoinEvent = async (event) => {
    if (!user || !event.docId) return;
    
    // Проверка на лимит мест
    if (event.maxAttendees && event.attendees >= event.maxAttendees) return;
    
    // Защита от повторного вступления
    const alreadyJoined = event.attendeesList?.some(a => a.id === user.uid);
    if (alreadyJoined) return;

    try {
      const eventRef = doc(db, 'artifacts', appId, 'public', 'data', 'meetpoint_events', event.docId);
      
      // Добавляем участника в массив attendeesList
      await updateDoc(eventRef, {
        attendees: event.attendees + 1,
        attendeesList: arrayUnion({ id: user.uid, name: user.displayName || userName })
      });
      
      // Обновляем модальное окно (если открыто), чтобы сразу показать вкладку чата
      if (selectedEvent && selectedEvent.docId === event.docId) {
        setSelectedEvent(prev => ({
          ...prev,
          attendees: prev.attendees + 1,
          attendeesList: [...(prev.attendeesList || []), { id: user.uid, name: user.displayName || userName }]
        }));
        setActiveTab('chat');
      }
    } catch (error) {
      console.error("Error joining event:", error);
    }
  };

  // Проверка, является ли текущий пользователь участником
  const isParticipant = useMemo(() => {
    if (!user || !selectedEvent) return false;
    return selectedEvent.attendeesList?.some(a => a.id === user.uid) || selectedEvent.organizerId === user.uid;
  }, [user, selectedEvent]);

  // 6. Отмена участия в мероприятии
  const handleLeaveEvent = async (event) => {
    if (!user || !event.docId || event.organizerId === user.uid) return; // Организатор не может отписаться, только удалить
    
    const userToRemove = event.attendeesList?.find(a => a.id === user.uid);
    if (!userToRemove) return;

    try {
      const eventRef = doc(db, 'artifacts', appId, 'public', 'data', 'meetpoint_events', event.docId);
      await updateDoc(eventRef, {
        attendees: Math.max(0, event.attendees - 1),
        attendeesList: arrayRemove(userToRemove)
      });
      
      // Обновляем открытое модальное окно, если оно открыто
      if (selectedEvent && selectedEvent.docId === event.docId) {
        setSelectedEvent(prev => ({
          ...prev,
          attendees: Math.max(0, prev.attendees - 1),
          attendeesList: prev.attendeesList.filter(a => a.id !== user.uid)
        }));
      }
    } catch (error) {
      console.error("Error leaving event:", error);
    }
  };

  // 7. Удаление мероприятия (только для организатора)
  const handleDeleteEvent = async (event) => {
    if (!user || !event.docId || event.organizerId !== user.uid) return;
    
    try {
      const eventRef = doc(db, 'artifacts', appId, 'public', 'data', 'meetpoint_events', event.docId);
      await deleteDoc(eventRef); // Удаляем документ из базы данных
      setSelectedEvent(null);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error("Error deleting event:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-slate-800 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* Шапка */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-inner">
              <Navigation className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
              MeetPoint
            </h1>
          </div>
          
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Создать мероприятие</span>
            <span className="sm:hidden">Создать</span>
          </button>
        </div>
      </header>

      {/* Основной контент */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Поиск и фильтры */}
        <div className="mb-8 space-y-4 sm:space-y-0 sm:flex sm:items-center sm:justify-between gap-4">
          <div className="flex gap-2 flex-1 max-w-lg">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Искать события, места, людей..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-shadow"
              />
            </div>
            
            {/* Фильтр по дате */}
            <div className="relative w-[130px] sm:w-[150px] shrink-0">
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className={`block w-full px-2 sm:px-3 py-2.5 border border-gray-300 rounded-xl leading-5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-shadow ${filterDate ? 'text-gray-900' : 'text-gray-400'}`}
              />
              {filterDate && (
                <button 
                  onClick={() => setFilterDate('')} 
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 bg-gray-100 rounded-full hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition-colors"
                  title="Очистить дату"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex overflow-x-auto pb-2 sm:pb-0 hide-scrollbar gap-2">
            {CATEGORIES.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === category
                    ? 'bg-indigo-100 text-indigo-800 ring-1 ring-indigo-200'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Сетка мероприятий или состояния загрузки/пустоты */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-500" />
            <p>Загрузка мероприятий...</p>
          </div>
        ) : filteredEvents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredEvents.map(event => (
              <div 
                key={event.docId} 
                onClick={() => setSelectedEvent(event)}
                className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 cursor-pointer group flex flex-col h-full relative"
              >
                <div className="relative h-48 overflow-hidden bg-gray-200">
                  <img 
                    src={event.image} 
                    alt={event.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold text-indigo-700 shadow-sm">
                    {event.category}
                  </div>
                </div>
                
                <div className="p-5 flex flex-col flex-grow">
                  <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2 leading-tight group-hover:text-indigo-600 transition-colors">
                    {event.title}
                  </h3>
                  
                  <div className="space-y-2 mb-4 flex-grow">
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="w-4 h-4 mr-2 text-gray-400 shrink-0" />
                      <span>{new Date(event.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
                      <span className="mx-1">•</span>
                      <span>{event.time}</span>
                    </div>
                    
                    <div className="flex items-start text-sm text-gray-600">
                      <MapPin className="w-4 h-4 mr-2 text-gray-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{event.location}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 flex items-center justify-between mt-auto">
                    <div className="flex items-center text-sm font-medium text-gray-700">
                      <Users className="w-4 h-4 mr-1.5 text-indigo-500" />
                      <span>{event.attendees}</span>
                      {event.maxAttendees && <span className="text-gray-400">/{event.maxAttendees}</span>}
                    </div>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (event.organizerId === user?.uid) return; // На свои события нажимать нельзя
                        
                        if (event.attendeesList?.some(a => a.id === user?.uid)) {
                          handleLeaveEvent(event);
                        } else {
                          handleJoinEvent(event);
                        }
                      }}
                      disabled={(event.maxAttendees && event.attendees >= event.maxAttendees && !event.attendeesList?.some(a => a.id === user?.uid)) || event.organizerId === user?.uid}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors z-10 ${
                        event.organizerId === user?.uid
                          ? 'bg-purple-50 text-purple-700 cursor-default'
                          : event.attendeesList?.some(a => a.id === user?.uid)
                          ? 'bg-red-50 text-red-600 hover:bg-red-100'
                          : event.maxAttendees && event.attendees >= event.maxAttendees
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                      }`}
                    >
                      {event.organizerId === user?.uid
                        ? 'Ваше'
                        : event.attendeesList?.some(a => a.id === user?.uid) 
                        ? 'Не пойду' 
                        : event.maxAttendees && event.attendees >= event.maxAttendees 
                          ? 'Мест нет' 
                          : 'Пойду'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 border-dashed">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">Пока ничего нет</h3>
            <p className="text-gray-500 mb-4">База данных пуста. Станьте первым, кто создаст мероприятие!</p>
            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className="text-indigo-600 font-medium hover:text-indigo-800"
            >
              Создать мероприятие &rarr;
            </button>
          </div>
        )}
      </main>

      {/* Модальное окно создания мероприятия */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity backdrop-blur-sm" aria-hidden="true" onClick={() => setIsCreateModalOpen(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-xl leading-6 font-bold text-gray-900" id="modal-title">Создать мероприятие</h3>
                  <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-400 hover:text-gray-500 p-1 rounded-full hover:bg-gray-100 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <form id="createEventForm" onSubmit={handleCreateEvent} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Название <span className="text-red-500">*</span></label>
                    <input 
                      required
                      type="text" 
                      value={newEvent.title}
                      onChange={e => setNewEvent({...newEvent, title: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" 
                      placeholder="Например: Поход в горы"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
                    <textarea 
                      value={newEvent.description}
                      onChange={e => setNewEvent({...newEvent, description: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" 
                      rows="3"
                      placeholder="Расскажите подробности..."
                    ></textarea>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Дата <span className="text-red-500">*</span></label>
                      <input 
                        required
                        type="date" 
                        value={newEvent.date}
                        onChange={e => setNewEvent({...newEvent, date: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Время <span className="text-red-500">*</span></label>
                      <input 
                        required
                        type="time" 
                        value={newEvent.time}
                        onChange={e => setNewEvent({...newEvent, time: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" 
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Место проведения <span className="text-red-500">*</span></label>
                    <input 
                      required
                      type="text" 
                      value={newEvent.location}
                      onChange={e => setNewEvent({...newEvent, location: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" 
                      placeholder="Адрес или ориентир"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ссылка на фото (опционально)</label>
                    <input 
                      type="url" 
                      value={newEvent.image}
                      onChange={e => setNewEvent({...newEvent, image: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" 
                      placeholder="https://... (прямая ссылка на картинку)"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Категория</label>
                      <select 
                        value={newEvent.category}
                        onChange={e => setNewEvent({...newEvent, category: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                      >
                        {CATEGORIES.filter(c => c !== 'Все').map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Макс. участников</label>
                      <input 
                        type="number" 
                        min="2"
                        value={newEvent.maxAttendees}
                        onChange={e => setNewEvent({...newEvent, maxAttendees: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" 
                        placeholder="Без лимита"
                      />
                    </div>
                  </div>
                </form>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-gray-100">
                <button 
                  type="submit" 
                  form="createEventForm"
                  className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
                >
                  Опубликовать
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsCreateModalOpen(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-xl border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно деталей мероприятия */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-900 bg-opacity-40 transition-opacity backdrop-blur-sm" aria-hidden="true" onClick={() => { setSelectedEvent(null); setActiveTab('info'); setShowDeleteConfirm(false); }}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-3xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl w-full flex flex-col max-h-[90vh]">
              
              <div className="relative h-64 sm:h-80 w-full shrink-0">
                <img src={selectedEvent.image} alt={selectedEvent.title} className="w-full h-full object-cover" />
                <button 
                  onClick={() => { setSelectedEvent(null); setActiveTab('info'); setShowDeleteConfirm(false); }} 
                  className="absolute top-4 right-4 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full backdrop-blur-md transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 pt-20">
                  <span className="inline-block px-3 py-1 bg-indigo-500/90 text-white text-xs font-bold rounded-full mb-3 backdrop-blur-sm uppercase tracking-wider">
                    {selectedEvent.category}
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight">{selectedEvent.title}</h2>
                </div>
              </div>

              {/* Табы навигации внутри модального окна */}
              <div className="flex border-b border-gray-100 px-6 sm:px-8 bg-white shrink-0">
                <button 
                  onClick={() => setActiveTab('info')}
                  className={`py-4 px-2 mr-6 font-medium text-sm border-b-2 transition-colors ${activeTab === 'info' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  Информация
                </button>
                <button 
                  onClick={() => setActiveTab('chat')}
                  className={`py-4 px-2 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'chat' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  <MessageSquare className="w-4 h-4" />
                  Чат участников
                </button>
              </div>

              {/* Контент вкладок (Скроллируемая область) */}
              <div className="overflow-y-auto flex-1 bg-gray-50 flex flex-col">
                {activeTab === 'info' ? (
                  <div className="px-6 py-6 sm:px-8 bg-white">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                      <div className="flex items-start gap-3">
                        <div className="bg-indigo-50 p-2.5 rounded-xl shrink-0">
                          <Calendar className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{new Date(selectedEvent.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                          <p className="text-sm text-gray-500">{selectedEvent.time}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <div className="bg-indigo-50 p-2.5 rounded-xl shrink-0">
                          <MapPin className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 line-clamp-2">{selectedEvent.location}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="bg-indigo-50 p-2.5 rounded-xl shrink-0">
                          <Users className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {selectedEvent.attendees} {selectedEvent.maxAttendees ? `из ${selectedEvent.maxAttendees}` : ''}
                          </p>
                          <p className="text-sm text-gray-500">участников</p>
                        </div>
                      </div>
                    </div>

                    <div className="prose prose-sm sm:prose text-gray-600 mb-8 max-w-none">
                      <h3 className="text-lg font-bold text-gray-900 mb-2">О мероприятии</h3>
                      <p className="whitespace-pre-wrap leading-relaxed">{selectedEvent.description || 'Описание отсутствует.'}</p>
                    </div>
                    
                    <div className="flex items-center gap-3 py-4 border-t border-gray-100">
                       <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold shadow-inner">
                          {selectedEvent.organizer ? selectedEvent.organizer.charAt(0).toUpperCase() : 'A'}
                       </div>
                       <div>
                         <p className="text-sm text-gray-500">Организатор</p>
                         <p className="text-sm font-medium text-gray-900">{selectedEvent.organizer}</p>
                       </div>
                    </div>

                    {/* Список участников */}
                    {selectedEvent.attendeesList && selectedEvent.attendeesList.length > 0 && (
                      <div className="py-4 border-t border-gray-100">
                        <h3 className="text-sm font-bold text-gray-900 mb-3">Кто пойдет ({selectedEvent.attendeesList.length})</h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedEvent.attendeesList.map((attendee, i) => (
                            <div key={i} className="bg-gray-50 border border-gray-200 text-gray-700 px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2">
                              <div className="w-5 h-5 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-[10px]">
                                {attendee.name ? attendee.name.charAt(0).toUpperCase() : 'U'}
                              </div>
                              {attendee.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Вкладка Чата */
                  <div className="flex flex-col flex-1 min-h-[300px]">
                    {!isParticipant ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                        <MessageSquare className="w-12 h-12 text-gray-300 mb-3" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Чат закрыт</h3>
                        <p className="text-gray-500">Присоединитесь к мероприятию, чтобы общаться с организатором и другими участниками.</p>
                        <button 
                          onClick={() => handleJoinEvent(selectedEvent)}
                          disabled={selectedEvent.maxAttendees && selectedEvent.attendees >= selectedEvent.maxAttendees}
                          className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-full font-medium hover:bg-indigo-700 disabled:bg-gray-300 transition-colors"
                        >
                          Присоединиться
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                          {messages.length === 0 ? (
                            <p className="text-center text-gray-400 py-10">Сообщений пока нет. Напишите первым!</p>
                          ) : (
                            messages.map(msg => {
                              const isMe = msg.userId === user?.uid;
                              return (
                                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                  <div className="text-[10px] text-gray-400 mb-1 px-1">{msg.userName}</div>
                                  <div className={`px-4 py-2 rounded-2xl max-w-[85%] ${isMe ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none shadow-sm'}`}>
                                    {msg.text}
                                  </div>
                                </div>
                              );
                            })
                          )}
                          <div ref={messagesEndRef} />
                        </div>
                        <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-200 flex gap-2 shrink-0">
                          <input 
                            type="text" 
                            value={newMessage}
                            onChange={e => setNewMessage(e.target.value)}
                            placeholder="Написать сообщение..."
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                          />
                          <button type="submit" disabled={!newMessage.trim()} className="bg-indigo-600 text-white p-2 rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0">
                            <Send className="w-5 h-5 ml-0.5" />
                          </button>
                        </form>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Футер карточки (Показывается только во вкладке инфо) */}
              {activeTab === 'info' && (
                <div className="bg-white px-6 py-4 sm:px-8 border-t border-gray-100 flex items-center justify-between shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                   <div className="text-sm text-gray-500">
                     {selectedEvent.organizerId === user?.uid 
                        ? 'Вы организатор мероприятия' 
                        : isParticipant 
                        ? 'Вы участвуете в мероприятии' 
                        : selectedEvent.maxAttendees && selectedEvent.attendees >= selectedEvent.maxAttendees 
                        ? 'Регистрация закрыта' 
                        : 'Есть свободные места'}
                   </div>
                   
                   {selectedEvent.organizerId === user?.uid ? (
                      showDeleteConfirm ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-red-600 mr-2">Удалить?</span>
                          <button onClick={() => handleDeleteEvent(selectedEvent)} className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 shadow-sm">Да</button>
                          <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-200">Нет</button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setShowDeleteConfirm(true)}
                          className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-sm font-bold transition-all bg-red-50 text-red-600 hover:bg-red-100 flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4 hidden sm:block" /> Удалить
                        </button>
                      )
                   ) : isParticipant ? (
                      <button 
                        onClick={() => handleLeaveEvent(selectedEvent)}
                        className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-sm font-bold transition-all bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-2"
                      >
                        <CalendarOff className="w-4 h-4 hidden sm:block" /> Отменить участие
                      </button>
                   ) : (
                      <button 
                        onClick={() => handleJoinEvent(selectedEvent)}
                        disabled={selectedEvent.maxAttendees && selectedEvent.attendees >= selectedEvent.maxAttendees}
                        className={`px-6 sm:px-8 py-2 sm:py-3 rounded-xl text-sm font-bold transition-all shadow-sm ${
                          selectedEvent.maxAttendees && selectedEvent.attendees >= selectedEvent.maxAttendees
                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md active:scale-95'
                        }`}
                      >
                        {selectedEvent.maxAttendees && selectedEvent.attendees >= selectedEvent.maxAttendees 
                          ? 'Мест нет' 
                          : 'Присоединиться'}
                      </button>
                   )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Модальное окно установки профиля (Обязательное) */}
      {showProfileModal && (
        <div className="fixed inset-0 z-[60] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity backdrop-blur-sm" aria-hidden="true"></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-3xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md w-full">
              <div className="bg-white px-6 pt-8 pb-8">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-indigo-100 mb-6">
                  <Users className="h-8 w-8 text-indigo-600" />
                </div>
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Добро пожаловать в MeetPoint!</h3>
                  <p className="text-gray-500 mb-8">Пожалуйста, представьтесь, чтобы организаторы и другие участники знали, как к вам обращаться.</p>
                  
                  <form onSubmit={handleSaveProfile} className="mt-2">
                    <input 
                      type="text" 
                      required
                      value={userName}
                      onChange={e => setUserName(e.target.value)}
                      className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center text-lg shadow-inner outline-none transition-all placeholder-gray-300" 
                      placeholder="Ваше Имя или Никнейм"
                    />
                    <button 
                      type="submit" 
                      disabled={!userName.trim()}
                      className="mt-6 w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-4 py-4 bg-indigo-600 text-base font-bold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300 transition-colors"
                    >
                      Начать использовать приложение
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}