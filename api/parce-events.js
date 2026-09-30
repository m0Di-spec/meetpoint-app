import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Инициализация Firebase Admin (переиспользуем ключи от пуш-уведомлений)
let initError = null;
if (!getApps().length) {
  try {
    const formattedKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: formattedKey,
      }),
    });
  } catch (error) {
    initError = error.message;
  }
}

// Функция для очистки HTML-тегов (KudaGo присылает описание с тегами <p>, <br>)
const stripHtml = (html) => {
  if (!html) return '';
  return html.replace(/<[^>]*>?/gm, '').trim();
};

// Функция для определения нашей категории на основе категорий KudaGo
const mapCategory = (kudagoCategories) => {
  if (!kudagoCategories || kudagoCategories.length === 0) return 'Другое';
  const cats = kudagoCategories.join(',');
  if (cats.includes('cinema')) return 'Кино';
  if (cats.includes('concert') || cats.includes('music')) return 'Музыка';
  if (cats.includes('education')) return 'Образование';
  if (cats.includes('theater') || cats.includes('exhibition') || cats.includes('art')) return 'Искусство';
  if (cats.includes('party') || cats.includes('food')) return 'Еда и напитки';
  if (cats.includes('sport')) return 'Спорт';
  return 'Другое';
};

export default async function handler(req, res) {
  // 1. ЗАЩИТА: Проверяем секретный пароль, чтобы кто попало не мог запустить парсер
  const { secret } = req.query;
  const MY_SECRET = process.env.PARSER_SECRET || 'meetpoint2024'; 
  
  if (secret !== MY_SECRET) {
    return res.status(401).json({ error: 'Неверный секретный ключ' });
  }

  if (initError) return res.status(500).json({ error: "Ошибка Firebase", details: initError });

  try {
    const db = getFirestore();
    // Получаем текущее время в секундах (требование KudaGo)
    const now = Math.floor(Date.now() / 1000);
    
    // 2. ЗАПРОС К KUDAGO: location=rnd (Ростов), актуальные события, с картинками и местом
    const url = `https://kudago.com/public-api/v1.4/events/?location=rnd&actual_since=${now}&fields=id,title,description,dates,images,place,categories&expand=place&page_size=10`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Сбой при обращении к KudaGo');
    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
        return res.status(200).json({ success: true, message: 'Нет новых событий для парсинга' });
    }

    let addedCount = 0;

    // 3. ОБРАБОТКА И СОХРАНЕНИЕ В MEETPOINT
    for (const item of data.results) {
       // Защита от дубликатов: проверяем, нет ли уже события с таким externalId
       const existingSnap = await db.collection('events').where('externalId', '==', item.id.toString()).get();
       if (!existingSnap.empty) continue; // Пропускаем, если уже есть в базе

       // Берем первую дату проведения
       const firstDate = item.dates[0];
       if (!firstDate || !firstDate.start) continue;

       // Конвертируем дату из формата Unix (секунды) в объекты JS
       const startDate = new Date(firstDate.start * 1000);
       
       // Форматируем для MeetPoint: YYYY-MM-DD и HH:MM
       const dateString = startDate.toISOString().split('T')[0];
       const timeString = startDate.toTimeString().substring(0, 5); // берем "HH:MM"

       // Берем картинку (если есть)
       const imageUrl = item.images && item.images.length > 0 ? item.images[0].image : 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&q=80&w=600';

       // Название места
       let locationName = 'Ростов-на-Дону';
       if (item.place && item.place.title) locationName = item.place.title;
       else if (item.place && item.place.address) locationName = item.place.address;

       // Собираем объект в формате MeetPoint
       const newEvent = {
         title: item.title.charAt(0).toUpperCase() + item.title.slice(1), // Делаем первую букву заглавной
         description: stripHtml(item.description),
         city: 'Ростов-на-Дону',
         location: locationName,
         date: dateString,
         time: timeString,
         category: mapCategory(item.categories),
         image: imageUrl,
         organizer: 'Афиша KudaGo', // Помечаем, что это из парсера
         organizerId: 'kudago-bot', 
         attendees: 0,
         attendeesList: [],
         externalId: item.id.toString(), // Уникальный ID из KudaGo для защиты от дублей
         createdAt: new Date().toISOString()
       };

       // Сохраняем в Firebase
       await db.collection('events').add(newEvent);
       addedCount++;
    }

    return res.status(200).json({ 
        success: true, 
        message: 'Парсинг успешно завершен', 
        addedEvents: addedCount 
    });

  } catch (error) {
    console.error('Ошибка парсера:', error);
    return res.status(500).json({ error: error.message });
  }
}