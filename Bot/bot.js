const fs = require("fs");
const path = require("path");
const cron = require('node-cron');
const { Telegraf, Markup } = require('telegraf');

// Подключение библиотеки dotenv и загрузка переменных окружения
const envPath = path.join(__dirname, ".env");
require("dotenv").config({ path: envPath });

// Деструктуризация переменных окружения
const { telegramToken } = process.env;

// Создание экземпляра Telegraf и указание токена
const bot = new Telegraf(telegramToken);

// Загрузка существующих сессий из файла sessions.json
const sessions = require('./sessions.json');

// Функция установки шага сессии
const setSessionStep = (userId, step) => {
    sessions[userId] = { step };
    fs.writeFileSync('./sessions.json', JSON.stringify(sessions, null, '    '));
};

// Загрузка данных из json
const workers = require("./workers.json");
const managers = require("./managers.json");

const { fetchDataAndHandleOrders, putValueToLPTracker, fetchDataAndProcessOrders, generateMessage, parseDate,
    uploadTelegramPhotoToLPTracker, getCleaningInstructions, sendCancelOrdersReminder, sendUnpaidOrdersReminder } = require('./functions');

bot.start((ctx) => {
    ctx.reply('Компания Cleaning Moscow благодарит вас за регистрацию.\n\nУзнать информацию о пользовании ботом можно нажав на команду /help',
        {
            reply_markup: {
                keyboard: [[{ text: "Неоплаченные заказы" }],
                [{ text: "Заказы на сегодня" }],
                [{ text: "Заказы на завтра" }],
                [{ text: "Архив заказов" }],
                [{ text: "Свободные заказы" }],
                [{ text: "Связаться с менеджером" }]]
            }
        })
})

bot.help((ctx) => {
    ctx.reply(`Взаимодействие с исполнителями в данном боте происходит посредством нажатия кнопок, в некоторых случаях с отправкой вами сообщений.
\nТакже в данный бот будут приходить ваши новые заказы.\n\nЗа 15 минут до начала заказа придёт сообщение с вашим заказом.
\nВ случае наличия неоплаченных заказов, вам будет направлено напоминание о том что необходимо отправить фото чека.
\nПосмотреть сегодняшние и завтрашние заказы вы можете посредством нажатия соответствующих кнопок.
\nТакже у вас есть возможность увидеть неоплаченные заказы.\n\nВ графе "Cвободные заказы" можно лицезреть те заказы, которые вы можете взять в работу.
\nВ разделе "Архив заказов", вы увидите какие заказы вы выполняли раньше.
\nА ещё всегда есть возможность связаться с вашим менеджером, при возникновении каких-либо вопросов.`);
});

bot.hears('Неоплаченные заказы', async (ctx) => {
    try {
        const orders = await fetchDataAndProcessOrders(50);
        const messageQueue = [];
        let counter = 0;

        for (const { id, name, address, check, phone, date, executor, parameters, reasonForAbsencePhotoReceipt, reasonForCancellation, cost, takeTheseThings } of orders) {
            let message = generateMessage({ name, address, phone, date, parameters, executor, cost, takeTheseThings });
            const worker = workers.find(w => w.name === executor);
            if (check === null && worker && worker.chatId === ctx.from.id && !reasonForAbsencePhotoReceipt && !reasonForCancellation) {
                message += '\n\nСкриншот чека не добавлено';

                const inlineKeyboard = {
                    inline_keyboard: [
                        [{ text: 'Отправить скриншот чека', callback_data: 'send_receipt_photo_' + id }],
                        [{ text: 'Не могу отправить скриншот чека', callback_data: 'cannot_send_receipt_photo_' + id }],
                    ]
                };

                counter++;
                messageQueue.push([ctx.from.id, message, { reply_markup: inlineKeyboard, parse_mode: 'Markdown' }])
            }
        }

        if (counter === 0) {
            return ctx.reply('Неоплаченных заказов нет');
        }

        messageQueue.unshift([ctx.from.id, `У вас неоплаченных заказов - ${counter}`, {}]);

        messageQueue.map(async m => {
            await ctx.telegram.sendMessage(m[0], m[1], m[2]);
        })

    } catch (error) {
        console.error("An error occurred:", error);
        console.error(error.stack);
    }
});


