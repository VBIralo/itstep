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

// Очередь тайцмеров напоминалок
const timers = [];

const googleDocumentId = '1TPBVKx6apa8EsW1weN9FhEx3q3Xy869oRTqnAwoRHVI'; //генеральная уборка
const { google } = require('googleapis');

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

        for (const { id, name, address, check, phone, date, executor, parameters, reasonForAbsencePhotoReceipt } of orders) {
            let message = `Имя клиента: ${name}\nАдрес клиента: ${address}\nТелефон клиента: ${phone}\nДата и время заказа: ${date}\nПараметры заказа: ${parameters}\nИсполнитель: ${executor}`;
            const worker = workers.find(w => w.name === executor);
            if (check === null && worker && worker.chatId === ctx.from.id && !reasonForAbsencePhotoReceipt) {
                message += '\n\nФото чека не добавлено';

                const inlineKeyboard = {
                    inline_keyboard: [
                        [{ text: 'Отправить фото чека', callback_data: 'send_receipt_photo_' + id }],
                        [{ text: 'Не могу отправить фото чека', callback_data: 'cannot_send_receipt_photo_' + id }],
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

        for (const { name, address, phone, date, executor, parameters, typeOfCleaning } of orders) {
            const worker = workers.find(w => w.name === executor);
            if (date && date !== 'не указано' && worker && worker.chatId === ctx.from.id && parseDate(date).toLocaleDateString('en-GB', localeDateStringParams) === today) {
                message.push(`\n\nИмя клиента: ${name}\nАдрес клиента: ${address}\nТелефон клиента: ${phone}\nДата и время заказа: ${date}\nТип уборки: ${typeOfCleaning}\nПараметры заказа: ${parameters}\nИсполнитель: ${executor}`);
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

        for (const { name, address, phone, date, executor, parameters, typeOfCleaning } of orders) {
            const worker = workers.find(w => w.name === executor);
            if (date && date !== 'не указано' && worker && worker.chatId === ctx.from.id && parseDate(date).toLocaleDateString('en-GB', localeDateStringParams) === formattedTomorrow) {
                message.push(`\n\nИмя клиента: ${name}\nАдрес клиента: ${address}\nТелефон клиента: ${phone}\nДата и время заказа: ${date}\nТип уборки: ${typeOfCleaning}\nПараметры заказа: ${parameters}\nИсполнитель: ${executor}`);
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

        for (const { name, address, phone, date, parameters, typeOfCleaning, executor } of orders) {
            const worker = workers.find(w => w.name === executor);
            if (date && date !== 'не указано' && parseDate(date) < new Date() && worker && worker.chatId === ctx.from.id) {
                message.push(`\n\nИмя клиента: ${name}\nАдрес: ${address}\nТелефон: ${phone}\nДата и время заказа: ${date}\nТип уборки: ${typeOfCleaning}\nПараметры заказа: ${parameters}`);
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

        for (const { id, name, address, phone, date, parameters, isFree, typeOfCleaning } of orders) {
            if (isFree && parseDate(date) >= new Date()) {
                messages.push([
                    {
                        inline_keyboard: [
                            [{ text: 'Взять этот заказ', callback_data: `get_this_order_${id}` }]
                        ]
                    },
                    `Имя клиента: ${name}\nАдрес: ${address}\nТелефон: ${phone}\nДата и время заказа: ${date}\nТип уборки: ${typeOfCleaning}\nПараметры заказа: ${parameters}`
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

    ctx.reply('Пришлите фото внешнего вида')
        .then(ctx.answerCbQuery('', true))
});

bot.on('photo', async (ctx) => {
    const sessionStep = sessions[ctx.message.from.id].step ?? null;
    const regExpReceipt = /^receipt_photo_(\d+)/;
    const regExpAppearence = /^appearance_photo_(\d+)/;

    if (sessionStep && regExpReceipt.test(sessionStep)) {
        const leadId = sessionStep.match(regExpReceipt)[1];

        uploadTelegramPhotoToLPTracker(ctx, leadId, 'receipt');
    }

    if (sessionStep && regExpAppearence.test(sessionStep)) {
        const leadId = sessionStep.match(regExpAppearence)[1];

        uploadTelegramPhotoToLPTracker(ctx, leadId, 'appearance');
    }
});

bot.action(/^instruction_(.+)/g, (ctx) => {
    const typeOfCleaning = ctx.match[1];
    //setSessionStep(ctx.update.callback_query.from.id, 'instruction_' + leadId);

    getCleaningInstructions(typeOfCleaning)
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

        putReasonToLPTracker(leadId, userReason, actionType)

        // Сбрасываем шаг сессии
        await setSessionStep(ctx.chat.id, null);
    }

    if (step && step.startsWith('cancel_this_order_')) {
        // Здесь обрабатываем ответ пользователя
        const userReason = ctx.message.text;
        const leadId = step.match(/^cancel_this_order_(\d+)/)[1];

        ctx.reply(`Ваш ответ, почему вы не можете взять этот заказ, записан: ${userReason}`);

        putReasonToLPTracker(leadId, userReason, 'cancelingOrder');

        // Сбрасываем шаг сессии
        await setSessionStep(ctx.chat.id, null);
    }
});

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
            console.error('Ошибка при загрузке фото:', type)
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
    let fieldId;
    // Запись в LPTracker
    try {
        switch (actionType) {
            case 'receipt':
                fieldId = '2126627'
                break;
            case 'appearance':
                fieldId = '2126626'
                break;
            case 'cancelingOrder':
                fieldId = '2133341'
                break;
            default:
                break;
        }

        const uploadResponse = await fetch('https://direct.lptracker.ru/lead/' + leadId, {
            headers: {
                "Content-Type": "application/json",
                "token": lpTrackerToken
            },
            method: "PUT",
            body: JSON.stringify({
                custom: {
                    [fieldId]: userReason
                }
            })
        });

        const result = await uploadResponse.json();
        console.log('Результат:', result.status);
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

const getGoogleDocsContent = async (documentId) => {
    const credentials = require('./creds.json');

    const client = new google.auth.JWT(
        credentials.client_email,
        null,
        credentials.private_key,
        ['https://www.googleapis.com/auth/documents']
    );

    client.authorize(function (err) {
        if (err) {
            console.error('Ошибка аутентификации:', err);
            return;
        }
        console.log('Успешная аутентификация Google!');
    });

    const docs = google.docs({
        version: 'v1',
        auth: client,
    });

    try {
        const { data } = await docs.documents.get({
            documentId,
        });

        const content = data.body.content.reduce((acc, section) => {
            if (section.paragraph) {
                acc += section.paragraph.elements.map(element => element.textRun.content).join('');
            }
            return acc;
        }, '');

        return content;
    } catch (error) {
        console.error('Error fetching Google Docs content:', error.message);
        throw error;
    }
};

// Обертка, которая извлекает нужный текст на основе типа уборки
const getCleaningInstructions = async (typeOfCleaning) => {
    try {
        const fullContent = await getGoogleDocsContent(googleDocumentId);
        const sections = fullContent.split("===РАЗДЕЛИТЕЛЬ===");

        // Найти нужный раздел с соответствующим типом уборки
        const section = sections.find(section => section.toLowerCase().includes(typeOfCleaning.toLowerCase()))

        if (!section) {
            console.error(`Раздел для "${typeOfCleaning}" не найден в документе.`);
            return `Инструкция для "${typeOfCleaning}" не найдена.\nСвяжитесь с менеджером.`;
        }

        return section.trim();
    } catch (error) {
        console.error('Произошла ошибка при получении содержимого документа:', error);
        return 'Произошла ошибка при получении инструкции.\nСвяжитесь с менеджером.'
    }
}

const sendUnpaidOrdersReminder = async () => {
    try {
        const orders = await fetchDataAndProcessOrders(50);

        for (const { id, name, address, check, phone, date, executor, parameters, typeOfCleaning } of orders) {
            let message = `У Вас есть неоплаченный заказ\n\nИмя клиента: ${name}\nАдрес клиента: ${address}\nТелефон клиента: ${phone}\nДата и время заказа: ${date}\nТип уборки: ${typeOfCleaning}\nПараметры заказа: ${parameters}\nИсполнитель: ${executor}`;

            if (check === null) {
                message += '\n\nФото чека не добавлено';

                const inlineKeyboard = {
                    inline_keyboard: [
                        [{ text: 'Отправить фото чека', callback_data: 'send_receipt_photo_' + id }],
                        [{ text: 'Не могу отправить фото чека', callback_data: 'cannot_send_receipt_photo_' + id }],
                    ]
                };

                // Находим исполнителя по имени
                const worker = workers.find(w => w.name === executor);

                // Если исполнитель найден, отправляем ему сообщение
                if (worker) {
                    await bot.telegram.sendMessage(worker.chatId, message, { reply_markup: inlineKeyboard, parse_mode: 'Markdown' });
                } else {
                    console.log(`Исполнитель не найден для заказа с ID ${id}`);
                }
            }
        }
    } catch (error) {
        console.error("An error occurred:", error);
        console.error(error.stack);
    }
};

const sendCancelOrdersReminder = async () => {
    try {
        const orders = await fetchDataAndProcessOrders(50);

        for (const { id, name, address, phone, date, executor, parameters, reasonForCancellation, typeOfCleaning } of orders) {
            if (reasonForCancellation) {
                let message = `ЗАКАЗ ОТМЕНЕН!\n\nИмя клиента: ${name}\nПричина отказа: ${reasonForCancellation}\nАдрес клиента: ${address}\nТелефон клиента: ${phone}\nТип уборки: ${typeOfCleaning}\nДата и время заказа: ${date}\nПараметры заказа: ${parameters}\nИсполнитель: ${executor}`;
                let messageForManager = `ЗАКАЗ ИСПОЛНИТЕЛЯ ${executor} ОТМЕНЕН!\n\nИмя клиента: ${name}\nПричина отказа: ${reasonForCancellation}\nАдрес клиента: ${address}\nТелефон клиента: ${phone}\nТип уборки: ${typeOfCleaning}\nДата и время заказа: ${date}\nПараметры заказа: ${parameters}`;


                managers.map(async manager => await bot.telegram.sendMessage(manager.chatId, messageForManager, { parse_mode: 'Markdown' }));

                // Находим исполнителя по имени
                const worker = workers.find(w => w.name === executor);

                // Если исполнитель найден, отправляем ему сообщение
                if (worker) {
                    await bot.telegram.sendMessage(worker.chatId, message, { parse_mode: 'Markdown' });
                } else {
                    console.log(`Исполнитель не найден для заказа с ID ${id}`);
                }
            }
        }
    } catch (error) {
        console.error("An error occurred:", error);
        console.error(error.stack);
    }
};

const fetchDataAndHandleOrders = async () => {
    try {
        const orders = await fetchDataAndProcessOrders(50);

        await fetchDataAndSetTimers(orders);
        await fetchDataAndSendLatestOrder(orders);
    } catch (error) {
        console.error("An error occurred:", error);
    }
}
const fetchDataAndSetTimers = async (orders) => {
    try {
        const futureEvents = filterFutureEvents(orders);

        // Очищаем и обновляем очередь таймеров
        updateTimers(futureEvents);
        console.log('upd timers | В очереди заказов -', timers.length, '\n' + timers.map(t => t.orderId + ' ' + t.targetTime).join('\n'))
    } catch (error) {
        console.error("An error occurred:", error);
    }
}

// Функция для опроса сервера и отправки последнего заказа исполнителям
const fetchDataAndSendLatestOrder = async (orders) => {
    try {
        // Проверка наличия и типа переменной orders
        if (!Array.isArray(orders)) {
            console.error("Invalid or undefined 'orders' array");
            return;
        }

        // Получить последний ID заказа из файла
        const lastOrderId = readLastOrderId();

        // Если есть новые заказы и последний заказ не определен, отправить последний заказ
        if (orders.length > 0) {

            // Получить последний ID заказа из ответа
            const lastOrderIdFromResponse = orders[0].id;

            if (lastOrderId === null || lastOrderId !== lastOrderIdFromResponse) {
                sendLatestOrderToWorkers(orders[0]);

                // Сохранить ID последнего заказа
                writeLastOrderId(lastOrderIdFromResponse);
            }
        }

    } catch (error) {
        console.error("An error occurred:", error);
    }
}

// Функция для опроса сервера и получения списка заказов
const fetchDataAndProcessOrders = async (limit) => {
    // вывод заказов с даты - 01 Jan 2023 00:00:00 GMT
    const createdAtDate = 1672531200;

    try {
        const response = await fetch(`https://direct.lptracker.ru/lead/103451/list?offset=0&limit=${limit}&sort[created_at]=3&filter[created_at_from]=${createdAtDate}`, { headers: { token: lpTrackerToken } });
        const data = await response.json();

        if (data || !data.result || data.result.length === 0) {
            console.log('Массив данных пуст или не содержит заказов.');
            return [];
        }

        return data.result.map(({ id, custom, contact }) => {
            const address = ("`" + custom.find(object => object.name === 'Адрес')?.value + "`") || 'не указано';
            const check = custom.find(object => object.name === 'Чек')?.value || null;
            const phone = ('+' + contact?.details?.find(detail => detail.type === 'phone')?.data) || 'не указано';
            const date = custom.find(object => object.name === 'Дата выполнения сделки')?.value || 'не указано';
            const executor = custom.find(object => object.name === 'Исполнитель')?.value[0] || 'не указано';
            const name = contact?.name || 'не указано';
            const parameters = custom.find(object => object.name === 'Важная информация')?.value || 'не указано';
            const typeOfCleaning = custom.find(object => object.name === 'Вид уборки')?.value[0] || 'не указано';
            const isFree = custom.find(object => object.name === 'Свободный заказ')?.value?.[0] === 'Да';
            const reasonForCancellation = custom.find(object => object.name === 'Причина отмены заказа')?.value;
            const reasonForAbsencePhotoReceipt = custom.find(object => object.name === 'Почему не отправлено фото чека?')?.value;

            return { id, name, address, check, phone, date, executor, parameters, typeOfCleaning, isFree, reasonForCancellation, reasonForAbsencePhotoReceipt };
        });
    } catch (error) {
        console.error("An error occurred:", error);
        console.error(error.stack);
        return []; // Если произошла ошибка, возвращаем пустой массив
    }
};


// Функция для установки таймера
const setNotificationTimer = (order) => {
    const { id, name, address, phone, date, executor, parameters, typeOfCleaning } = order;

    const notificationTime = parseDate(date) - new Date() - 15 * 60 * 1000; // 15 минут в миллисекундах

    if (notificationTime > 0) {
        const timerId = setTimeout(async () => {
            // Здесь вызываете функцию отправки уведомления
            console.log('Send notification for order:', order);
            // Находим исполнителя по имени
            const worker = workers.find(w => w.name === executor);

            // Если исполнитель найден, отправляем ему сообщение
            if (worker) {
                const inlineKeyboard = {
                    inline_keyboard: [
                        [{ text: 'Отправить фото внешнего вида', callback_data: 'send_appearance_photo_' + id }],
                        [{ text: 'Не могу отправить фото внешнего вида', callback_data: 'cannot_send_appearance_photo_' + id }],
                        [{ text: 'Отправить фото чека', callback_data: 'send_receipt_photo_' + id }],
                        [{ text: 'Не могу отправить фото чека', callback_data: 'cannot_send_receipt_photo_' + id }],
                        [{ text: 'Инструкция по уборке', callback_data: 'instruction_' + typeOfCleaning }],
                    ]
                };

                const message = `У вас через 15 минут заказ!\n\nИмя клиента: ${name}\nАдрес: ${address}\nТелефон: ${phone}\nДата и время заказа: ${date}\nТип уборки: ${typeOfCleaning}\nПараметры заказа: ${parameters}`
                await bot.telegram.sendMessage(worker.chatId, message, { reply_markup: inlineKeyboard, parse_mode: 'Markdown' });
            } else {
                console.log(`Исполнитель не найден для заказа с ID ${id}`);
            }
        }, notificationTime);

        const targetTime = new Date(Date.now() + notificationTime).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })

        timers.push({ orderId: order.id, targetTime, timerId });
    }
};

// функция для отправки последнего заказа менеджеру
const sendLatestOrderToWorkers = async (order) => {
    try {
        const { id, name, address, phone, date, parameters, typeOfCleaning, executor } = order;

        const worker = workers.find(w => w.name === executor);

        const inlineKeyboard = {
            inline_keyboard: [
                [{ text: 'Отменить заказ', callback_data: 'cancel_this_order_' + id }],
                [{ text: 'Послушать запись звонка', callback_data: 'listen_to_call_recording_' + id }],

            ]
        };

        const message = `Новый заказ:\n\nИмя клиента: ${name}\nАдрес: ${address}\nТелефон: ${phone}\nДата и время заказа: ${date}\nТип уборки: ${typeOfCleaning}\nПараметры заказа: ${parameters}`;

        if (worker) {
            await bot.telegram.sendMessage(worker.chatId, message, { reply_markup: inlineKeyboard, parse_mode: 'Markdown' })
                .then(console.log(worker.chatId, 'new order OK'))
                .catch(err => console.error(worker.chatId, 'new order error: ', err))
        }
    } catch (error) {
        console.error("An error occurred while sending the latest order to worker:", error);
    }
};

// функция для фильтрации будущих событий по полю date
const filterFutureEvents = (orders) => {
    const currentDate = new Date();

    if (Array.isArray(orders)) {
        return orders.filter(order => {
            if (order.date && order.date !== 'не указано' && parseDate(order.date)) {
                const orderDate = parseDate(order.date);
                return orderDate > currentDate;
            }
        });
    } else {
        console.error('Orders is not an array or is undefined.');
        return [];
    }

};

// Функция для обновления очереди
const updateTimers = (newOrders) => {
    // Очищаем предыдущие таймеры
    timers.forEach(({ timerId }) => clearTimeout(timerId));
    timers.length = 0;

    // Устанавливаем новые таймеры для новых заказов
    newOrders.forEach(order => setNotificationTimer(order));
};

// Функция для чтения ID последнего заказа из файла
const readLastOrderId = () => {
    try {
        const data = fs.readFileSync('lastOrderId.txt', 'utf8');
        return parseInt(data);
    } catch (error) {
        // Если файл не существует или произошла ошибка при чтении, вернуть null
        return null;
    }
};

// Функция для записи ID последнего заказа в файл
const writeLastOrderId = (id) => {
    fs.writeFileSync('lastOrderId.txt', id.toString(), 'utf8');
};

// Функция для парсинга даты из строки
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


// Таймеры

// Исполнителю о неоплаченных заказах в 10:00 и 16:00
cron.schedule('0 10,16 * * *', sendUnpaidOrdersReminder);

// Исполнителю и менеджерам об отмененных заказах в 10:00 и 16:00
cron.schedule('1 10,16 * * *', sendCancelOrdersReminder);

// уведомление за 15 мин до начала заказа
// отслеживание появления нового заказа
fetchDataAndHandleOrders();
setInterval(() => {
    fetchDataAndHandleOrders();
}, 1 * 60 * 1000); // каждые 1 минут