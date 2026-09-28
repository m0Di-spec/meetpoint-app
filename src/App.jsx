import React, { useState, useMemo, useEffect, useRef } from 'react';
import { MapPin, Calendar, Clock, Users, Plus, X, Search, Filter, Loader2, MessageSquare, Send, Trash2, CalendarOff, Camera, LogIn, UserPlus, LogOut, UserCircle, Eye, EyeOff, ChevronLeft, Compass, Ticket, Crown, User, MessageCircle, Bell, BellRing, MailWarning, RefreshCw } from 'lucide-react';

// ИМПОРТЫ FIREBASE
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail, sendEmailVerification } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, collection, addDoc, updateDoc, arrayUnion, arrayRemove, deleteDoc, setDoc, getDoc, query, where } from 'firebase/firestore';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// ВОЗВРАЩАЕМ НАТИВНЫЙ МОСТИК ДЛЯ ANDROID
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

// ==========================================
// 🚨 1. ВСТАВЬТЕ СВОИ КЛЮЧИ FIREBASE СЮДА
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyAM1bfODGs8qCRfYxy906cuct0955Juda8",
  authDomain: "meet-point-73afa.firebaseapp.com",
  projectId: "meet-point-73afa",
  storageBucket: "meet-point-73afa.firebasestorage.app",
  messagingSenderId: "975617549003",
  appId: "1:975617549003:web:e0e2f7233c6fca0e26314e"
};

// 🚨 2. ВСТАВЬТЕ СКОПИРОВАННЫЙ VAPID KEY СЮДА
const VAPID_KEY = "BC-H7FIJGhfkBohlUR8nQPOE4okMpjc0qc84JCWNA4uZjhyOXWUsG0ClNg3v5KRgEefZYFzg3nFCKtSYcXMpWug";

// 🚨 3. ВСТАВЬТЕ ССЫЛКУ НА ВАШ VERCEL САЙТ (БЕЗ СЛЕША НА КОНЦЕ)
// Пример: "https://meetpoint-team-app.vercel.app"
const VERCEL_URL = "[https://meetpoint-team-app.vercel.app/](https://meetpoint-team-app.vercel.app/)";
// ==========================================

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Инициализируем систему веб-уведомлений
let messaging;
try {
  messaging = getMessaging(app);
} catch (e) {
  console.log("Push-уведомления (Web) не поддерживаются.", e);
}

const CATEGORIES = ['Все', 'Настольные игры', 'Кино', 'Спорт', 'Еда и напитки', 'Искусство', 'Музыка', 'Образование', 'Другое'];