bot.hears('Заказы на сегодня', async (ctx) => {
    try {
        const orders = await fetchDataAndProcessOrders(50);
        const today = new Date().toLocaleDateString('en-GB', localeDateStringParams);
        let counter = 0;
        const message = [];

        for (const { name, address, phone, date, executor, parameters, typeOfCleaning, cost, takeTheseThings } of orders) {
            const worker = workers.find(w => w.name === executor);
            if (date && date !== 'не указано' && worker && worker.chatId === ctx.from.id && parseDate(date).toLocaleDateString('en-GB', localeDateStringParams) === today) {
                message.push(`\n\n` + generateMessage({ name, address, phone, date, parameters, executor, cost, takeTheseThings, typeOfCleaning }));
                counter++;
            }
        }

        if (counter === 0) {
            return ctx.reply('Заказов на сегодня нет');
        }

        message.unshift(`На сегодня заказов - ${counter}`);

        await ctx.reply(message.join(''), { parse_mode: 'Markdown' });
    } catch (error) {
        console.error("An error occurred:", error);
        console.error(error.stack);
    }
});


bot.hears('Заказы на завтра', async (ctx) => {
    try {
        const orders = await fetchDataAndProcessOrders(50);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const formattedTomorrow = tomorrow.toLocaleDateString('en-GB', localeDateStringParams);
        let counter = 0;
        const message = [];

        for (const { name, address, phone, date, executor, parameters, typeOfCleaning, cost, takeTheseThings } of orders) {
            const worker = workers.find(w => w.name === executor);
            if (date && date !== 'не указано' && worker && worker.chatId === ctx.from.id && parseDate(date).toLocaleDateString('en-GB', localeDateStringParams) === formattedTomorrow) {
                message.push(`\n\n` + generateMessage({ name, address, phone, date, parameters, executor, cost, takeTheseThings, typeOfCleaning }));
                counter++;
            }
        }

        if (counter === 0) {
            return ctx.reply('Заказов на завтра нет');
        }

        message.unshift(`На завтра заказов - ${counter}`);

        await ctx.reply(message.join(''), { parse_mode: 'Markdown' });
    } catch (error) {
        console.error("An error occurred:", error);
        console.error(error.stack);
    }
});


bot.hears('Архив заказов', async (ctx) => {
    try {
        const orders = await fetchDataAndProcessOrders(20);
        const message = [];
        let counter = 0;

        for (const { name, address, phone, date, parameters, typeOfCleaning, executor, cost, takeTheseThings } of orders) {
            const worker = workers.find(w => w.name === executor);
            if (date && date !== 'не указано' && parseDate(date) < new Date() && worker && worker.chatId === ctx.from.id) {
                message.push(`\n\n` + generateMessage({ name, address, phone, date, parameters, executor, cost, takeTheseThings, typeOfCleaning }));
                counter++;
            }
        }

        if (counter === 0) {
            return ctx.reply('Заказов в архиве нет');
        }

        message.unshift(`Заказов в архиве - ${counter}`);

        await ctx.reply(message.join(''), { parse_mode: 'Markdown' });
    } catch (error) {
        console.error("An error occurred:", error);
        console.error(error.stack);
    }
});

