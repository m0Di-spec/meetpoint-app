const admin = require('firebase-admin');

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
      }),
    });
  } catch (error) {
    console.error('Ошибка инициализации Firebase Admin:', error.stack);
  }
}

const db = admin.firestore();

// Эта функция будет вызываться бесплатным роботом каждые 15 минут
module.exports = async (req, res) => {
  try {
    const now = new Date();
    // Ищем события, которые начнутся через 50-65 минут
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    const timeLowerBound = new Date(oneHourFromNow.getTime() - 15 * 60 * 1000); // 45 мин от сейчас

    // Переводим текущую дату в строку формата YYYY-MM-DD
    const todayStr = now.toISOString().split('T')[0];
    
    // Берем события на сегодня
    const eventsSnapshot = await db.collection('events').where('date', '==', todayStr).get();
    
    if (eventsSnapshot.empty) {
        return res.status(200).send('Нет событий на сегодня.');
    }

    const promises = [];

    eventsSnapshot.forEach(docSnap => {
        const event = docSnap.data();
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
                     }
                 });
            }
        }
    });

    await Promise.all(promises);
    res.status(200).json({ success: true, message: 'Рассылка завершена' });

  } catch (error) {
    console.error('Ошибка в планировщике:', error);
    res.status(500).json({ error: error.message });
  }
};