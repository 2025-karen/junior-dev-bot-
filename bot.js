require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');

// === Твои настройки ===
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;     // ТОЛЬКО число, например -1003593858012
const INVITE_LINK = process.env.INVITE_LINK || 'https://t.me/codecrew_entrybot'; // запасная ссылка
const ADMIN_ID = Number(process.env.ADMIN_ID || 7918849670);

// Проверка обязательных переменных
if (!BOT_TOKEN) {
  console.error('Ошибка: BOT_TOKEN не указан в .env');
  process.exit(1);
}
if (!CHANNEL_ID) {
  console.error('Ошибка: CHANNEL_ID не указан в .env (нужен числовой ID канала)');
  process.exit(1);
}

// Объявляем бота (это было пропущено — из-за этого и падало!)
const bot = new Telegraf(BOT_TOKEN);

// Хранилище уникальных пользователей (в памяти — для теста)
const users = new Set();

// Проверка подписки
async function isSubscribed(ctx) {
  try {
    const member = await ctx.telegram.getChatMember(CHANNEL_ID, ctx.from.id);
    return ['member', 'administrator', 'creator', 'restricted'].includes(member.status);
  } catch (err) {
    console.error('Ошибка проверки подписки:', err.message);
    return false;
  }
}

// /start
bot.start(async (ctx) => {
  users.add(ctx.from.id);

  const isSub = await isSubscribed(ctx);

  const caption = isSub
    ? '🎉 Добро пожаловать в ShortLink Bot!\n\n' +
      'Что умеет этот бот:\n' +
      '• Мгновенно сокращает любые длинные ссылки\n' +
      '• Работает бесплатно и без рекламы\n' +
      '• Просто пришли ссылку — получи короткую 🔥\n\n' +
      'Пример: https://www.youtube.com/watch?v=dQw4w9WgXcQ\n\n' +
      'Админ-панель (только для тебя): /admin'
    : '🔒 Чтобы пользоваться ботом, подпишись на канал!\n\n' +
      'После подписки нажми "Я подписался" или напиши /start заново 👇';

  const keyboard = isSub
    ? Markup.inlineKeyboard([
        [Markup.button.callback('🔗 Сократить ссылку', 'shorten')]
      ])
    : Markup.inlineKeyboard([
        [Markup.button.url('📢 Подписаться на канал', INVITE_LINK)],
        [Markup.button.callback('✅ Я подписался', 'check_sub')]
      ]);

  await ctx.replyWithPhoto(
    'https://images.unsplash.com/photo-1614680376408-81e91ffe3db7?w=800',
    {
      caption,
      reply_markup: keyboard.reply_markup
    }
  );
});

// Проверка подписки после кнопки
bot.action('check_sub', async (ctx) => {
  await ctx.answerCbQuery();
  if (await isSubscribed(ctx)) {
    await ctx.editMessageCaption(
      'Отлично! Теперь можешь сокращать ссылки 🔥\n\n' +
      'Просто пришли мне любую длинную ссылку!'
    );
  } else {
    await ctx.answerCbQuery('Подписка не найдена 😕 Проверь канал', { show_alert: true });
  }
});

// Сокращение ссылок
bot.on('text', async (ctx) => {
  if (ctx.message.text.startsWith('/')) return;

  if (!(await isSubscribed(ctx))) {
    return ctx.reply('🚫 Подпишись на канал, чтобы использовать бота!');
  }

  const url = ctx.message.text.trim();

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return ctx.reply('Это не похоже на ссылку 😅\nПришли нормальную ссылку.');
  }

  await ctx.reply('Сокращаю... ⏳');

  try {
    const response = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
    const shortUrl = response.data;

    if (shortUrl && shortUrl.startsWith('https://tinyurl.com')) {
      await ctx.reply(
        `Готово! 🔥\n\n` +
        `Короткая ссылка: ${shortUrl}\n` +
        `Оригинал: ${url}\n\n` +
        'Пришли ещё одну, если хочешь!'
      );
    } else {
      await ctx.reply('Не получилось сократить 😔\nПопробуй другую ссылку.');
    }
  } catch (err) {
    console.error(err);
    await ctx.reply('Ошибка при сокращении 😢\nПопробуй позже.');
  }
});

// Админ-панель
bot.command('admin', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) {
    return ctx.reply('Доступ запрещён 😈');
  }

  const userCount = users.size;
  const text = `📊 Админ-панель\n\n` +
    `Уникальных пользователей: ${userCount}\n` +
    `Канал: ${CHANNEL_ID}\n` +
    `Бот онлайн: ${new Date().toLocaleString('ru-RU')}\n\n` +
    'Статистика обновляется при каждом /start';

  await ctx.reply(text);
});

// Запуск бота
bot.launch()
  .then(() => console.log('Бот запущен! 🔥'))
  .catch(err => console.error('Ошибка запуска:', err));

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));