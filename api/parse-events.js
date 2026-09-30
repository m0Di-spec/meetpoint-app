import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Инициализация Firebase Admin
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

// Очистка от HTML-тегов
const stripHtml = (html) => {
  if (!html) return '';
  return html.replace(/<[^>]*>?/gm, '').trim();
};

export default async function handler(req, res) {
  const { secret } = req.query;
  const MY_SECRET = process.env.PARSER_SECRET || 'meetpoint2024'; 
  
  if (secret !== MY_SECRET) {
    return res.status(401).json({ error: 'Неверный секретный ключ' });
  }

  if (initError) return res.status(500).json({ error: "Ошибка Firebase", details: initError });

  try {
    const db = getFirestore();
    const today = new Date().toISOString().split('T')[0];
    
    // Ищем события сразу в двух городах
    const targetCities = 'Ростов-на-Дону,Таганрог';
    const citiesQuery = encodeURIComponent(targetCities);
    
    // Увеличили лимит до 20, чтобы захватить больше событий
    const url = `https://api.timepad.ru/v1/events?cities=${citiesQuery}&limit=20&sort=+starts_at&starts_at_min=${today}&access_statuses=public`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Timepad ответил ошибкой: ${response.status} - ${errorText.substring(0, 100)}`);
    }

    const data = await response.json();
    
    if (!data.values || data.values.length === 0) {
        return res.status(200).json({ success: true, message: 'Нет новых событий для парсинга' });
    }

    let addedCount = 0;

    for (const item of data.values) {
       // Проверка на дубликаты
       const existingSnap = await db.collection('events').where('externalId', '==', item.id.toString()).get();
       if (!existingSnap.empty) continue; 

       if (!item.starts_at) continue;

       const [datePart, timePartRaw] = item.starts_at.split('T');
       const dateString = datePart;
       const timeString = timePartRaw.substring(0, 5); 

       const imageUrl = item.poster_image && item.poster_image.default_url 
            ? item.poster_image.default_url 
            : 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&q=80&w=600';

       // Определяем точный город из ответа Timepad
       let eventCity = 'Ростов-на-Дону'; // По умолчанию
       if (item.location && item.location.city) {
           eventCity = item.location.city;
       }

       // Получаем адрес
       let locationName = eventCity;
       if (item.location && item.location.address) {
           locationName = item.location.address;
       }

       // Определяем категорию
       let category = 'Другое';
       if (item.categories && item.categories.length > 0) {
            const catName = item.categories[0].name.toLowerCase();
            if (catName.includes('кино')) category = 'Кино';
            else if (catName.includes('музык') || catName.includes('концерт')) category = 'Музыка';
            else if (catName.includes('образован') || catName.includes('лекци') || catName.includes('бизнес')) category = 'Образование';
            else if (catName.includes('театр') || catName.includes('выставк') || catName.includes('искусств')) category = 'Искусство';
            else if (catName.includes('еда') || catName.includes('вечерин')) category = 'Еда и напитки';
            else if (catName.includes('спорт') || catName.includes('игр')) category = 'Спорт';
       }

       const organizerName = item.organization ? item.organization.name : 'Афиша Timepad';

       const newEvent = {
         title: item.name.charAt(0).toUpperCase() + item.name.slice(1), 
         description: stripHtml(item.description_html || item.description_short),
         city: eventCity, // Записываем правильный город
         location: locationName,
         date: dateString,
         time: timeString,
         category: category,
         image: imageUrl,
         organizer: organizerName, 
         organizerId: 'timepad-bot', 
         attendees: 0,
         attendeesList: [],
         externalId: item.id.toString(), 
         createdAt: new Date().toISOString()
       };

       await db.collection('events').add(newEvent);
       addedCount++;
    }

    return res.status(200).json({ 
        success: true, 
        message: 'Парсинг успешно завершен', 
        addedEvents: addedCount 
    });

  } catch (error) {
    console.error('Ошибка парсера Timepad:', error);
    return res.status(500).json({ error: error.message });
  }
}