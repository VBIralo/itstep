const { lpTrackerToken } = process.env;
const fetch = require('node-fetch');
const fs = require("fs");
const { google } = require('googleapis');

// Загрузка данных из json
const workers = require("./workers.json");
const managers = require("./managers.json");

// Объект для хранения предыдущих времен заказов
const previousOrderTimes = {};

// Очередь тайцмеров напоминалок
const timers = [];
let acceptOrderTimers = {};

const googleDocumentId = '1TPBVKx6apa8EsW1weN9FhEx3q3Xy869oRTqnAwoRHVI';


/**
 * Загружает фотографию из телеграма на LPTracker.
 *
 * @param {Object} ctx - Контекст Telegraf, содержащий информацию о сообщении.
 * @param {number} leadId - Идентификатор лида на LPTracker.
 * @param {'receipt'|'appearance'} type - Тип фотографии ('receipt' либо 'appearance').
 * @returns {Promise<void>} - Промис, который разрешается после завершения загрузки фотографии.
 * @throws {Error} - Выбрасывает ошибку в случае неудачной загрузки.
 */
const uploadTelegramPhotoToLPTracker = async (setSessionStep, ctx, leadId, type) => {
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
 * Помещает значение в LPTracker.
 *
 * @param {number} leadId - Идентификатор лида на LPTracker.
 * @param {string | array} value - значение.
 * @param {string} actionType - Тип действия поля.
 * @throws {Error} Если произошла ошибка при выполнении запроса к LPTracker.
 * @returns {Promise<void>} Promise без значения, представляющее завершение операции.
 */
const putValueToLPTracker = async (leadId, value, actionType) => {
    let fieldId;

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
            case 'isCancelOrderSentManager':
                fieldId = '2141353'
                break;
            case 'setOrderFree':
                fieldId = '2106590'
                break;
            case 'writeExecutor':
                fieldId = '2098950'
                break;
            case 'autoAcceptOrder':
                fieldId = '2105539'
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
                    [fieldId]: value
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
    console.log('Получение инструкции об уборке');
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

const sendUnpaidOrdersReminder = async (bot) => {
    console.log('Рассылка уведолмений исполнителям об неоплаченных заказах');
    try {
        const orders = await fetchDataAndProcessOrders(50);

        for (const { id, name, address, receipt, phone, date, executor, parameters, typeOfCleaning, cost, takeTheseThings, reasonForAbsencePhotoReceipt, reasonForCancellation } of orders) {
            let message = `У Вас есть неоплаченный заказ\n\n` + generateMessage({ name, address, phone, date, parameters, executor, cost, takeTheseThings, typeOfCleaning });

            if (receipt === null && !reasonForAbsencePhotoReceipt && !reasonForCancellation) {
                message += '\n\nСкриншот чека не добавлено';

                const inlineKeyboard = {
                    inline_keyboard: [
                        [{ text: 'Отправить скриншот чека', callback_data: 'send_receipt_photo_' + id }],
                        [{ text: 'Не могу отправить скриншот чека', callback_data: 'cannot_send_receipt_photo_' + id }],
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

const sendCancelOrdersReminder = async (bot) => {
    console.log('Рассылка уведолмений менеджерам об отмененных заказах');
    try {
        const orders = await fetchDataAndProcessOrders(50);
        for (const { id, name, address, phone, date, parameters, reasonForCancellation, typeOfCleaning, cost, takeTheseThings, isCancelOrderSentManager } of orders) {
            if (reasonForCancellation && !isCancelOrderSentManager) {
                let messageForManager = `ЗАКАЗ ОТМЕНЕН!\n[Ссылка на лид LPT](https://my.lptracker.ru/#leads/card/${id})\n\n` + generateMessage({ name, address, phone, date, parameters, reasonForCancellation, cost, takeTheseThings, typeOfCleaning });


                managers.map(async manager => {
                    await bot.telegram.sendMessage(manager.chatId, messageForManager, { parse_mode: 'Markdown' });
                    await putValueToLPTracker(id, ["Да"], 'isCancelOrderSentManager')
                });
            }
        }
    } catch (error) {
        console.error("An error occurred:", error);
        console.error(error.stack);
    }
};

const fetchDataAndHandleOrders = async (bot) => {
    try {
        const orders = await fetchDataAndProcessOrders(50);

        //await sendLatestOrderToWorkers(orders[0])

        await fetchDataAndSetTimers(orders, bot);
        await fetchDataAndSendLatestOrder(orders);

        // Проверка изменений во времени заказа
        checkTimeChanges(orders, bot);
    } catch (error) {
        console.error("An error occurred:", error);
    }
}


const fetchDataAndSetTimers = async (orders, bot) => {
    try {
        const futureEvents = filterFutureEvents(orders);

        // Очищаем и обновляем очередь таймеров
        updateTimers(futureEvents, bot);
        console.log('upd timers | В очереди заказов -', timers.length, '\n' + timers.map(t => t.orderId + ' ' + t.targetTime).join('\n'))
    } catch (error) {
        console.error("An error occurred:", error);
    }
}

// Функция для опроса сервера и отправки последнего заказа исполнителям
const fetchDataAndSendLatestOrder = async (orders, bot) => {
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
                sendLatestOrderToWorkers(orders[0], bot);

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

        if (!data || !data.result || data.result.length === 0) {
            console.log('Массив данных пуст или не содержит заказов.');
            return [];
        }

        return data.result.map(({ id, custom, contact }) => {
            const address = ("`" + custom.find(object => object.name === 'Адрес')?.value + "`") || 'не указано';        // Адрес
            const receipt = custom.find(object => object.id === 2079688)?.value || null;                                // Чек
            const phone = ('+' + contact?.details?.find(detail => detail.type === 'phone')?.data) || 'не указано';      // Номер телефона
            const date = custom.find(object => object.id === 2096191)?.value || 'не указано';                           // Дата выполнения сделки
            const executor = custom.find(object => object.id === 2098950)?.value[0] || 'не указано';                    // Исполнитель заказа
            const name = contact?.name || 'не указано';                                                                 // Имя
            const parameters = custom.find(object => object.id === 2079698)?.value || 'не указано';                     // Важная информация
            const cost = custom.find(object => object.id === 2139551)?.value || 'не указано';                           // Стоимость
            const takeTheseThings = custom.find(object => object.id === 2133855)?.value || 'не указано';                // Обязательно взять
            const typeOfCleaning = custom.find(object => object.id === 2098949)?.value[0] || 'не указано';              // Вид уборки
            const isFree = custom.find(object => object.id === 2106590)?.value?.[0] === 'Да';                           // Свободный заказ
            const isCancelOrderSentManager = custom.find(object => object.id === 2141353)?.value?.[0] === 'Да';         // Был ли отмененный заказ отправлен менеджеру
            const reasonForCancellation = custom.find(object => object.id === 2133341)?.value;                          // Причина отмены заказа
            const reasonForAbsencePhotoReceipt = custom.find(object => object.id === 2126627)?.value;                   // Причина почему не отправлено фото чека
            const funnelStep = custom.find(object => object.id === 2079683)?.value;                                     // Шаг воронки

            return {
                id, name, address, receipt, phone, date, executor, parameters, typeOfCleaning, funnelStep,
                isFree, reasonForCancellation, reasonForAbsencePhotoReceipt, cost, takeTheseThings, isCancelOrderSentManager
            };
        });
    } catch (error) {
        console.error("An error occurred:", error);
        console.error(error.stack);
        return []; // Если произошла ошибка, возвращаем пустой массив
    }
};

const checkTimeChanges = (orders, bot) => {
    orders.forEach(order => {
        const orderId = order.id;

        if (order.date && order.date !== 'не указано' && parseDate(order.date)) {
            const currentOrderTime = parseDate(order.date);

            // Если у нас есть предыдущее время для заказа
            if (previousOrderTimes[orderId]) {
                const previousOrderTime = previousOrderTimes[orderId];

                // Если время заказа изменилось
                if (currentOrderTime.getTime() !== previousOrderTime.getTime()) {
                    notifyTimeChange(order, bot);
                }
            }

            // Обновляем предыдущее время для заказа
            previousOrderTimes[orderId] = currentOrderTime;
        }
    });
};

const notifyTimeChange = (order, bot) => {
    // Получить исполнителя заказа
    const executor = order.executor;

    // Отправить уведомление об изменении времени заказа исполнителю
    const worker = workers.find(w => w.name === executor);
    if (worker) {
        const message = `Внимание! Изменено время заказа:\n\n` + generateMessage(order);
        bot.telegram.sendMessage(worker.chatId, message, { parse_mode: 'Markdown' })
            .then(console.log(worker.chatId, 'time change notification OK'))
            .catch(err => console.error(worker.chatId, 'time change notification error: ', err));
    }
};


// Функция для установки таймера
const setNotificationTimer = (order, bot) => {
    const { id, name, address, phone, date, executor, parameters, typeOfCleaning, cost, takeTheseThings, funnelStep } = order;

    const notificationTime = parseDate(date) - new Date() - 15 * 60 * 1000; // 15 минут в миллисекундах

    if (notificationTime > 0 && funnelStep === 1916803) { // проверка времени заказа и шаг воронки соответвует "поставлено в график"
        const timerId = setTimeout(async () => {
            // Здесь вызываете функцию отправки уведомления
            console.log('Send notification for order:', order);
            // Находим исполнителя по имени
            const worker = workers.find(w => w.name === executor);

            // Если исполнитель найден, отправляем ему сообщение
            if (worker) {
                const inlineKeyboard = {
                    inline_keyboard: [
                        [{ text: 'Фото внешнего вида / Не могу отправить фото', callback_data: 'send_appearance_photo_' + id }],
                        [{ text: 'Скриншот чека / Не могу отправить скриншот', callback_data: 'send_receipt_photo_' + id }],
                        [{ text: 'Отправить фото повреждений', callback_data: 'send_damage_photo_' + id }],
                        [{ text: 'Инструкция по уборке', callback_data: 'instruction' }],
                    ]
                };

                const message = `_Через 15 минут у вас заказ, не забудьте отправить фото внешнего вида, чтобы мы понимали, что вы приехали на заказ вовремя, и готовы к работе!_\n\n` + generateMessage({ name, address, phone, date, parameters, executor, cost, takeTheseThings, typeOfCleaning });
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
const sendLatestOrderToWorkers = async (order, bot) => {
    try {
        const { id, name, address, phone, date, parameters, typeOfCleaning, executor, cost, takeTheseThings, funnelStep } = order;

        const worker = workers.find(w => w.name === executor);

        const inlineKeyboard = {
            inline_keyboard: [
                [{ text: 'Отменить заказ', callback_data: 'cancel_this_order_' + id }],
                [{ text: 'Послушать запись звонка', callback_data: 'listen_to_call_recording_' + id }],

            ]
        };

        const message = `Новый заказ:\n\n` + generateMessage({ name, address, phone, date, parameters, executor, cost, takeTheseThings, typeOfCleaning }) + '\n\n_Если заказ не будет отменён в течении 15 минут, то он автоматически будет считаться принятым!_';

        if (worker && funnelStep === 1916803) { // проверка есть ли такой рабочий в списке и шаг воронки соответвует "поставлено в график"
            await bot.telegram.sendMessage(worker.chatId, message, { reply_markup: inlineKeyboard, parse_mode: 'Markdown' })
                .then((ctx) => {
                    // Установить таймер на принятие заказа через 15 минут
                    acceptOrderTimers[order.id] = setTimeout(() => {
                        acceptOrderAutomatically(id, ctx, bot);
                    }, 15 * 60 * 1000);
                })
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
            if (order.date && order.date !== 'не указано' && parseDate(order.date) && !order.reasonForCancellation) {
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
const updateTimers = (newOrders, bot) => {
    // Очищаем предыдущие таймеры
    timers.forEach(({ timerId }) => clearTimeout(timerId));
    timers.length = 0;

    // Устанавливаем новые таймеры для новых заказов
    newOrders.forEach(order => setNotificationTimer(order, bot));
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

// функция для автоматического принятия заказа после 15 минут
const acceptOrderAutomatically = async (orderId, ctx, bot) => {
    try {
        await putValueToLPTracker(orderId, ["Да"], 'autoAcceptOrder')

        clearTimeout(acceptOrderTimers[orderId]);

        console.log(orderId, ctx)
        const inlineKeyboard = {
            inline_keyboard: [
                [{ text: 'Послушать запись звонка', callback_data: 'listen_to_call_recording_' + orderId }],
            ]
        };

        // Обновите сообщение, чтобы уведомить пользователя
        await bot.telegram.editMessageReplyMarkup(ctx.chat.id, ctx.message_id, undefined, inlineKeyboard)

    } catch (error) {
        console.error("An error occurred while accepting the order:", error);
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

const generateMessage = (fields) => {
    const messageParts = [
        fields.name && `*Имя клиента:* ${fields.name}`,
        fields.address && `*Адрес:* ${fields.address}`,
        fields.cost && `*Стоимость:* ${fields.cost}`,
        fields.date && `*Дата и время заказа:* ${fields.date}`,
        fields.phone && `*Телефон:* ${fields.phone}`,
        fields.takeTheseThings && `*Обязательно привезти:* ${fields.takeTheseThings}`,
        fields.typeOfCleaning && `*Тип уборки:* ${fields.typeOfCleaning}`,
        fields.executor && `*Исполнитель:* ${fields.executor}`,
        fields.reasonForCancellation && `*Причина отказа:* ${fields.reasonForCancellation}`,
        fields.parameters && `*Параметры заказа:* ${fields.parameters}`
    ];

    return messageParts.filter(Boolean).join('\n');
};


module.exports = {
    uploadTelegramPhotoToLPTracker,
    getCleaningInstructions,
    sendUnpaidOrdersReminder,
    sendCancelOrdersReminder,
    fetchDataAndHandleOrders,
    fetchDataAndProcessOrders,
    generateMessage,
    parseDate,
    putValueToLPTracker
};