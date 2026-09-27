const admin = require('firebase-admin');

// Глобальная переменная для отлова ошибок инициализации
let initError = null;

if (!admin.apps.length) {
  try {
    // Безопасная проверка: если ключей вообще нет, падаем с понятной ошибкой
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
      throw new Error("Missing Firebase Environment Variables in Vercel.");
    }

    const rawKey = process.env.FIREBASE_PRIVATE_KEY;
    // Осторожно парсим ключ, обрабатывая двойные слэши, если Vercel их добавил
    const formattedKey = rawKey.replace(/\\n/g, '\n');

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: formattedKey,
      }),
    });
  } catch (error) {
    console.error('CRITICAL: Ошибка инициализации Firebase Admin:', error);
    // Сохраняем ошибку, чтобы показать её в запросе, а не падать с 503
    initError = error.message; 
  }
}

// Эта функция будет вызываться роботом
module.exports = async (req, res) => {
  // 1. Проверяем, не сломалась ли инициализация на старте
  if (initError) {
    return res.status(500).json({ 
      error: "Инициализация Firebase Admin провалилась. Проверьте ключи в Vercel.", 
      details: initError 
    });
  }

  try {
    const db = admin.firestore();
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
        // ВАЖНО: обрабатываем ситуацию, когда время не задано
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
                         promises.push(admin.messaging().send(payload));
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
    // Возвращаем понятную 500 ошибку, а не падаем жестко
    return res.status(500).json({ error: "Внутренняя ошибка сервера", details: error.message });
  }
};