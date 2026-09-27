const admin = require('firebase-admin');

// Инициализация Firebase Admin с использованием скрытых переменных окружения Vercel
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Заменяем экранированные переносы строк на реальные (требование ключей Google)
        privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
      }),
    });
  } catch (error) {
    console.error('Ошибка инициализации Firebase Admin:', error.stack);
  }
}

// Эта функция запускается, когда наше приложение обращается к /api/push
module.exports = async (req, res) => {
  // Разрешаем только POST-запросы
  if (req.method !== 'POST') {
    return res.status(405).send('Метод не разрешен');
  }

  const { token, title, body, data } = req.body;

  if (!token) {
    return res.status(400).send('Не указан токен получателя');
  }

  try {
    const payload = {
      notification: { title, body },
      token: token
    };
    
    // Если есть дополнительные скрытые данные (например, ID чата), добавляем их
    if (data) payload.data = data;

    // Отправляем Push-уведомление через серверы Google
    const response = await admin.messaging().send(payload);
    res.status(200).json({ success: true, messageId: response });
  } catch (error) {
    console.error('Ошибка отправки уведомления:', error);
    res.status(500).json({ error: error.message });
  }
};