bot.hears('Свободные заказы', async (ctx) => {
    try {
        const orders = await fetchDataAndProcessOrders(50);
        let counter = 0;
        const messages = [];

        for (const { id, name, address, phone, date, parameters, isFree, typeOfCleaning, cost, takeTheseThings } of orders) {
            if (isFree && date && date !== 'не указано' && parseDate(date) >= new Date()) {
                messages.push([
                    {
                        inline_keyboard: [
                            [{ text: 'Взять этот заказ', callback_data: `get_this_order_${id}` }]
                        ]
                    },
                    generateMessage({ name, address, phone, date, parameters, cost, takeTheseThings, typeOfCleaning })
                ]);
                counter++;
            }
        }

        if (counter === 0) {
            return ctx.reply('Свободных заказов нет');
        }

        ctx.reply(`Свободных заказов - ${counter}`);

        await Promise.all(messages.map(([replyMarkup, message]) => {
            return ctx.reply(message, { reply_markup: replyMarkup, parse_mode: 'Markdown' });
        }));
    } catch (error) {
        console.error("An error occurred:", error);
        console.error(error.stack);
    }
});

bot.hears('Связаться с менеджером', async (ctx) => {
    const keyboard = Markup.inlineKeyboard(
        managers.map(manager => [Markup.button.url(manager.name, `tg://user?id=${manager.chatId}`)])
    );

    ctx.reply('Контакты менеджеров', keyboard)
});

bot.action(/^get_this_order_(\d+)/g, (ctx) => {
    const leadId = ctx.match[1];
    const from = ctx.update.callback_query.from;

    ctx.reply('Ваше предложение отправлено менеджеру.\n\nОжидайте ответа менеджера в личных сообщениях.')
    const message = `${from.first_name || from.username || from.id} хочет взяться за этот заказ\n\n[Ссылка на лид в LPT](https://my.lptracker.ru/#leads/card/${leadId})\n\n[Написать ${from.first_name || from.username || from.id}](tg://user?id=${from.id})`
    return managers.map(manager => {
        ctx.answerCbQuery('', true);
        return bot.telegram.sendMessage(manager.chatId, message, { parse_mode: "MarkdownV2" }).catch(err => console.log(err));
    })
});

bot.action(/^send_receipt_photo_(\d+)/g, (ctx) => {
    const leadId = ctx.match[1];
    setSessionStep(ctx.update.callback_query.from.id, 'receipt_photo_' + leadId);

    ctx.reply('Пришлите скриншот чека')
        .then(ctx.answerCbQuery('', true))
});

bot.action(/^send_appearance_photo_(\d+)/g, (ctx) => {
    const leadId = ctx.match[1];
    setSessionStep(ctx.update.callback_query.from.id, 'appearance_photo_' + leadId);

    ctx.reply('Пришлите фото внешнего вида')
        .then(ctx.answerCbQuery('', true))
});

bot.on('photo', async (ctx) => {
    const sessionStep = sessions[ctx.message.from.id].step ?? null;
    const regExpReceipt = /^receipt_photo_(\d+)/;
    const regExpAppearence = /^appearance_photo_(\d+)/;

    if (sessionStep && regExpReceipt.test(sessionStep)) {
        const leadId = sessionStep.match(regExpReceipt)[1];

        await uploadTelegramPhotoToLPTracker(setSessionStep, ctx, leadId, 'receipt');
    }

    if (sessionStep && regExpAppearence.test(sessionStep)) {
        const leadId = sessionStep.match(regExpAppearence)[1];

        await uploadTelegramPhotoToLPTracker(setSessionStep, ctx, leadId, 'appearance');
    }
});

bot.action(/^instruction$/g, async (ctx) => {
    const ctxMessageText = ctx.update.callback_query.message.text;
    const typeOfCleaning = ctxMessageText.match(/Тип уборки: (.+)\nИсполнитель/)[1];

    await getCleaningInstructions(typeOfCleaning)
        .then(instruction => {
            ctx.reply(instruction)
                .then(ctx.answerCbQuery('', true))
        })
});

bot.action(/^cancel_this_order_(\d+)/g, (ctx) => {
    const leadId = ctx.match[1];
    setSessionStep(ctx.update.callback_query.from.id, 'cancel_this_order_' + leadId);

    ctx.reply('Напишите причину отмены заказа')
        .then(ctx.answerCbQuery('', true))
});

