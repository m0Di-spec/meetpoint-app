import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

// Глобальная переменная для отлова ошибок инициализации
let initError = null;

if (!getApps().length) {
  try {
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
      throw new Error("Отсутствуют переменные окружения Firebase в Vercel.");
    }

    const formattedKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: formattedKey,
      }),
    });
  } catch (error) {
    console.error('CRITICAL: Ошибка инициализации Firebase Admin:', error);
    initError = error.message; 
  }
}

// Современный экспорт функции
export default async function handler(req, res) {
  // 1. Проверяем, не сломалась ли инициализация на старте
  if (initError) {
    return res.status(500).json({ 
      error: "Инициализация Firebase Admin провалилась. Проверьте ключи в Vercel.", 
      details: initError 
    });
  }

  try {
    const db = getFirestore();
    const now = new Date();
    
    // Ищем события, которые начнутся через 50-65 минут
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    const timeLowerBound = new Date(oneHourFromNow.getTime() - 15 * 60 * 1000); // 45 мин от сейчас

    // Переводим текущую дату в строку формата YYYY-MM-DD
    const todayStr = now.toISOString().split('T')[0];
    
    // Берем события на сегодня
    const eventsSnapshot = await db.collection('events').where('date', '==', todayStr).get();
    
    if (eventsSnapshot.empty) {
        return res.status(200).json({ success: true, message: 'Нет событий на сегодня.' });
    }

    const promises = [];
    let notificationsSent = 0;

    eventsSnapshot.forEach(docSnap => {
        const event = docSnap.data();
        if (!event.time) return;

        const eventDateTime = new Date(`${event.date}T${event.time}`);

        // Если событие начинается примерно через час
        if (eventDateTime >= timeLowerBound && eventDateTime <= oneHourFromNow) {
            if (event.attendeesList && event.attendeesList.length > 0) {
                 event.attendeesList.forEach(async (attendee) => {
                     // Запрашиваем токен участника
                     const userDoc = await db.collection('users').doc(attendee.id).get();
                     if (userDoc.exists && userDoc.data().fcmToken) {
                         const payload = {
                             notification: {
                                 title: `Скоро начало!`,
                                 body: `Событие "${event.title}" начнется через час по адресу ${event.location}.`
                             },
                             token: userDoc.data().fcmToken
                         };
                         promises.push(getMessaging().send(payload));
                         notificationsSent++;
                     }
                 });
            }
        }
    });

    await Promise.all(promises);
    return res.status(200).json({ 
      success: true, 
      message: 'Рассылка завершена',
      sentCount: notificationsSent
    });

  } catch (error) {
    console.error('Ошибка в логике планировщика:', error);
    return res.status(500).json({ error: "Внутренняя ошибка сервера", details: error.message });
  }
}