const fs = require("fs");
const path = require("path");
const fetch = require('node-fetch');
const cron = require('node-cron');
const { Telegraf, Markup } = require('telegraf');

// Подключение библиотеки dotenv и загрузка переменных окружения
const envPath = path.join(__dirname, ".env");
require("dotenv").config({ path: envPath });

// Деструктуризация переменных окружения
const { telegramToken, lpTrackerToken } = process.env;

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

// Пример объекта заказа
const order = { name: "Дмитрий Митин", name: "Мама" };

// Получение chatId из workers.json
const workersChatId = workers.find(object => object.name === order.name).chatId;

// telegram id админа для теста
// const adminId = 1013645358;
const adminId = 211382461;

const googleDocumentId = '1TPBVKx6apa8EsW1weN9FhEx3q3Xy869oRTqnAwoRHVI'; //генеральная уборка
const { google } = require('googleapis');


bot.start(async (ctx) => {
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

bot.help(async (ctx) => {
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

        for (const { id, name, address, check, phone, date, executor, parameters } of orders) {
            let message = `Имя клиента: ${name}\nАдрес клиента: ${address}\nТелефон клиента: ${phone}\nДата и время заказа: ${date}\nПараметры заказа: ${parameters}\nИсполнитель: ${executor}`;
            const worker = workers.find(w => w.name === executor);
            if (check === null && worker) {
                message += '\n\nФото чека не добавлено';

                const inlineKeyboard = {
                    inline_keyboard: [
                        [{ text: 'Отправить фото чека', callback_data: 'send_receipt_photo_' + id }],
                        [{ text: 'Не могу отправить фото чека', callback_data: 'cannot_send_receipt_photo_' + id }],
                    ]
                };

                await ctx.telegram.sendMessage(ctx.from.id, message, { reply_markup: inlineKeyboard, parse_mode: 'Markdown' });
            }
        }
    } catch (error) {
        console.error("An error occurred:", error);
        console.error(error.stack);
    }
});


bot.hears('Заказы на сегодня', async (ctx) => {
    try {
        const orders = await fetchDataAndProcessOrders(50);
        const today = new Date().toLocaleDateString('en-GB', localeDateStringParams);
        let counter = 0; // Инициализация переменной
        const message = [];

        for (const { name, address, phone, date, executor, parameters } of orders) {
            const worker = workers.find(w => w.name === executor);
            if (date && date !== 'не указано' && worker && parseDate(date).toLocaleDateString('en-GB', localeDateStringParams) === today) {
                message.push(`\n\nИмя клиента: ${name}\nАдрес клиента: ${address}\nТелефон клиента: ${phone}\nДата и время заказа: ${date}\nПараметры заказа: ${parameters}\nИсполнитель: ${executor}`);
                counter++;
            }
        }

        if (counter === 0) {
            return ctx.reply('Заказов на сегодня нет');
        }

        message.unshift(`На сегодня заказов - ${counter}`);

        await ctx.reply(message.join(''));
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
        let counter = 0; // Инициализация переменной
        const message = [];

        for (const { name, address, phone, date, executor, parameters } of orders) {
            const worker = workers.find(w => w.name === executor);
            if (date && date !== 'не указано' && worker && parseDate(date).toLocaleDateString('en-GB', localeDateStringParams) === formattedTomorrow) {
                message.push(`\n\nИмя клиента: ${name}\nАдрес клиента: ${address}\nТелефон клиента: ${phone}\nДата и время заказа: ${date}\nПараметры заказа: ${parameters}\nИсполнитель: ${executor}`);
                counter++;
            }
        }

        if (counter === 0) {
            return ctx.reply('Заказов на завтра нет');
        }

        message.unshift(`На завтра заказов - ${counter}`);

        await ctx.reply(message.join(''));
    } catch (error) {
        console.error("An error occurred:", error);
        console.error(error.stack);
    }
});


bot.hears('Архив заказов', async (ctx) => {
    try {
        const orders = await fetchDataAndProcessOrders(20);
        const message = ['20 последних заказов:'];

        for (const { name, address, phone, date, parameters } of orders) {
            if (date && date !== 'не указано' && parseDate(date) < new Date()) {
                message.push(`\n\nИмя клиента: ${name}\nАдрес: ${address}\nТелефон: ${phone}\nДата и время заказа: ${date}\nПараметры заказа: ${parameters}`);
            }
        }

        await ctx.reply(message.join(''));
    } catch (error) {
        console.error("An error occurred:", error);
        console.error(error.stack);
    }
});

bot.hears('Свободные заказы', async (ctx) => {
    try {
        const orders = await fetchDataAndProcessOrders(50);
        let counter = 0; // Инициализация переменной
        const messages = [];
    
        for (const { id, name, address, phone, date, parameters, isFree } of orders) {
            if (isFree) {
                messages.push([
                    {
                        inline_keyboard: [
                            [{ text: 'Взять этот заказ', callback_data: `get_this_order_${id}` }]
                        ]
                    },
                    `Имя клиента: ${name}\nАдрес: ${address}\nТелефон: ${phone}\nДата и время заказа: ${date}\nПараметры заказа: ${parameters}`
                ]);
                counter++;
            }
        }
    
        if (counter === 0) {
            return ctx.reply('Свободных заказов нет');
        }
    
        ctx.reply(`Свободных заказов - ${counter}`);
    
        await Promise.all(messages.map(([replyMarkup, message]) => {
            return ctx.reply(message, { reply_markup: replyMarkup });
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

bot.action(/get_this_order_(\d+)/g, (ctx) => {
    const leadId = ctx.match[1];
    const from = ctx.update.callback_query.from;

    ctx.reply('Ваше предложение отправлено менеджеру.\n\nОжидайте ответа менеджера в личных сообщениях.')
    const message = `${from.firstName || from.username} хочет взяться за этот заказ\n\n[Ссылка на лид в LPT](https://my.lptracker.ru/#leads/card/${leadId})\n\n[Написать ${from.firstName || from.username}](tg://user?id=${from.id})`
    return managers.map(manager => {
        ctx.answerCbQuery('', true);
        return bot.telegram.sendMessage(manager.chatId, message, { parse_mode: "MarkdownV2" }).catch(err => console.log(err));
    })
});

bot.action(/^send_receipt_photo_(\d+)/g, (ctx) => {
    const leadId = ctx.match[1];
    setSessionStep(ctx.update.callback_query.from.id, 'receipt_photo_' + leadId);
    
    ctx.reply('Пришлите фото чека')
    .then(ctx.answerCbQuery('', true))
});

bot.action(/^send_appearance_photo_(\d+)/g, (ctx) => {
    const leadId = ctx.match[1];
    setSessionStep(ctx.update.callback_query.from.id, 'appearance_photo_' + leadId);
    
    ctx.reply('Пришлите фото чека')
    .then(ctx.answerCbQuery('', true))
});

bot.on('photo', async (ctx) => {
    const sessionStep = sessions[ctx.message.from.id].step
    const regExpReceipt = /receipt_photo_(\d+)/;
    const regExpAppearence = /appearance_photo_(\d+)/;

    if (regExpReceipt.test(sessionStep)) {
        const leadId = sessionStep.match(regExpReceipt)[1];

        uploadTelegramPhotoToLPTracker(ctx, leadId, 'receipt');
    };

    if (regExpAppearence.test(sessionStep)) {
        const leadId = sessionStep.match(regExpAppearence)[1];

        uploadTelegramPhotoToLPTracker(ctx, leadId, 'appearance');
    };
});

bot.action(/^cannot_send_receipt_photo_(\d+)/g, async (ctx) => {
    const leadId = ctx.match[1];

    // Спрашиваем у пользователя причину
    await ctx.reply('Напишите причину, по которой вы не можете отправить фото чека.')
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
    const step = sessions[ctx.message.from.id].step;

    if ((step && step.startsWith('cannot_send_appearance_photo')) || (step && step.startsWith('cannot_send_receipt_photo'))) {
        // Здесь обрабатываем ответ пользователя, например, сохраняем в базе данных
        const userReason = ctx.message.text;

        // Разделяем значение шага, чтобы получить messageId и action
        const [action, messageId] = step.split('|');
        const actionType = action.match(/cannot_send_(receipt|appearance)_photo_(\d+)/)[1];
        const leadId = action.match(/cannot_send_(receipt|appearance)_photo_(\d+)/)[2];

        // Редактируем предыдущее сообщение бота с новым текстом
        await ctx.telegram.editMessageText(ctx.chat.id, messageId, null, `Ваш ответ, почему вы не можете прислать фото, записан: ${userReason}`);

        // Удаляем ответ пользователя
        await ctx.deleteMessage(ctx.message.message_id);

        console.log(leadId, userReason)

        putReasonToLPTracker(leadId, userReason, actionType)

        // Сбрасываем шаг сессии
        await setSessionStep(ctx.chat.id, null);
    }
});

async function newLpFunction(ctx) { // Функция при добавлении в LPTracker
    ctx.scene.session.state
    try {
        var time = new Date();

        var date = time.getDate();
        if (date < 10) date = "0" + date;
        var month = time.getMonth() + 1;
        if (month == 13) month = 1;
        if (month < 10) month = "0" + month;
        var year = time.getFullYear();

        var hour = time.getHours();
        if (hour < 10) hour = "0" + hour;
        var minute = time.getMinutes() - 1;
        if (minute < 10) minute = "0" + minute;

        var currentTime = `${date}.${month}.${year} ${hour}:${minute}`;

        // Отправляем отформатированное время в чат
        // console.log(`${timeNow}`);

        const response = await fetch("https://direct.lptracker.ru/lead/103451/list?offset=0&limit=20&sort[updated_at]=3&filter[created_at_from]=1535529725", { headers: { token: lpTrackerToken } });
        const data = await response.json();
        // console.log(data.result[0])
        data.result.forEach(function (item) {
            var address = item.custom.find(object => object.name == 'Адрес');
            var dateOne = item.custom.find(object => object.name == 'Дата выполнения сделки').value;
            var phone = item.contact?.details?.find(detail => detail.type === 'phone').data;
            var name = item.contact.name;
            var created_at = item.contact.created_at
            let created_at_new = created_at.split('').slice(0, -3).join('');
            var parametrs = item.custom.find(object => object.name == 'Важная информация').value;

            if (String(currentTime) === String(created_at_new)) {
                var message = '\nИмя клиента: ' + name + '\nАдрес клиента: ' + address.value + '\nТелефон клиента: ' + phone + '\nДата и время заказа: ' + dateOne + '\nПараметры заказа: ' + parametrs + '\nДата создания лида: ' + created_at;
            }

            const inlineKeyboard = {
                inline_keyboard: [
                    [{ text: 'Отмена заказа', callback_data: 'cancelOrder' }],
                    [{ text: 'Послушать запись первого звонка', callback_data: 'hearRecordFirstCall' }]
                ]
            };

            // Use the bot.telegram.sendMessage method
            bot.telegram.sendMessage(adminId, message, { reply_markup: inlineKeyboard }).catch(err => console.log(err));
        });
    }
    catch (error) {
        console.error('Ошибка:', error);
    }
}

// Таймеры


// cron.schedule('7 11 * * *', () => {
//     try {
//         // Создаем инлайн клавиатуру
//         const inlineKeyboard = {
//             inline_keyboard: [
//                 [{ text: 'Добавить фото чека', callback_data: 'add_photo_check_callback' }]
//             ]
//         };

//         // Отправляем сообщение с инлайн кнопкой и текстом
//         bot.telegram.sendMessage(adminId, 'У вас есть неоплаченные заказы', {
//             reply_markup: inlineKeyboard,
//         }).catch(error => console.error('Ошибка при отправке уведомления:', error));

//     } catch (error) {
//         console.error('Ошибка при отправке уведомления:', error);
//     }
// });

cron.schedule('0 10 * * *', async () => {
    try {
        // Создаем инлайн клавиатуру
        const inlineKeyboard = {
            inline_keyboard: [
                [{ text: 'Посмотреть неоплаченные заказы', callback_data: 'noPayOrder' }]
            ]
        };

        // Отправляем сообщение с инлайн кнопкой и текстом
        bot.telegram.sendMessage(adminId, 'У вас есть неоплаченные заказы', {
            reply_markup: inlineKeyboard,
        }).catch(error => console.error('Ошибка при отправке уведомления:', error));

        bot.action('noPayOrder', async (ctx) => {
            try {
                const response = await fetch("https://direct.lptracker.ru/lead/103451/list?offset=0&limit=20&sort[updated_at]=3&filter[created_at_from]=1535529725", { headers: { token: lpTrackerToken } });
                const data = await response.json(); // Преобразование ответа в JSON 

                data.result.forEach(async function (item) {
                    var address = item.custom.find(object => object.name == 'Адрес');
                    var check = (item.custom.find(object => object.name == 'Чек').value)
                    var phone = item.contact?.details?.find(detail => detail.type === 'phone').data;
                    var name = item.contact?.name;
                    var parametrs = item.custom.find(object => object.name == 'Важная информация').value;
                    if (check == null) {
                        var message = '\nИмя клиента: ' + name + '\nАдрес клиента: ' + address.value + '\nТелефон клиента: ' + phone + '\nПараметры заказа: ' + parametrs;

                        const inlineKeyboard = {
                            inline_keyboard: [
                                [{ text: 'Добавить фото чека', callback_data: 'add_photo_check_callback' }]
                            ]
                        };

                        // Отправляем сообщение с инлайн кнопкой и текстом
                        ctx.replyWithMarkdown(message, { reply_markup: inlineKeyboard }).catch(err => console.log(err));
                    }
                });
            } catch (error) {
                console.error('Ошибка при отправке уведомления:', error);
            }
        });
    } catch (error) {
        console.error('Ошибка при отправке уведомления:', error);
    }
});

cron.schedule('58 15 * * *', async () => {
    try {
        // Создаем инлайн клавиатуру
        const inlineKeyboard = {
            inline_keyboard: [
                [{ text: 'Посмотреть неоплаченные заказы', callback_data: 'noPayOrder' }]
            ]
        };

        // Отправляем сообщение с инлайн кнопкой и текстом
        bot.telegram.sendMessage(adminId, 'У вас есть неоплаченные заказы', {
            reply_markup: inlineKeyboard,
        }).catch(error => console.error('Ошибка при отправке уведомления:', error));

        bot.action('noPayOrder', async (ctx) => {
            try {
                const response = await fetch("https://direct.lptracker.ru/lead/103451/list?offset=0&limit=20&sort[updated_at]=3&filter[created_at_from]=1535529725", { headers: { token: lpTrackerToken } });
                const data = await response.json(); // Преобразование ответа в JSON 

                data.result.forEach(async function (item) {
                    var address = item.custom.find(object => object.name == 'Адрес');
                    var check = (item.custom.find(object => object.name == 'Чек').value)
                    var phone = item.contact?.details?.find(detail => detail.type === 'phone').data;
                    var name = item.contact?.name;
                    var parametrs = item.custom.find(object => object.name == 'Важная информация').value;
                    if (check == null) {
                        var message = '\nИмя клиента: ' + name + '\nАдрес клиента: ' + address.value + '\nТелефон клиента: ' + phone + '\nПараметры заказа: ' + parametrs;

                        const inlineKeyboard = {
                            inline_keyboard: [
                                [{ text: 'Добавить фото чека', callback_data: 'add_photo_check_callback' }]
                            ]
                        };

                        // Отправляем сообщение с инлайн кнопкой и текстом
                        ctx.replyWithMarkdown(message, { reply_markup: inlineKeyboard }).catch(err => console.log(err));
                    }
                });
            } catch (error) {
                console.error('Ошибка при отправке уведомления:', error);
            }
        });
    } catch (error) {
        console.error('Ошибка при отправке уведомления:', error);
    }
});



async function scheduledFunction(ctx) {
    try {
        var time = new Date();

        var date = time.getDate();
        if (date < 10) date = "0" + date;
        var month = time.getMonth() + 1;
        if (month == 13) month = 1;
        if (month < 10) month = "0" + month;
        var year = time.getFullYear();

        var hour = time.getHours();
        if (hour < 10) hour = "0" + hour;
        var minute = time.getMinutes();
        if (minute < 10) minute = "0" + minute;

        var timeNow = `${date}.${month}.${year} ${hour}:${minute}`;

        const response = await fetch("https://direct.lptracker.ru/lead/103451/list?offset=0&limit=20&sort[updated_at]=3&filter[created_at_from]=1535529725", { headers: { token: lpTrackerToken } });
        const data = await response.json();

        data.result.forEach(function (item) {
            var leadId = item.id;
            var address = item.custom.find(object => object.name == 'Адрес');
            var dateOne = item.custom.find(object => object.name == 'Дата выполнения сделки').value;
            var phone = item.contact?.details?.find(detail => detail.type === 'phone').data;
            var name = item.contact?.name;
            var parametrs = item.custom.find(object => object.name == 'Важная информация').value;

            if (String(dateOne) === String(timeNow)) {
                var message = 'ID: ' + leadId + '\nИмя клиента: ' + name + '\nАдрес клиента: ' + address.value + '\nТелефон клиента: ' + phone + '\nДата и время заказа: ' + dateOne + '\nПараметры заказа: ' + parametrs;
                var message2 = leadId;
                const inlineKeyboard = {
                    inline_keyboard: [
                        [{ text: 'Добавить фото внешнего вида', callback_data: 'send_appearance_photo_' + leadId }],
                        [{ text: 'Не могу отправить фото внешнего вида', callback_data: 'cannot_send_appearance_photo_' + leadId }],
                        [{ text: 'Отправить фото чека', callback_data: 'send_receipt_photo_' + leadId }]
                        [{ text: 'Не могу отправить фото чека', callback_data: 'cannot_send_receipt_photo_' + leadId }],
                        [{ text: 'Памятка', callback_data: 'remember' }]
                    ]
                };

                // Используйте метод bot.telegram.sendMessage
                bot.telegram.sendMessage(adminId, message, { reply_markup: inlineKeyboard }).catch(err => console.log(err));
                bot.telegram.sendMessage(adminId, message2, { reply_markup: inlineKeyboard }).catch(err => console.log(err));
            }
        });
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

// Создаем cron-расписание для выполнения каждую минуту
const cronSchedule = '*/1 * * * *'; // Каждую минуту

// Запускаем cron по расписанию
cron.schedule(cronSchedule, scheduledFunction);

const newLeadLp = '*/1 * * * *'; // Каждую минуту

// Запускаем cron по расписанию
cron.schedule(newLeadLp, newLpFunction);

// cron.schedule('58 15 * * *', async () => {
//     try {
//         // Создаем инлайн клавиатуру
//         const inlineKeyboard = {
//             inline_keyboard: [
//                 [{ text: 'Посмотреть неоплаченные заказы', callback_data: 'noPayOrder' }]
//             ]
//         };

//         // Отправляем сообщение с инлайн кнопкой и текстом
//         bot.telegram.sendMessage(adminId, 'У вас есть неоплаченные заказы', {
//             reply_markup: inlineKeyboard,
//         }).catch(error => console.error('Ошибка при отправке уведомления:', error));

//         bot.action('noPayOrder', async (ctx) => {
//             try {
//                 const response = await fetch("https://direct.lptracker.ru/lead/103451/list?offset=0&limit=20&sort[updated_at]=3&filter[created_at_from]=1535529725", { headers: { token: lpTrackerToken } });
//                 const data = await response.json(); // Преобразование ответа в JSON 

//                 data.result.forEach(async function (item) {
//                     var address = item.custom.find(object => object.name == 'Адрес');
//                     var check = (item.custom.find(object => object.name == 'Чек').value)
//                     var phone = item.contact?.details?.find(detail => detail.type === 'phone').data;
//                     var name = item.contact?.name;
//                     var parametrs = item.custom.find(object => object.name == 'Важная информация').value;
//                     if (check == null) {
//                         var message = '\nИмя клиента: ' + name + '\nАдрес клиента: ' + address.value + '\nТелефон клиента: ' + phone + '\nПараметры заказа: ' + parametrs;

//                         const inlineKeyboard = {
//                             inline_keyboard: [
//                                 [{ text: 'Добавить фото чека', callback_data: 'add_photo_check_callback' }]
//                             ]
//                         };

//                         // Отправляем сообщение с инлайн кнопкой и текстом
//                         ctx.replyWithMarkdown(message, { reply_markup: inlineKeyboard }).catch(err => console.log(err));
//                     }
//                 });
//             } catch (error) {
//                 console.error('Ошибка при отправке уведомления:', error);
//             }
//         });
//     } catch (error) {
//         console.error('Ошибка при отправке уведомления:', error);
//     }
// });


async function forManagerFunction(ctx) { // manager
    try {
        var time = new Date();

        var date = time.getDate();
        if (date < 10) date = "0" + date;
        var month = time.getMonth() + 1;
        if (month == 13) month = 1;
        if (month < 10) month = "0" + month;
        var year = time.getFullYear();

        var hour = time.getHours();
        if (hour < 10) hour = "0" + hour;
        var minute = time.getMinutes() - 1;
        if (minute < 10) minute = "0" + minute;

        var currentTime = `${date}.${month}.${year} ${hour}:${minute}`;

        // Отправляем отформатированное время в чат
        // console.log(`${timeNow}`);

        const response = await fetch("https://direct.lptracker.ru/lead/103451/list?offset=0&limit=20&sort[updated_at]=3&filter[created_at_from]=1535529725", { headers: { token: lpTrackerToken } });
        const data = await response.json();
        console.log(data.result[0])
        data.result.forEach(function (item) {
            var address = item.custom.find(object => object.name == 'Адрес');
            var dateOne = item.custom.find(object => object.name == 'Дата выполнения сделки').value;
            var phone = item.contact?.details?.find(detail => detail.type === 'phone').data;
            var name = item.contact.name;
            var whyWasCancellationOrder = item.custom.find(object => object.name == 'Причина отмены заказа').value;
            var needTake = item.custom.find(object => object.name == 'Обязательно взять').value;
            var parametrs = item.custom.find(object => object.name == 'Важная информация').value;

            if (whyWasCancellationOrder != null) {
                message += '\nИсполнитель отказался от задания!';
                var message = '\nИмя клиента: ' + name + '\nАдрес клиента: ' + address.value + '\nТелефон клиента: ' + phone + '\nДата и время заказа: ' + dateOne + '\nПараметры заказа: ' + parametrs + '\nПричина отмены заказа: ' + whyWasCancellationOrder + '\nОбязательно взять: ' + needTake;
            }

            // Use the bot.telegram.sendMessage method
            bot.telegram.sendMessage(adminId, message).catch(err => console.log(err));
        });
    }
    catch (error) {
        console.error('Ошибка:', error);
    }
}

const forManager = '52 17 * * *'; // Каждую минуту

// Запускаем cron по расписанию
cron.schedule(forManager, forManagerFunction);


bot.launch();

// Функции и константы

/**
 * Загружает фотографию из телеграма на LPTracker.
 *
 * @param {Object} ctx - Контекст Telegraf, содержащий информацию о сообщении.
 * @param {number} leadId - Идентификатор лида на LPTracker.
 * @param {'receipt'|'appearance'} type - Тип фотографии ('receipt' либо 'appearance').
 * @returns {Promise<void>} - Промис, который разрешается после завершения загрузки фотографии.
 * @throws {Error} - Выбрасывает ошибку в случае неудачной загрузки.
 */
const uploadTelegramPhotoToLPTracker = async (ctx, leadId, type) => {
    try {
        const fileData = await ctx.telegram.getFile(ctx.message.photo.reverse()[0].file_id);
        const fileLink = await ctx.telegram.getFileLink(fileData.file_id);
        const fileResponse = await fetch(fileLink);
        const fileBuffer = await fileResponse.buffer();

        const base64Data = fileBuffer.toString('base64');
        console.log(fileData.file_path)
        const data = {
            name: fileData.file_path.split('/')[1],
            mime: 'image/jpeg',
            data: base64Data,
            custom_field_id: type === 'receipt' ? 2079688 : 2116594  // для чеков - 2079688 | для внешнего вида - 2116594
        };

        const uploadResponse = await fetch(`https://direct.lptracker.ru/lead/${leadId}/file`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'token': lpTrackerToken
            },
            body: JSON.stringify(data)
        });

        const result = await uploadResponse.json();
        console.log('Результат:', result);

        if (result?.status == 'success') {
            ctx.reply("Фотография успешно загружена")
                .then(setSessionStep(ctx.message.from.id, null));
        } else {
            console.error('Ошибка при загрузке фото:', type, error)
            ctx.reply('Произошла ошибка при загрузке фото ' + type === 'receipt' ? 'чека' : 'внешнего вида');
        }
    } catch (error) {
        console.error('Ошибка при загрузке фото:', type, error)
    }
}

/**
 * Помещает причину отказа отправки фото в LPTracker.
 *
 * @param {number} leadId - Идентификатор лида на LPTracker.
 * @param {string} userReason - Причина отказа отправки фото.
 * @param {'receipt'|'appearance'} actionType - Тип фото ('receipt' либо 'appearance').
 * @throws {Error} Если произошла ошибка при выполнении запроса к LPTracker.
 * @returns {Promise<void>} Обещание без значения, представляющее завершение операции.
 */
const putReasonToLPTracker = async (leadId, userReason, actionType) => {
    // Запись в LPTracker
    try {
        const uploadResponse = await fetch('https://direct.lptracker.ru/lead/' + leadId, {
            headers: {
                "Content-Type": "application/json",
                "token": lpTrackerToken
            },
            method: "PUT",
            body: JSON.stringify({
                custom: {
                    [actionType === 'receipt' ? '2126627' : '2126626']: userReason
                }
            })
        });

        const result = await uploadResponse.json();
        console.log('Результат:', result.status);
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

const fetchDataAndProcessOrders = async (limit) => {
    // вывод заказов с даты - 01 Jan 2023 00:00:00 GMT
    const createdAtDate = 1672531200;

    try {
        const response = await fetch(`https://direct.lptracker.ru/lead/103451/list?offset=0&limit=${limit}&sort[updated_at]=3&filter[created_at_from]=${createdAtDate}`, { headers: { token: lpTrackerToken } });
        const data = await response.json();

        if (!data.result || data.result.length === 0) {
            console.log('Массив данных пуст или не содержит заказов.');
            return [];
        }

        return data.result.map(({ id, custom, contact }) => {
            const address = custom.find(object => object.name === 'Адрес')?.value || 'не указано';
            const check = custom.find(object => object.name === 'Чек')?.value || null;
            const phone = contact?.details?.find(detail => detail.type === 'phone')?.data || 'не указано';
            const date = custom.find(object => object.name == 'Дата выполнения сделки')?.value || 'не указано';
            const executor = custom.find(object => object.name === 'Исполнитель')?.value[0] || 'не указано';
            const name = contact?.name || 'не указано';
            const parameters = custom.find(object => object.name === 'Важная информация')?.value || 'не указано';
            const typeOfCleaning = custom.find(object => object.name == 'Вид уборки')?.value[0] || 'не указано';
            const isFree = custom.find(object => object.name == 'Свободный заказ')?.value?.[0] === 'Да';

            return { id, name, address, check, phone, date, executor, parameters, typeOfCleaning, isFree };
        });
    } catch (error) {
        console.error("An error occurred:", error);
        console.error(error.stack);
        return []; // Если произошла ошибка, возвращаем пустой массив
    }
};

const parseDate = (dateString) => {
    const [day, month, yearAndTime] = dateString.split('.');
    const [year, time] = yearAndTime.split(' ');
    const [hours, minutes] = time.split(':');

    return new Date(year, month - 1, day, hours, minutes);
};

const localeDateStringParams = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
};