bot.action(/^listen_to_call_recording_(\d+)/g, (ctx) => {
    //const leadId = ctx.match[1];
    //setSessionStep(ctx.update.callback_query.from.id, 'listen_to_call_recording_' + leadId);

    ctx.reply('Ошибка при получении аудиозаписи')
        .then(ctx.answerCbQuery('', true))
});

bot.action(/^cannot_send_receipt_photo_(\d+)/g, async (ctx) => {
    const leadId = ctx.match[1];

    // Спрашиваем у пользователя причину
    await ctx.reply('Напишите причину, по которой вы не можете отправить скриншот чека.')
        .then(response => {
            const messageId = response.message_id;

            // Сохраняем messageId в сессии, чтобы использовать его позже
            setSessionStep(ctx.update.callback_query.from.id, 'cannot_send_receipt_photo_' + leadId + '|' + messageId);
        })
        .then(ctx.answerCbQuery('', true))
});

bot.action(/^cannot_send_appearance_photo_(\d+)/g, async (ctx) => {
    const leadId = ctx.match[1];

    // Спрашиваем у пользователя причину
    await ctx.reply('Напишите причину, по которой вы не можете отправить фото внешнего вида.')
        .then(response => {
            const messageId = response.message_id;

            // Сохраняем messageId в сессии, чтобы использовать его позже
            setSessionStep(ctx.update.callback_query.from.id, 'cannot_send_appearance_photo_' + leadId + '|' + messageId);
        })
        .then(ctx.answerCbQuery('', true))
});

bot.on('text', async (ctx) => {
    // Получаем шаг из сессии пользователя
    const step = sessions[ctx.message.from.id].step ?? null;

    if ((step && step.startsWith('cannot_send_appearance_photo')) || (step && step.startsWith('cannot_send_receipt_photo'))) {
        // Здесь обрабатываем ответ пользователя
        const userReason = ctx.message.text;

        // Разделяем значение шага, чтобы получить messageId и action
        const [action, messageId] = step.split('|');
        const actionType = action.match(/^cannot_send_(receipt|appearance)_photo_(\d+)/)[1];
        const leadId = action.match(/^cannot_send_(receipt|appearance)_photo_(\d+)/)[2];

        // Редактируем предыдущее сообщение бота с новым текстом
        await ctx.telegram.editMessageText(ctx.chat.id, messageId, null, `Ваш ответ, почему вы не можете прислать фото, записан: ${userReason}`);

        // Удаляем ответ пользователя
        await ctx.deleteMessage(ctx.message.message_id);

        console.log(leadId, userReason)

        await putValueToLPTracker(leadId, userReason, actionType)

        // Сбрасываем шаг сессии
        await setSessionStep(ctx.chat.id, null);
    }

    if (step && step.startsWith('cancel_this_order_')) {
        // Здесь обрабатываем ответ пользователя
        const userReason = ctx.message.text;
        const leadId = step.match(/^cancel_this_order_(\d+)/)[1];

        ctx.reply(`Ваш ответ, почему вы не можете взять этот заказ, записан:\n${userReason}`);

        await putValueToLPTracker(leadId, userReason, 'cancelingOrder');
        await putValueToLPTracker(leadId, ["Нет исполнителя"], 'writeExecutor');
        await putValueToLPTracker(leadId, ["Да"], 'setOrderFree');

        // Сбрасываем шаг сессии
        await setSessionStep(ctx.chat.id, null);
    }
});

bot.launch();

const localeDateStringParams = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
};


// Рассылки

// Исполнителю о неоплаченных заказах в 10:00 и 16:00
cron.schedule('5 0 10,16 * * *', () => sendUnpaidOrdersReminder(bot));

// Менеджерам об отмененных заказах в 16:01
cron.schedule('30 0 16 * * *', () => sendCancelOrdersReminder(bot));

// уведомление за 15 мин до начала заказа
// отслеживание появления нового заказа
fetchDataAndHandleOrders(bot);
setInterval(() => {
    fetchDataAndHandleOrders(bot);
}, 1 * 60 * 1000); // каждые 1 минут