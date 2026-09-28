import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

// Инициализация Firebase Admin
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
    console.error('Ошибка инициализации Firebase Admin в push.js:', error);
  }
}

export default async function handler(req, res) {
  // 1. НАСТРОЙКА CORS (Разрешаем запросы с любых устройств и браузеров)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 2. ОТВЕТ НА ПРОВЕРОЧНЫЙ ЗАПРОС (Preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 3. ОСНОВНАЯ ЛОГИКА (только для POST)
  if (req.method !== 'POST') {
    return res.status(405).send('Метод не разрешен. Используйте POST.');
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
    
    if (data) payload.data = data;

    const response = await getMessaging().send(payload);
    return res.status(200).json({ success: true, messageId: response });
  } catch (error) {
    console.error('Ошибка отправки уведомления:', error);
    return res.status(500).json({ error: error.message });
  }
}