export default function App() {
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [emailVerified, setEmailVerified] = useState(false);
  
  const [authMode, setAuthMode] = useState('login'); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);

  const [userProfile, setUserProfile] = useState({ name: '', city: '', interests: '', avatar: '', fcmToken: '' });
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [isProfileSaving, setIsProfileSaving] = useState(false);

  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [navTab, setNavTab] = useState('all'); 
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Все');
  const [showFilters, setShowFilters] = useState(false);
  const [filterCity, setFilterCity] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [showPastEvents, setShowPastEvents] = useState(false); 

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [activeTab, setActiveTab] = useState('info'); 
  const messagesEndRef = useRef(null);
  const directMessagesEndRef = useRef(null);

  const [newEvent, setNewEvent] = useState({ title: '', description: '', city: '', date: '', time: '', location: '', category: 'Другое', maxAttendees: '' });
  const [imagePreview, setImagePreview] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const [viewingUser, setViewingUser] = useState(null);
  const [isViewingUserLoading, setIsViewingUserLoading] = useState(false);

  const [userChats, setUserChats] = useState([]);
  const [activeDirectChat, setActiveDirectChat] = useState(null);
  const [directMessages, setDirectMessages] = useState([]);
  const [newDirectMessage, setNewDirectMessage] = useState('');

  // === СЛУШАТЕЛЬ ВЕБ-УВЕДОМЛЕНИЙ ===
  useEffect(() => {
    if (messaging) {
      const unsubscribe = onMessage(messaging, (payload) => {
        alert(`Уведомление: ${payload.notification?.title}\n${payload.notification?.body}`);
      });
      return () => unsubscribe();
    }
  }, []);

  // === СЛУШАТЕЛЬ ANDROID-УВЕДОМЛЕНИЙ ===
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      PushNotifications.addListener('registration', async (token) => {
        if (user) {
          const fcmToken = token.value;
          await updateDoc(doc(db, 'users', user.uid), { fcmToken: fcmToken });
          setUserProfile(prev => ({ ...prev, fcmToken: fcmToken }));
          alert("Отлично! Android-уведомления включены.");
        }
      });
      PushNotifications.addListener('registrationError', (error) => {
        alert(`Ошибка Android токена: ${JSON.stringify(error)}`);
      });
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        alert(`Уведомление: ${notification.title}\n${notification.body}`);
      });
      return () => { PushNotifications.removeAllListeners(); };
    }
  }, [user]);

  useEffect(() => {
    if (isFirstLogin || isCreateModalOpen || selectedEvent || viewingUser || activeDirectChat || (user && !emailVerified)) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isFirstLogin, isCreateModalOpen, selectedEvent, viewingUser, activeDirectChat, user, emailVerified]);

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
        setEmailVerified(currentUser.emailVerified);
        if (currentUser.emailVerified) {
          const docRef = doc(db, "users", currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserProfile(docSnap.data());
            if (docSnap.data().city) setNewEvent(prev => ({...prev, city: docSnap.data().city}));
            setIsFirstLogin(false);
          } else {
            setIsFirstLogin(true);
          }
        }
      } else {
        setUserProfile({ name: '', city: '', interests: '', avatar: '', fcmToken: '' });
        setEmailVerified(false);
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError(''); setAuthMessage('');
    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);
      }
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') setAuthError('Эта почта уже занята');
      else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') setAuthError('Неверная почта или пароль');
      else if (error.code === 'auth/weak-password') setAuthError('Пароль слишком простой');
      else setAuthError(`Ошибка: ${error.message}`);
    }
  };

  const handleResetPassword = async () => {
    setAuthError(''); setAuthMessage('');
    if (!email) { setAuthError('Введите почту для сброса.'); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      setAuthMessage('Письмо отправлено! Проверьте почту.');
    } catch (error) {
      if (error.code === 'auth/user-not-found') setAuthError('Пользователь не найден.');
      else setAuthError(`Ошибка: ${error.message}`);
    }
  };

  const checkEmailVerification = async () => {
    if (user) {
      await user.reload(); 
      if (user.emailVerified) {
        setEmailVerified(true);
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserProfile(docSnap.data());
          setIsFirstLogin(false);
        } else {
          setIsFirstLogin(true);
        }
      } else {
        alert("Почта еще не подтверждена. Проверьте папку Спам.");
      }
    }
  };

  const resendVerificationEmail = async () => {
    if (user && !isResendingEmail) {
      setIsResendingEmail(true);
      try {
        await sendEmailVerification(user);
        alert("Письмо успешно отправлено повторно!");
      } catch (error) {
        if (error.code === 'auth/too-many-requests') alert("Слишком много попыток. Подождите немного.");
        else alert(`Ошибка отправки: ${error.message}`);
      }
      setIsResendingEmail(false);
    }
  };

  const handleLogout = async () => await signOut(auth);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!userProfile.name.trim() || !user) return;
    setIsProfileSaving(true);
    try {
      await setDoc(doc(db, "users", user.uid), userProfile);
      setIsFirstLogin(false);
    } catch (error) { alert(`Ошибка сохранения: ${error.message}`); } 
    finally { setIsProfileSaving(false); }
  };

  // === ИСПРАВЛЕННАЯ УМНАЯ КНОПКА ЗАПРОСА РАЗРЕШЕНИЙ ===
  const requestNotificationPermission = async () => {
    if (!user) {
      alert("Авторизуйтесь, чтобы получать уведомления.");
      return;
    }
    
    try {
        if (Capacitor.isNativePlatform()) {
          // --- ЛОГИКА ДЛЯ ANDROID (APK) ---
          let permStatus = await PushNotifications.checkPermissions();
          if (permStatus.receive === 'prompt') {
            permStatus = await PushNotifications.requestPermissions();
          }
          if (permStatus.receive !== 'granted') {
            alert("Вы запретили уведомления в настройках телефона.");
            return;
          }
          await PushNotifications.register();
          
        } else {
          // --- ЛОГИКА ДЛЯ ВЕБ (БРАУЗЕР / PWA) ---
          if (!messaging) {
            alert("Push-уведомления не поддерживаются в этом браузере.");
            return;
          }
          if (!('Notification' in window)) {
            alert("Ваш браузер не поддерживает API уведомлений.");
            return;
          }
          
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
            
            // 🔥 Ожидаем готовности воркера перед запросом токена 🔥
            await navigator.serviceWorker.ready;
            
            const token = await getToken(messaging, { 
              vapidKey: VAPID_KEY,
              serviceWorkerRegistration: registration 
            });
            
            if (token) {
              await updateDoc(doc(db, 'users', user.uid), { fcmToken: token });
              setUserProfile(prev => ({ ...prev, fcmToken: token }));
              alert("Отлично! Вы будете получать веб-уведомления.");
            } else {
              alert("Не удалось получить токен.");
            }
          } else {
            alert("Вы запретили уведомления.");
          }
        }
    } catch (error) {
      console.error("Ошибка при настройке уведомлений:", error);
      alert(`Ошибка: ${error.message}`);
    }
  };

  const handleAvatarChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const base64 = await compressImage(e.target.files[0], true);
      setUserProfile({...userProfile, avatar: base64});
    }
  };

  const handleUserClick = async (clickedUserId) => {
    if (!clickedUserId) return;
    if (clickedUserId === user?.uid) {
      setSelectedEvent(null);
      setNavTab('profile');
      return;
    }
    setIsViewingUserLoading(true);
    try {
      const docRef = doc(db, 'users', clickedUserId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setViewingUser({ ...docSnap.data(), id: clickedUserId });
      } else {
        alert("Пользователь не найден");
      }
    } catch (error) { console.error(error); } 
    finally { setIsViewingUserLoading(false); }
  };

  useEffect(() => {
    if (!user || !emailVerified) return;
    const q = query(collection(db, 'direct_chats'), where('participants', 'array-contains', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      chats.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
      setUserChats(chats);
    });
    return () => unsubscribe();
  }, [user, emailVerified]);

  const handleStartDirectChat = async (partner) => {
    if (!user || !partner || !emailVerified) return;
    const existingChat = userChats.find(chat => chat.participants.includes(partner.id));
    if (existingChat) {
      setViewingUser(null);
      setActiveDirectChat({ id: existingChat.id, partner });
    } else {
      try {
        const chatData = {
          participants: [user.uid, partner.id],
          users: {
            [user.uid]: { name: userProfile.name, avatar: userProfile.avatar },
            [partner.id]: { name: partner.name, avatar: partner.avatar }
          },
          updatedAt: new Date().toISOString()
        };
        const newChatRef = await addDoc(collection(db, 'direct_chats'), chatData);
        setViewingUser(null);
        setActiveDirectChat({ id: newChatRef.id, partner });
      } catch (error) {
        alert(`Ошибка создания чата: ${error.message}`);
      }
    }
  };

  useEffect(() => {
    if (!user || !activeDirectChat) { setDirectMessages([]); return; }
    const messagesRef = collection(db, 'direct_chats', activeDirectChat.id, 'messages');
    const unsubscribe = onSnapshot(messagesRef, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      msgs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      setDirectMessages(msgs);
    });
    return () => unsubscribe();
  }, [user, activeDirectChat]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { directMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [directMessages]);

  const handleSendDirectMessage = async (e) => {
    e.preventDefault();
    if (!newDirectMessage.trim() || !user || !activeDirectChat) return;
    try {
      const messageText = newDirectMessage.trim();
      const messagesRef = collection(db, 'direct_chats', activeDirectChat.id, 'messages');
      const now = new Date().toISOString();
      await addDoc(messagesRef, { text: messageText, userId: user.uid, createdAt: now });
      
      await updateDoc(doc(db, 'direct_chats', activeDirectChat.id), { 
          updatedAt: now,
          lastMessage: messageText
      });
      setNewDirectMessage('');

      const partnerId = activeDirectChat.partner.id;
      const partnerDoc = await getDoc(doc(db, 'users', partnerId));
      
      if (partnerDoc.exists() && partnerDoc.data().fcmToken) {
         fetch(`${VERCEL_URL}/api/push`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             token: partnerDoc.data().fcmToken,
             title: userProfile.name,
             body: messageText.length > 50 ? messageText.substring(0, 47) + '...' : messageText
           })
         })
         .then(async (response) => {
             const data = await response.json();
             if (!response.ok) {
                 alert(`Ошибка VERCEL при отправке пуша: ${data.error || JSON.stringify(data)}`);
             }
         })
         .catch(err => alert(`СБОЙ СЕТИ: ${err.message}`));
      }
    } catch (error) { alert(`Ошибка отправки: ${error.message}`); }
  };

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
      const messageText = newMessage.trim();
      const messagesRef = collection(db, 'events', selectedEvent.docId, 'messages');
      await addDoc(messagesRef, { text: messageText, userId: user.uid, userName: userProfile.name || 'Гость', userAvatar: userProfile.avatar || '', createdAt: new Date().toISOString() });
      setNewMessage('');

      if (selectedEvent.attendeesList && selectedEvent.attendeesList.length > 0) {
        selectedEvent.attendeesList.forEach(async (attendee) => {
          if (attendee.id !== user.uid) { 
            const attendeeDoc = await getDoc(doc(db, 'users', attendee.id));
            if (attendeeDoc.exists() && attendeeDoc.data().fcmToken) {
               fetch(`${VERCEL_URL}/api/push`, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({
                   token: attendeeDoc.data().fcmToken,
                   title: `Чат: ${selectedEvent.title}`,
                   body: `${userProfile.name}: ${messageText.length > 30 ? messageText.substring(0, 27) + '...' : messageText}`
                 })
               }).catch(err => console.error('Ошибка API Vercel:', err));
            }
          }
        });
      }
    } catch (error) { alert(`Ошибка отправки: ${error.message}`); }
  };

  useEffect(() => {
    if (!user || !emailVerified) return;
    const eventsRef = collection(db, 'events');
    setIsLoading(true);
    const unsubscribe = onSnapshot(eventsRef, (snapshot) => {
      const eventsData = snapshot.docs.map(doc => ({ ...doc.data(), docId: doc.id }));
      eventsData.sort((a, b) => new Date(a.date) - new Date(b.date));
      setEvents(eventsData);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user, emailVerified]);

  const isEventPast = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return false;
    const eventDateTime = new Date(`${dateStr}T${timeStr}`);
    return eventDateTime < new Date();
  };

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      const isPast = isEventPast(event.date, event.time);
      if (isPast && !showPastEvents) return false;

      if (navTab === 'going') {
        const isParticipant = event.attendeesList?.some(a => a.id === user?.uid);
        const isOrganizer = event.organizerId === user?.uid;
        if (!isParticipant || isOrganizer) return false;
      }
      if (navTab === 'organized') {
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
  }, [events, navTab, searchQuery, selectedCategory, filterCity, filterDate, user, showPastEvents]);

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
    } catch (error) { alert(`Ошибка присоединения: ${error.message}`); }
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
    } catch (error) { alert(`Ошибка выхода: ${error.message}`); }
  };

  const handleDeleteEvent = async (event) => {
    if (!user || !event.docId || event.organizerId !== user.uid) return;
    try {
      const eventRef = doc(db, 'events', event.docId);
      await deleteDoc(eventRef); 
      setSelectedEvent(null);
      setShowDeleteConfirm(false);
    } catch (error) { alert(`Ошибка удаления: ${error.message}`); }
  };

  if (isAuthLoading) {
    return <div className="min-h-[100dvh] bg-gradient-to-br from-orange-50 via-white to-purple-50 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-orange-500" /></div>;
  }

  // 1. ЭКРАН ВХОДА
  if (!user) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-orange-50 via-white to-purple-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white/70 backdrop-blur-xl rounded-[32px] shadow-2xl overflow-hidden border border-white/50">
          <div className="bg-gradient-to-r from-orange-400 to-purple-500 p-10 text-center" style={{ paddingTop: 'max(env(safe-area-inset-top), 2.5rem)' }}>
            <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tight">MeetPoint</h1>
            <p className="text-white/80 font-medium text-lg">Ваши люди, ваши правила</p>
          </div>
          <div className="p-8">
            <div className="flex gap-4 mb-8 bg-gray-50/50 p-1.5 rounded-full">
              <button onClick={() => {setAuthMode('login'); setAuthError(''); setAuthMessage('');}} className={`flex-1 py-2.5 font-bold text-sm rounded-full transition-all ${authMode === 'login' ? 'bg-white shadow-sm text-purple-700' : 'text-gray-500 hover:text-gray-700'}`}>Вход</button>
              <button onClick={() => {setAuthMode('register'); setAuthError(''); setAuthMessage('');}} className={`flex-1 py-2.5 font-bold text-sm rounded-full transition-all ${authMode === 'register' ? 'bg-white shadow-sm text-purple-700' : 'text-gray-500 hover:text-gray-700'}`}>Регистрация</button>
            </div>
            <form onSubmit={handleAuth} className="space-y-5">
              {authError && <div className="p-4 bg-red-50 text-red-600 text-sm rounded-3xl text-center font-semibold border border-red-100">{authError}</div>}
              {authMessage && <div className="p-4 bg-green-50 text-green-600 text-sm rounded-3xl text-center font-semibold border border-green-100">{authMessage}</div>}
              <div><label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Email</label><input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-3xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-800 transition-all" placeholder="ваша@почта.com" /></div>
              <div>
                <div className="flex justify-between items-center mb-1.5 ml-1 mr-1"><label className="block text-sm font-bold text-gray-700">Пароль</label>{authMode === 'login' && <button type="button" onClick={handleResetPassword} className="text-xs text-orange-500 font-bold hover:text-orange-600 transition-colors">Забыли?</button>}</div>
                <div className="relative"><input type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-5 pr-12 py-3.5 bg-gray-50 border-none rounded-3xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-800 transition-all" placeholder="Минимум 6 символов" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-3.5 text-gray-400 hover:text-purple-500 transition-colors">{showPassword ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}</button></div>
              </div>
              <button type="submit" className="w-full mt-6 bg-gradient-to-r from-orange-400 to-purple-500 text-white font-bold py-4 rounded-3xl hover:opacity-90 active:scale-[0.98] transition-all flex justify-center items-center gap-2 shadow-lg shadow-purple-200/50">{authMode === 'login' ? <><LogIn className="w-5 h-5"/> Войти в аккаунт</> : <><UserPlus className="w-5 h-5"/> Создать аккаунт</>}</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // 2. ЭКРАН ВЕРИФИКАЦИИ ПОЧТЫ
  if (user && !emailVerified) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-orange-50 via-white to-purple-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white/80 backdrop-blur-xl rounded-[32px] shadow-2xl p-8 border border-white/50 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-400 to-purple-500"></div>
          
          <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <MailWarning className="w-10 h-10 text-orange-500" />
          </div>
          
          <h2 className="text-2xl font-extrabold text-gray-900 mb-3">Подтвердите почту</h2>
          <p className="text-gray-500 font-medium mb-8 text-sm leading-relaxed">
            Мы отправили письмо на <br/><span className="text-gray-900 font-bold">{user.email}</span>.<br/>
            Перейдите по ссылке внутри, чтобы получить доступ к приложению.
          </p>

          <div className="space-y-4">
            <button onClick={checkEmailVerification} className="w-full bg-gradient-to-r from-orange-400 to-purple-500 text-white font-bold py-4 rounded-3xl hover:shadow-lg transition-all flex justify-center items-center gap-2">
              <RefreshCw className="w-5 h-5" /> Я подтвердил(а) почту
            </button>
            <button onClick={resendVerificationEmail} disabled={isResendingEmail} className="w-full bg-gray-100 text-gray-700 font-bold py-4 rounded-3xl hover:bg-gray-200 transition-all disabled:opacity-50 text-sm">
              {isResendingEmail ? 'Отправка...' : 'Отправить письмо еще раз'}
            </button>
            <button onClick={handleLogout} className="w-full text-red-500 font-bold py-3 text-sm hover:underline">
              Выйти и сменить аккаунт
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. ОСНОВНОЕ ПРИЛОЖЕНИЕ
  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-orange-50 via-white to-purple-50 text-slate-800 font-sans pb-24">
      
      {/* ГЛАВНАЯ ШАПКА */}
      {navTab !== 'profile' && navTab !== 'chats' && (
        <header className="bg-white/40 backdrop-blur-xl border-b border-white/50 sticky top-0 z-30 pt-[env(safe-area-inset-top)] transition-all">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between pb-2 mt-2">
            <h1 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-purple-600 tracking-tight">MeetPoint</h1>
            <div className="flex items-center gap-3">
              <button onClick={requestNotificationPermission} className={`relative p-2 rounded-full transition-all shadow-sm ${userProfile.fcmToken ? 'bg-purple-100 text-purple-600' : 'bg-white/50 text-gray-600 hover:bg-white'}`} title="Включить уведомления">
                {userProfile.fcmToken ? <BellRing className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                {!userProfile.fcmToken && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>}
              </button>
              <button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2 bg-gradient-to-r from-orange-400 to-purple-500 text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95">
                <Plus className="w-4 h-4" /><span className="hidden sm:inline">Создать</span>
              </button>
            </div>
          </div>
        </header>
      )}

      {/* ОСНОВНОЙ КОНТЕНТ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pt-[max(env(safe-area-inset-top),1.5rem)]">
        
        {/* ВКЛАДКИ: ВСЕ, Я ИДУ, МОИ */}
        {(navTab === 'all' || navTab === 'going' || navTab === 'organized') && (
          <>
            <div className="mb-6">
              <div className="flex gap-3 mb-4">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Search className="h-5 w-5 text-gray-400" /></div>
                  <input type="text" placeholder="Найти событие..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="block w-full pl-11 pr-4 py-3.5 bg-white/70 backdrop-blur-md border border-white rounded-full font-medium focus:ring-2 focus:ring-purple-400 outline-none shadow-sm transition-all" />
                </div>
                <button onClick={() => setShowFilters(!showFilters)} className={`p-3.5 rounded-full transition-all shadow-sm flex items-center justify-center border ${showFilters ? 'bg-purple-100 border-purple-200 text-purple-600' : 'bg-white/70 backdrop-blur-md border-white text-gray-500 hover:bg-white'}`}><Filter className="w-5 h-5" /></button>
              </div>

              {showFilters && (
                <div className="mb-5 p-5 bg-white/70 backdrop-blur-xl rounded-[32px] shadow-sm border border-white">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div><label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">Город</label><input type="text" placeholder="Любой" value={filterCity} onChange={(e) => setFilterCity(e.target.value)} className="w-full px-4 py-3 bg-white/80 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-purple-400 outline-none shadow-inner" /></div>
                    <div><label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">Дата</label><input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-full px-4 py-3 bg-white/80 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-purple-400 outline-none text-gray-600 shadow-inner" /></div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/50 rounded-2xl">
                    <span className="text-sm font-bold text-gray-700">Архив событий</span>
                    <button onClick={() => setShowPastEvents(!showPastEvents)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showPastEvents ? 'bg-purple-500' : 'bg-gray-300'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showPastEvents ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex overflow-x-auto pb-2 hide-scrollbar gap-2">
                {CATEGORIES.map(category => (
                  <button key={category} onClick={() => setSelectedCategory(category)} className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-bold transition-all ${selectedCategory === category ? 'bg-gradient-to-r from-orange-400 to-purple-500 text-white shadow-md' : 'bg-white/70 backdrop-blur-md text-gray-600 hover:bg-white shadow-sm border border-white'}`}>{category}</button>
                ))}
              </div>
            </div>

            <h2 className="text-2xl font-extrabold text-gray-900 mb-5 pl-1">
              {navTab === 'all' ? 'Все события' : navTab === 'going' ? 'Вы идёте' : 'Ваши события'}
            </h2>
            
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-purple-400" /></div>
            ) : filteredEvents.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredEvents.map(event => {
                  const isPast = isEventPast(event.date, event.time);
                  return (
                  <div key={event.docId} onClick={() => setSelectedEvent(event)} className={`bg-white/80 backdrop-blur-sm rounded-[32px] p-2 shadow-sm hover:shadow-xl transition-all cursor-pointer group flex flex-col h-full border border-white ${isPast ? 'opacity-60 grayscale-[40%]' : ''}`}>
                    <div className="relative h-48 bg-gray-100 rounded-[28px] overflow-hidden">
                      <img src={event.image} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
                      
                      <div className="absolute top-3 left-3 flex gap-2">
                        <span className="bg-white/90 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-bold text-purple-700 shadow-sm">{event.category}</span>
                        {isPast && <span className="bg-gray-800/90 backdrop-blur-md text-white px-3.5 py-1.5 rounded-full text-xs font-bold shadow-sm">Прошло</span>}
                      </div>

                      {event.organizerId === user?.uid && <div className="absolute top-3 right-3 bg-gradient-to-r from-orange-400 to-purple-500 text-white px-3.5 py-1.5 rounded-full text-xs font-bold shadow-sm">Моё</div>}
                    </div>
                    <div className="p-4 flex flex-col flex-grow relative">
                      <h3 className={`text-xl font-extrabold mb-3 line-clamp-2 leading-tight ${isPast ? 'text-gray-600' : 'text-gray-900'}`}>{event.title}</h3>
                      <div className="space-y-2.5 mb-4 flex-grow">
                        <div className={`flex items-center text-sm font-medium ${isPast ? 'text-gray-500' : 'text-gray-600'}`}><Calendar className={`w-4 h-4 mr-2.5 ${isPast ? 'text-gray-400' : 'text-purple-400'}`} /> <span>{event.date} • {event.time}</span></div>
                        <div className={`flex items-start text-sm font-medium ${isPast ? 'text-gray-500' : 'text-gray-600'}`}><MapPin className={`w-4 h-4 mr-2.5 shrink-0 mt-0.5 ${isPast ? 'text-gray-400' : 'text-orange-400'}`} /> <span className="line-clamp-2">{event.city ? `${event.city}, ` : ''}{event.location}</span></div>
                      </div>
                      <div className="pt-4 border-t border-gray-100 flex items-center justify-between mt-auto">
                        <div className="flex items-center text-sm font-bold text-gray-500"><Users className="w-4 h-4 mr-1.5 text-gray-400" /> {event.attendees}{event.maxAttendees && `/${event.maxAttendees}`}</div>
                        {!isPast && (
                          <button onClick={(e) => { e.stopPropagation(); if (event.organizerId === user?.uid) return; event.attendeesList?.some(a => a.id === user?.uid) ? handleLeaveEvent(event) : handleJoinEvent(event); }} className={`px-5 py-2.5 rounded-full text-sm font-bold z-10 transition-colors ${event.organizerId === user?.uid ? 'bg-gray-100 text-gray-600' : event.attendeesList?.some(a => a.id === user?.uid) ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'}`}>{event.organizerId === user?.uid ? 'Орг' : event.attendeesList?.some(a => a.id === user?.uid) ? 'Не пойду' : 'Пойду'}</button>
                        )}
                      </div>
                    </div>
                  </div>
                )})}
              </div>
            ) : (
              <div className="text-center py-24 bg-white/50 backdrop-blur-xl rounded-[32px] border border-white shadow-sm">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-5 shadow-sm"><Search className="w-8 h-8 text-gray-300"/></div>
                <h3 className="text-xl font-extrabold text-gray-900">Событий не найдено</h3>
                <p className="text-gray-500 mb-4 mt-2 max-w-sm mx-auto font-medium">Попробуйте изменить параметры поиска или создайте свое мероприятие!</p>
              </div>
            )}
          </>
        )}

        {/* ВКЛАДКА: ЧАТЫ */}
        {navTab === 'chats' && (
          <div className="w-full max-w-md mx-auto">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-6 pl-1 tracking-tight">Сообщения</h2>
            {userChats.length > 0 ? (
              <div className="space-y-3">
                {userChats.map(chat => {
                  const partnerId = chat.participants.find(p => p !== user.uid);
                  const partner = chat.users[partnerId];
                  return (
                    <div key={chat.id} onClick={() => setActiveDirectChat({ id: chat.id, partner: { id: partnerId, ...partner } })} className="bg-white/80 backdrop-blur-md rounded-[28px] p-4 flex items-center gap-4 cursor-pointer hover:bg-white transition-all shadow-sm border border-white">
                      <div className="relative w-14 h-14 rounded-full overflow-hidden shrink-0 border-2 border-white shadow-sm">
                        {partner?.avatar ? <img src={partner.avatar} className="w-full h-full object-cover" alt="av" /> : <UserCircle className="w-full h-full text-gray-300 bg-gray-50" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-extrabold text-gray-900 truncate text-lg">{partner?.name || 'Пользователь'}</h4>
                        <p className="text-sm text-gray-500 font-medium truncate mt-0.5">
                          {chat.lastMessage || 'Перейти к переписке...'}
                        </p>
                      </div>
                      <ChevronLeft className="w-5 h-5 text-gray-300 rotate-180 shrink-0" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-20 bg-white/50 backdrop-blur-xl rounded-[32px] border border-white shadow-sm mt-4">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-5 shadow-sm"><MessageCircle className="w-8 h-8 text-gray-300"/></div>
                <h3 className="text-xl font-extrabold text-gray-900">У вас пока нет диалогов</h3>
                <p className="text-gray-500 mt-2 max-w-xs mx-auto font-medium text-sm">Заходите в профили других людей и нажимайте "Написать сообщение", чтобы начать общение.</p>
              </div>
            )}
          </div>
        )}

        {/* ВКЛАДКА: ПРОФИЛЬ */}
        {navTab === 'profile' && (
          <div className="w-full max-w-md mx-auto bg-white/80 backdrop-blur-xl rounded-[32px] overflow-hidden shadow-sm border border-white">
            <div className="px-6 py-5 border-b border-white/50 shrink-0">
              <h3 className="text-2xl font-extrabold text-gray-900 tracking-tight">Настройки профиля</h3>
            </div>
            <form id="profileForm" onSubmit={handleSaveProfile} className="p-6 space-y-5">
              <div className="flex flex-col items-center mb-4">
                <div className="relative w-32 h-32 bg-gray-50 rounded-full flex items-center justify-center overflow-hidden group cursor-pointer border-4 border-white shadow-md">{userProfile.avatar ? <img src={userProfile.avatar} alt="Avatar" className="w-full h-full object-cover" /> : <Camera className="w-10 h-10 text-gray-300" />}<input type="file" accept="image/*" onChange={handleAvatarChange} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" /></div>
                <span className="text-xs text-purple-600 mt-3 font-bold bg-purple-50/50 backdrop-blur-sm border border-purple-100 px-4 py-1.5 rounded-full">Сменить фото</span>
              </div>
              <div><label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Имя и Фамилия *</label><input required type="text" value={userProfile.name} onChange={e => setUserProfile({...userProfile, name: e.target.value})} className="w-full px-5 py-4 bg-white border border-gray-100 rounded-3xl focus:ring-2 focus:ring-purple-400 outline-none font-medium text-gray-800 shadow-inner transition-all" placeholder="Как вас зовут?" /></div>
              <div><label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Ваш город</label><input type="text" value={userProfile.city} onChange={e => setUserProfile({...userProfile, city: e.target.value})} className="w-full px-5 py-4 bg-white border border-gray-100 rounded-3xl focus:ring-2 focus:ring-purple-400 outline-none font-medium text-gray-800 shadow-inner transition-all" placeholder="Москва" /></div>
              <div><label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">О себе и интересы</label><textarea value={userProfile.interests} onChange={e => setUserProfile({...userProfile, interests: e.target.value})} className="w-full px-5 py-4 bg-white border border-gray-100 rounded-3xl focus:ring-2 focus:ring-purple-400 outline-none font-medium text-gray-800 resize-none shadow-inner transition-all" rows="3" placeholder="Расскажите немного о себе..."></textarea></div>
            </form>
            <div className="p-5 border-t border-white/50 bg-white/50 shrink-0 flex flex-col gap-3">
              <button type="submit" form="profileForm" disabled={isProfileSaving} className="w-full bg-gradient-to-r from-orange-400 to-purple-500 text-white font-bold py-4 rounded-3xl hover:opacity-90 transition-all shadow-md disabled:opacity-50">{isProfileSaving ? 'Сохранение...' : 'Сохранить изменения'}</button>
              <button onClick={handleLogout} className="w-full text-red-500 font-bold py-4 rounded-3xl hover:bg-red-50 flex items-center justify-center gap-2 transition-colors border border-red-50"><LogOut className="w-5 h-5" /> Выйти из аккаунта</button>
            </div>
          </div>
        )}

      </main>

      {/* НИЖНЯЯ ПАНЕЛЬ НАВИГАЦИИ */}
      {(!selectedEvent && !activeDirectChat && !isFirstLogin && !isCreateModalOpen && !viewingUser) && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-2xl border-t border-white/50 z-40 pb-[max(env(safe-area-inset-bottom),0.5rem)] shadow-[0_-20px_40px_rgba(0,0,0,0.03)]">
          <div className="flex justify-around items-center h-[72px] max-w-md mx-auto px-2">
            <button onClick={() => setNavTab('all')} className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all duration-300 ${navTab === 'all' ? 'text-purple-600 scale-105' : 'text-gray-400 hover:text-gray-600'}`}><div className={`p-2 rounded-2xl transition-all duration-300 ${navTab === 'all' ? 'bg-purple-50 shadow-sm' : ''}`}><Compass className={`w-6 h-6 ${navTab==='all'?'fill-purple-50':''}`} /></div><span className="text-[10px] font-bold">Все</span></button>
            <button onClick={() => setNavTab('going')} className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all duration-300 ${navTab === 'going' ? 'text-orange-500 scale-105' : 'text-gray-400 hover:text-gray-600'}`}><div className={`p-2 rounded-2xl transition-all duration-300 ${navTab === 'going' ? 'bg-orange-50 shadow-sm' : ''}`}><Ticket className={`w-6 h-6 ${navTab==='going'?'fill-orange-50':''}`} /></div><span className="text-[10px] font-bold">Я иду</span></button>
            <button onClick={() => setNavTab('organized')} className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all duration-300 ${navTab === 'organized' ? 'text-purple-600 scale-105' : 'text-gray-400 hover:text-gray-600'}`}><div className={`p-2 rounded-2xl transition-all duration-300 ${navTab === 'organized' ? 'bg-purple-50 shadow-sm' : ''}`}><Crown className={`w-6 h-6 ${navTab==='organized'?'fill-purple-50':''}`} /></div><span className="text-[10px] font-bold">Мои</span></button>
            <button onClick={() => setNavTab('chats')} className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all duration-300 ${navTab === 'chats' ? 'text-blue-500 scale-105' : 'text-gray-400 hover:text-gray-600'}`}><div className={`p-2 rounded-2xl transition-all duration-300 ${navTab === 'chats' ? 'bg-blue-50 shadow-sm' : ''}`}><MessageCircle className={`w-6 h-6 ${navTab==='chats'?'fill-blue-50':''}`} /></div><span className="text-[10px] font-bold">Чаты</span></button>
            <button onClick={() => setNavTab('profile')} className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all duration-300 ${navTab === 'profile' ? 'text-gray-900 scale-105' : 'text-gray-400 hover:text-gray-600'}`}><div className={`p-1.5 rounded-full transition-all duration-300 border-2 ${navTab === 'profile' ? 'border-gray-900 shadow-sm' : 'border-transparent'}`}>{userProfile.avatar ? <img src={userProfile.avatar} className="w-7 h-7 rounded-full object-cover" alt="av"/> : <User className="w-7 h-7" />}</div><span className="text-[10px] font-bold">Профиль</span></button>
          </div>
        </nav>
      )}

      {/* ОСТАЛЬНЫЕ МОДАЛКИ */}
      {isFirstLogin && (
        <div className="fixed inset-0 z-[100] bg-gray-900/60 backdrop-blur-md flex items-center justify-center p-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] animate-in fade-in duration-300">
          <div className="bg-white rounded-[32px] w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] shadow-2xl">
            <div className="px-6 py-5 border-b border-gray-100 shrink-0 text-center">
              <h3 className="text-2xl font-extrabold text-gray-900">Добро пожаловать!</h3>
              <p className="text-sm text-gray-500 font-medium mt-1">Расскажите о себе, чтобы начать.</p>
            </div>
            <form id="firstProfileForm" onSubmit={handleSaveProfile} className="p-6 overflow-y-auto space-y-5">
              <div className="flex flex-col items-center mb-2">
                <div className="relative w-32 h-32 bg-gray-50 rounded-full flex items-center justify-center overflow-hidden group cursor-pointer border-4 border-white shadow-md">{userProfile.avatar ? <img src={userProfile.avatar} className="w-full h-full object-cover" /> : <Camera className="w-10 h-10 text-gray-300" />}<input type="file" accept="image/*" onChange={handleAvatarChange} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" /></div>
                <span className="text-xs text-purple-600 mt-3 font-bold bg-purple-50 px-4 py-1.5 rounded-full">Добавить фото</span>
              </div>
              <div><label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Имя и Фамилия *</label><input required type="text" value={userProfile.name} onChange={e => setUserProfile({...userProfile, name: e.target.value})} className="w-full px-5 py-4 bg-white border border-gray-100 rounded-3xl focus:ring-2 focus:ring-purple-400 outline-none font-medium text-gray-800 shadow-inner" placeholder="Как вас зовут?" /></div>
              <div><label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Ваш город</label><input type="text" value={userProfile.city} onChange={e => setUserProfile({...userProfile, city: e.target.value})} className="w-full px-5 py-4 bg-white border border-gray-100 rounded-3xl focus:ring-2 focus:ring-purple-400 outline-none font-medium text-gray-800 shadow-inner" placeholder="Москва" /></div>
              <div><label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">О себе и интересы</label><textarea value={userProfile.interests} onChange={e => setUserProfile({...userProfile, interests: e.target.value})} className="w-full px-5 py-4 bg-white border border-gray-100 rounded-3xl focus:ring-2 focus:ring-purple-400 outline-none font-medium text-gray-800 resize-none shadow-inner" rows="3" placeholder="Расскажите немного о себе..."></textarea></div>
            </form>
            <div className="p-5 border-t border-gray-50 bg-gray-50/50 shrink-0">
              <button type="submit" form="firstProfileForm" disabled={isProfileSaving} className="w-full bg-gradient-to-r from-orange-400 to-purple-500 text-white font-bold py-4 rounded-3xl hover:shadow-lg transition-all disabled:opacity-50 text-lg shadow-md">{isProfileSaving ? 'Сохранение...' : 'Поехали!'}</button>
            </div>
          </div>
        </div>
      )}

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[100] bg-gray-900/60 backdrop-blur-md flex items-end sm:items-center justify-center pt-[env(safe-area-inset-top)] animate-in fade-in duration-300">
          <div className="bg-white rounded-t-[32px] sm:rounded-[32px] w-full max-w-lg overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh] shadow-2xl animate-in slide-in-from-bottom-5">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center shrink-0">
              <h3 className="text-2xl font-extrabold text-gray-900">Новое событие</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-2 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors"><X className="w-6 h-6 text-gray-600" /></button>
            </div>
            <form id="createEventForm" onSubmit={handleCreateEvent} className="p-6 overflow-y-auto space-y-5 flex-1">
              <div><label className="block text-sm font-bold text-gray-700 mb-2 ml-1">Обложка</label><div className="relative w-full h-48 bg-gray-50 rounded-[28px] flex flex-col items-center justify-center overflow-hidden border-2 border-dashed border-gray-200 hover:bg-gray-100 transition-colors">{imagePreview ? <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" /> : <div className="text-center text-gray-400"><Camera className="w-10 h-10 mx-auto mb-2 text-purple-300" /><span className="text-sm font-bold">Добавить фото</span></div>}<input type="file" accept="image/*" onChange={handleEventImageChange} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" /></div></div>
              <div><label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Название *</label><input required type="text" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} className="w-full px-5 py-4 bg-white border border-gray-100 rounded-3xl outline-none focus:ring-2 focus:ring-purple-400 font-medium shadow-inner" placeholder="Как назовем встречу?" /></div>
              <div><label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Описание</label><textarea value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})} className="w-full px-5 py-4 bg-white border border-gray-100 rounded-3xl outline-none focus:ring-2 focus:ring-purple-400 font-medium resize-none shadow-inner" rows="3" placeholder="Кратко о главном..."></textarea></div>
              <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Город *</label><input required type="text" value={newEvent.city} onChange={e => setNewEvent({...newEvent, city: e.target.value})} className="w-full px-5 py-4 bg-white border border-gray-100 rounded-3xl outline-none focus:ring-2 focus:ring-purple-400 font-medium shadow-inner" /></div><div><label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Место *</label><input required type="text" value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})} className="w-full px-5 py-4 bg-white border border-gray-100 rounded-3xl outline-none focus:ring-2 focus:ring-purple-400 font-medium shadow-inner" placeholder="Кафе, Парк..." /></div></div>
              <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Дата *</label><input required type="date" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} className="w-full px-4 py-4 bg-white border border-gray-100 rounded-3xl outline-none focus:ring-2 focus:ring-purple-400 font-medium text-gray-600 shadow-inner" /></div><div><label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Время *</label><input required type="time" value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} className="w-full px-4 py-4 bg-white border border-gray-100 rounded-3xl outline-none focus:ring-2 focus:ring-purple-400 font-medium text-gray-600 shadow-inner" /></div></div>
              <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Категория</label><select value={newEvent.category} onChange={e => setNewEvent({...newEvent, category: e.target.value})} className="w-full px-4 py-4 bg-white border border-gray-100 rounded-3xl outline-none focus:ring-2 focus:ring-purple-400 font-medium text-gray-800 shadow-inner">{CATEGORIES.filter(c => c !== 'Все').map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div><div><label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">Лимит людей</label><input type="number" value={newEvent.maxAttendees} onChange={e => setNewEvent({...newEvent, maxAttendees: e.target.value})} className="w-full px-5 py-4 bg-white border border-gray-100 rounded-3xl outline-none focus:ring-2 focus:ring-purple-400 font-medium shadow-inner" placeholder="Без лимита" /></div></div>
            </form>
            <div className="p-5 border-t border-gray-50 bg-gray-50/50 shrink-0 pb-[max(env(safe-area-inset-bottom),1rem)]"><button type="submit" form="createEventForm" disabled={isUploading} className="w-full bg-gradient-to-r from-orange-400 to-purple-500 text-white font-extrabold text-lg py-4 rounded-3xl shadow-md hover:shadow-lg disabled:opacity-50 transition-all">{isUploading ? 'Создание...' : 'Опубликовать событие'}</button></div>
          </div>
        </div>
      )}

      {selectedEvent && (
        <div className="fixed inset-0 z-[90] bg-white flex flex-col h-[100dvh] overflow-hidden animate-in slide-in-from-right duration-300">
          <div className="relative h-[40vh] min-h-[300px] shrink-0 bg-gray-200">
            <img src={selectedEvent.image} className="w-full h-full object-cover" alt="Обложка" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10"></div>
            <button onClick={() => { setSelectedEvent(null); setActiveTab('info'); }} className="absolute top-4 left-4 bg-white/20 backdrop-blur-md text-white p-3 rounded-full hover:bg-white/40 transition-colors z-10 mt-[env(safe-area-inset-top)] border border-white/30"><ChevronLeft className="w-6 h-6" /></button>
            <div className="absolute bottom-0 inset-x-0 p-6 pt-20">
              <div className="flex gap-2 mb-3"><span className="px-4 py-1.5 bg-white/20 backdrop-blur-md text-white text-xs font-bold rounded-full inline-block shadow-sm border border-white/30">{selectedEvent.category}</span>{isEventPast(selectedEvent.date, selectedEvent.time) && <span className="px-4 py-1.5 bg-gray-800/80 backdrop-blur-md text-white text-xs font-bold rounded-full inline-block shadow-sm">Прошло</span>}</div>
              <h2 className="text-3xl font-extrabold text-white leading-tight drop-shadow-md">{selectedEvent.title}</h2>
            </div>
          </div>
          <div className="flex px-6 shrink-0 bg-white border-b border-gray-100 shadow-sm relative z-10 rounded-t-[32px] -mt-8">
            <button onClick={() => setActiveTab('info')} className={`py-6 mr-8 font-extrabold border-b-[3px] transition-colors ${activeTab === 'info' ? 'border-purple-500 text-purple-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>О событии</button>
            <button onClick={() => setActiveTab('chat')} className={`py-6 font-extrabold border-b-[3px] flex items-center gap-2 transition-colors ${activeTab === 'chat' ? 'border-orange-400 text-orange-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}><MessageSquare className="w-5 h-5" /> Чат участников</button>
          </div>
          <div className="flex-1 overflow-y-auto bg-gray-50/50">
            {activeTab === 'info' ? (
              <div className="p-6 pb-24">
                <div className="grid grid-cols-1 gap-4 mb-8">
                  <div className="flex gap-4 items-center bg-white p-5 rounded-[28px] shadow-sm border border-gray-100"><div className="bg-purple-50 p-3 rounded-2xl"><Calendar className="w-7 h-7 text-purple-500" /></div><div><p className="font-extrabold text-gray-900 text-lg">{selectedEvent.date}</p><p className="text-sm text-gray-500 font-medium">{selectedEvent.time}</p></div></div>
                  <div className="flex gap-4 items-center bg-white p-5 rounded-[28px] shadow-sm border border-gray-100"><div className="bg-orange-50 p-3 rounded-2xl"><MapPin className="w-7 h-7 text-orange-500" /></div><div><p className="font-extrabold text-gray-900 text-lg">{selectedEvent.city}</p><p className="text-sm text-gray-500 font-medium">{selectedEvent.location}</p></div></div>
                  <div className="flex gap-4 items-center bg-white p-5 rounded-[28px] shadow-sm border border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => handleUserClick(selectedEvent.organizerId)}><div className="bg-blue-50 p-3 rounded-2xl"><Crown className="w-7 h-7 text-blue-500" /></div><div><p className="font-extrabold text-gray-900 text-lg line-clamp-1">{selectedEvent.organizer}</p><p className="text-sm text-gray-500 font-medium">Организатор</p></div></div>
                </div>
                <div className="mb-10 bg-white p-6 rounded-[32px] shadow-sm border border-gray-100"><h4 className="text-xl font-extrabold mb-4 text-gray-900">Описание</h4><p className="text-gray-600 whitespace-pre-wrap leading-relaxed text-[15px]">{selectedEvent.description || 'Организатор не оставил описание, но точно будет круто!'}</p></div>
                <div>
                  <h4 className="text-xl font-extrabold mb-5 text-gray-900 flex items-center gap-3">Участники <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm">{selectedEvent.attendeesList?.length}</span></h4>
                  <div className="flex flex-wrap gap-3">
                    {selectedEvent.attendeesList?.map(attendee => (
                      <div key={attendee.id} onClick={() => handleUserClick(attendee.id)} className="flex items-center gap-3 bg-white pr-5 pl-2 py-2 rounded-full border border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow">{attendee.avatar ? <img src={attendee.avatar} className="w-10 h-10 rounded-full object-cover" alt="av" /> : <UserCircle className="w-10 h-10 text-gray-300" />}<span className="text-sm font-bold text-gray-800">{attendee.name}</span>{attendee.id === selectedEvent.organizerId && <span className="text-[10px] uppercase font-extrabold bg-gradient-to-r from-orange-400 to-purple-500 text-white px-2 py-1 rounded-full shadow-sm">Орг</span>}</div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full bg-white">
                {!isParticipant ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50/50"><div className="w-24 h-24 bg-gradient-to-br from-orange-100 to-purple-100 rounded-full flex items-center justify-center mb-6 shadow-sm border-4 border-white"><MessageSquare className="w-10 h-10 text-purple-500" /></div><h3 className="text-2xl font-extrabold mb-3 text-gray-900">Приватный чат</h3><p className="text-gray-500 mb-8 font-medium">Общение доступно только для участников. Присоединяйтесь!</p></div>
                ) : (
                  <><div className="flex-1 p-5 space-y-6 overflow-y-auto pb-10">{messages.map(msg => (<div key={msg.id} className={`flex flex-col ${msg.userId === user?.uid ? 'items-end' : 'items-start'}`}><div onClick={() => handleUserClick(msg.userId)} className="flex items-center gap-2 mb-1.5 px-1 cursor-pointer">{msg.userId !== user?.uid && msg.userAvatar && <img src={msg.userAvatar} className="w-6 h-6 rounded-full object-cover shadow-sm" alt="av" />}<span className="text-[12px] font-bold text-gray-400 hover:text-purple-500">{msg.userName}</span></div><div className={`px-5 py-3.5 rounded-3xl max-w-[85%] text-[15px] font-medium leading-relaxed shadow-sm ${msg.userId === user?.uid ? 'bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>{msg.text}</div></div>))} <div ref={messagesEndRef} /></div><form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-100 flex gap-3 shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.03)] pb-[max(env(safe-area-inset-bottom),1rem)]"><input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Написать в чат..." className="flex-1 px-6 py-4 bg-gray-50 border-none rounded-full outline-none focus:ring-2 focus:ring-purple-400 font-medium" /><button type="submit" disabled={!newMessage.trim()} className="bg-gradient-to-r from-orange-400 to-purple-500 text-white w-14 h-14 flex items-center justify-center rounded-full disabled:opacity-50 shadow-md hover:shadow-lg transition-all"><Send className="w-5 h-5 ml-1" /></button></form></>
                )}
              </div>
            )}
          </div>
          {activeTab === 'info' && (
            <div className="p-4 sm:p-5 bg-white/90 backdrop-blur-xl border-t border-gray-100 flex justify-between items-center shrink-0 shadow-[0_-20px_40px_rgba(0,0,0,0.05)] pb-[max(env(safe-area-inset-bottom),1rem)]">
              {selectedEvent.organizerId === user?.uid ? (
                showDeleteConfirm ? (<div className="flex gap-3 w-full animate-in fade-in"><button onClick={() => handleDeleteEvent(selectedEvent)} className="flex-1 py-4 bg-red-500 text-white font-bold rounded-3xl shadow-sm hover:bg-red-600">Точно удалить</button><button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-4 bg-gray-100 text-gray-700 font-bold rounded-3xl hover:bg-gray-200">Отмена</button></div>) : (<button onClick={() => setShowDeleteConfirm(true)} className="w-full py-4 bg-red-50 text-red-500 font-bold rounded-3xl flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"><Trash2 className="w-5 h-5"/> Удалить событие</button>)
              ) : isParticipant ? (
                <button onClick={() => handleLeaveEvent(selectedEvent)} className="w-full py-4 bg-gray-100 text-gray-600 font-bold rounded-3xl flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"><CalendarOff className="w-5 h-5"/> Отменить участие</button>
              ) : isEventPast(selectedEvent.date, selectedEvent.time) ? (
                <button disabled className="w-full py-4 bg-gray-200 text-gray-500 font-extrabold text-lg rounded-3xl transition-all">Событие завершено</button>
              ) : (
                <button onClick={() => handleJoinEvent(selectedEvent)} disabled={selectedEvent.maxAttendees && selectedEvent.attendees >= selectedEvent.maxAttendees} className="w-full py-4 bg-gradient-to-r from-orange-400 to-purple-500 text-white font-extrabold text-lg rounded-3xl shadow-lg hover:shadow-xl disabled:opacity-50 transition-all">Присоединиться</button>
              )}
            </div>
          )}
        </div>
      )}

      {viewingUser && (
         <div className="fixed inset-0 z-[110] bg-gray-900/60 backdrop-blur-md flex items-center justify-center p-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] animate-in fade-in duration-200">
           <div className="bg-white rounded-[32px] w-full max-w-sm overflow-hidden flex flex-col shadow-2xl relative animate-in zoom-in-95">
             {isViewingUserLoading ? (
                <div className="p-16 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>
             ) : (
               <>
                 <div className="absolute top-4 right-4 z-10"><button onClick={() => setViewingUser(null)} className="p-2 bg-black/20 hover:bg-black/30 text-white rounded-full transition-colors backdrop-blur-md border border-white/20"><X className="w-5 h-5" /></button></div>
                 <div className="bg-gradient-to-br from-orange-300 to-purple-400 h-32 relative"></div>
                 <div className="px-6 pb-6 pt-0 relative flex flex-col items-center">
                    <div className="w-28 h-28 bg-white rounded-full flex items-center justify-center overflow-hidden border-4 border-white shadow-md -mt-14 mb-4">{viewingUser.avatar ? <img src={viewingUser.avatar} alt="Avatar" className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full text-gray-300 bg-gray-50" />}</div>
                    <h3 className="text-2xl font-extrabold text-gray-900 text-center">{viewingUser.name}</h3>
                    {viewingUser.city && <div className="flex items-center gap-1.5 mt-2 text-gray-500 font-medium bg-gray-50 px-4 py-1.5 rounded-full border border-gray-100"><MapPin className="w-4 h-4 text-orange-400"/> {viewingUser.city}</div>}
                    {viewingUser.interests && (<div className="mt-6 w-full bg-gray-50 p-5 rounded-3xl border border-gray-100"><p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">О себе</p><p className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">{viewingUser.interests}</p></div>)}
                    {user?.uid !== viewingUser.id && (<button onClick={() => handleStartDirectChat(viewingUser)} className="mt-6 w-full py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-extrabold rounded-3xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"><MessageCircle className="w-5 h-5"/> Написать сообщение</button>)}
                 </div>
               </>
             )}
           </div>
         </div>
      )}

      {activeDirectChat && (
        <div className="fixed inset-0 z-[120] bg-white flex flex-col h-[100dvh] overflow-hidden animate-in slide-in-from-right duration-300">
           <div className="flex items-center gap-3 px-4 h-16 shrink-0 bg-white border-b border-gray-100 shadow-sm pt-[env(safe-area-inset-top)] pb-2 relative z-10 box-content">
             <button onClick={() => setActiveDirectChat(null)} className="p-2 -ml-2 text-gray-500 hover:text-gray-800 transition-colors"><ChevronLeft className="w-7 h-7" /></button>
             <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => handleUserClick(activeDirectChat.partner.id)}>
               <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-100 shrink-0">{activeDirectChat.partner.avatar ? <img src={activeDirectChat.partner.avatar} className="w-full h-full object-cover" alt="av" /> : <UserCircle className="w-full h-full text-gray-300" />}</div>
               <div><h3 className="font-extrabold text-gray-900 leading-tight">{activeDirectChat.partner.name}</h3><span className="text-[11px] font-bold text-blue-500">Личный чат</span></div>
             </div>
           </div>
           
           <div className="flex-1 p-5 space-y-6 overflow-y-auto bg-gray-50/50 pb-10">
              {directMessages.length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-full text-center text-gray-400"><MessageCircle className="w-12 h-12 mb-3 text-gray-300" /><p className="font-medium">Это начало вашей переписки.</p><p className="text-sm">Скажите «Привет!»</p></div>
              ) : (
                directMessages.map(msg => (
                  <div key={msg.id} className={`flex flex-col ${msg.userId === user?.uid ? 'items-end' : 'items-start'}`}><div className={`px-5 py-3.5 rounded-3xl max-w-[85%] text-[15px] font-medium leading-relaxed shadow-sm ${msg.userId === user?.uid ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm'}`}>{msg.text}</div></div>
                ))
              )}
              <div ref={directMessagesEndRef} />
           </div>

           <form onSubmit={handleSendDirectMessage} className="p-4 bg-white border-t border-gray-100 flex gap-3 shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.03)] pb-[max(env(safe-area-inset-bottom),1rem)]">
              <input type="text" value={newDirectMessage} onChange={e => setNewDirectMessage(e.target.value)} placeholder="Написать сообщение..." className="flex-1 px-6 py-4 bg-gray-50 border-none rounded-full outline-none focus:ring-2 focus:ring-blue-400 font-medium" />
              <button type="submit" disabled={!newDirectMessage.trim()} className="bg-gradient-to-r from-blue-500 to-blue-600 text-white w-14 h-14 flex items-center justify-center rounded-full disabled:opacity-50 shadow-md hover:shadow-lg transition-all"><Send className="w-5 h-5 ml-1" /></button>
           </form>
        </div>
      )}
    </div>
  );
}