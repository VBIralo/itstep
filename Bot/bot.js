const fs = require("fs");
const path = require("path");
const fetch = require('node-fetch');
const cron = require('node-cron');
const { Telegraf } = require('telegraf');

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

// Загрузка данных из workers.json
const workers = require("./workers.json");

// Пример объекта заказа
const order = { name: "Дмитрий Митин", name: "Мама" };

// Получение chatId из workers.json
const chatId = workers.find(object => object.name === order.name).chatId;

// telegram id админа для теста
// const adminId = 1013645358;
const adminId = 211382461;
const isDev = true;



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
    ctx.reply('Взаимодействие с исполнителями в данном боте происходит посредством нажатия кнопок, в некоторых случаях с отправкой вами сообщений.\n\nТакже в данный бот будут приходить ваши новые заказы.\n\nЗа 15 минут до начала заказа придёт сообщение с вашим заказом.\n\nВ случае наличия неоплаченных заказов, вам будет направлено напоминание о том что необходимо отправить фото чека.\n\nПосмотреть сегодняшние и завтрашние заказы вы можете посредством нажатия соответствующих кнопок. \n\nТакже у вас есть возможность увидеть неоплаченные заказы.\n\nВ графе "Cвободные заказы" можно лицезреть те заказы, которые вы можете взять в работу.\n\nВ разделе "Архив заказов", вы увидите какие заказы вы выполняли раньше.\n\nА ещё всегда есть возможность связаться с вашим менеджером, при возникновении каких-либо вопросов.');
})

bot.hears('Неоплаченные заказы', async (ctx) => {

    try {
        const response = await fetch("https://direct.lptracker.ru/lead/103451/list?offset=0&limit=100&sort[updated_at]=3&filter[created_at_from]=1535529725", { headers: { token: lpTrackerToken } });
        const data = await response.json();

        if (data.result && data.result.length > 0) {
            data.result.forEach(({ id, custom, contact }) => {
                console.log('id', id, custom.find(object => object.name === 'Чек').value)
                const address = custom.find(object => object.name === 'Адрес');
                const check = custom.find(object => object.name === 'Чек').value;
                const phone = contact.details.find(detail => detail.type === 'phone')?.data ?? 'не указано';
                const executor = custom.find(object => object.name === 'Исполнитель')?.value ?? 'не указано';
                const name = contact.name;
                const parameters = custom.find(object => object.name === 'Важная информация').value;

                let message = `Имя клиента: ${name}\nАдрес клиента: ${address.value}\nТелефон клиента: ${phone}\nПараметры заказа: ${parameters}\nИсполнитель: ${executor}`;

                if (check === null) {
                    message += '\n\nФото чека не добавлено';

                    const inlineKeyboard = {
                        inline_keyboard: [
                            [{ text: 'Добавить фото чека', callback_data: 'add_receipt_photo_' + id }]
                        ]
                    };

                    ctx.telegram.sendMessage(ctx.from.id, message, { reply_markup: inlineKeyboard, parse_mode: 'Markdown' }).catch(err => console.log(err));
                }
            });
        } else {
            console.log('Массив данных пуст или не содержит заказов.');
        }
    } catch (error) {
        console.error("An error occurred:", error);
        console.error(error.stack);
    }
});





bot.hears('Заказы на сегодня', async (ctx) => {
    try {
        const response = await fetch("https://direct.lptracker.ru/lead/103451/list?offset=0&limit=20&sort[updated_at]=3&filter[created_at_from]=1535529725", { headers: { token: lpTrackerToken } });
        const data = await response.json(); // Преобразование ответа в JSON 
        // console.log(data.result.custom);

        var time = new Date()
        var date = time.getDate()
        if (date < 10) date = "0" + date
        var month = time.getMonth() + 1
        if (month == 13) month = 1
        if (month < 10) month = "0" + month
        var year = time.getFullYear()

        // var hour = time.getHours() 
        // if (hour < 10) hour = "0" + hour
        // var minute = time.getMinutes() 
        // if (minute < 10) minute = "0" + minute

        var timeNow = `${date}.${month}.${year}`
        // console.log(timeNow)

        data.result.forEach(function (item) {
            // var idList = item.id.toString();
            var address = item.custom.find(object => object.name == 'Адрес');
            var dateOne = item.custom.find(object => object.name == 'Дата выполнения сделки').value;
            let dateOneA = dateOne.split('').slice(0, -6).join('');
            // console.log(dateOneA);
            // let dateOneB = dateOneA.slice(0, -6);
            // let dateOneC = dateOneB.join('');
            var phone = item.contact.details.find(detail => detail.type === 'phone').data;
            var name = item.contact.name;
            var parametrs = item.custom.find(object => object.name == 'Важная информация').value;
            if (timeNow === dateOneA) {
                var message = '\nИмя клиента: ' + name + '\nАдрес клиента: ' + address.value + '\nТелефон клиента: ' + phone + '\nДата и время заказа: ' + dateOne + '\nПараметры заказа: ' + parametrs;// объединяем id и адрес в одну строку
            }
            ctx.reply(message).catch(err => console.log(err));
        });

    } catch (error) {
        console.log("Ошибка при получении данных из LPTracker: " + error);
    }
});

bot.hears('Заказы на завтра', async (ctx) => {
    try {
        const response = await fetch("https://direct.lptracker.ru/lead/103451/list?offset=0&limit=20&sort[updated_at]=3&filter[created_at_from]=1535529725", { headers: { token: lpTrackerToken } });
        const data = await response.json(); // Преобразование ответа в JSON 
        // console.log(data.result.custom);

        var time = new Date()
        var date = time.getDate() + 1
        if (date < 10) date = "0" + date
        var month = time.getMonth() + 1
        if (month == 13) month = 1
        if (month < 10) month = "0" + month
        var year = time.getFullYear()

        // var hour = time.getHours() 
        // if (hour < 10) hour = "0" + hour
        // var minute = time.getMinutes() 
        // if (minute < 10) minute = "0" + minute

        var timeNow = `${date}.${month}.${year}`
        // console.log(timeNow)

        data.result.forEach(function (item) {
            // var idList = item.id.toString();
            var address = item.custom.find(object => object.name == 'Адрес');
            var dateOne = item.custom.find(object => object.name == 'Дата выполнения сделки').value;
            let dateOneA = dateOne.split('').slice(0, -6).join('');
            // console.log(dateOneA);
            // let dateOneB = dateOneA.slice(0, -6);
            // let dateOneC = dateOneB.join('');
            var phone = item.contact.details.find(detail => detail.type === 'phone').data;
            var name = item.contact.name;
            var parametrs = item.custom.find(object => object.name == 'Важная информация').value;
            if (timeNow === dateOneA) {
                var message = '\nИмя клиента: ' + name + '\nАдрес клиента: ' + address.value + '\nТелефон клиента: ' + phone + '\nДата и время заказа: ' + dateOne + '\nПараметры заказа: ' + parametrs;// объединяем id и адрес в одну строку
            }
            ctx.reply(message).catch(err => console.log(err));
        });

    } catch (error) {
        console.log("Ошибка при получении данных из LPTracker: " + error);
    }
});

bot.hears('Архив заказов', async (ctx) => {
    try {
        // Сделать постраничный вывод
        const response = await fetch("https://direct.lptracker.ru/lead/103451/list?offset=0&limit=20&sort[updated_at]=3&filter[created_at_from]=1535529725", { headers: { token: lpTrackerToken } });
        const data = await response.json(); // Преобразование ответа в JSON 

        let message = '20 последних заказов:';

        const responseOut = data.result.map(item => {
            const order = {
                idList: item.id.toString(),
                address: item.custom.find(object => object.name == 'Адрес').value ?? 'не указано',
                dateOne: item.custom.find(object => object.name == 'Дата выполнения сделки').value ?? 'не указано',
                dateOneA: item.custom.find(object => object.name == 'Дата выполнения сделки').value?.split(' ')[0] ?? 'не указано',
                dateForFilter: item.custom.find(object => object.name == 'Дата выполнения сделки').value?.split(' ')[0].split('.').reverse().join('-') ?? null,
                phone: item.contact?.details.find(detail => detail.type == 'phone').data ?? 'не указано',
                name: item.contact?.name ?? 'не указано',
                parametrs: item.custom.find(object => object.name == 'Важная информация').value ?? 'не указано'

            }

            if (order.dateForFilter && new Date() > new Date(order.dateForFilter)) {
                message += '\n\nИмя клиента: ' + order.name + '\nАдрес: ' + order.address + '\nТелефон: ' + order.phone + '\nДата и время заказа: ' + order.dateOne + '\nПараметры заказа: ' + order.parametrs;
                //console.log(message)
            }
        })

        return Promise.all(responseOut).then(() => {
            ctx.reply(message)
        });



    } catch (error) {
        console.log("Ошибка при получении данных из LPTracker: " + error);
    }
});

bot.hears('Свободные заказы', async (ctx) => {
    try {
        const response = await fetch("https://direct.lptracker.ru/lead/103451/list?offset=0&limit=20&sort[updated_at]=3&filter[created_at_from]=1535529725", { headers: { token: lpTrackerToken } });
        const data = await response.json(); // Преобразование ответа в JSON 
        // console.log(data.result[0]);

        data.result.forEach(function (item) {
            // var idList = item.id.toString();
            var address = item.custom.find(object => object.name == 'Адрес');
            var dateOne = item.custom.find(object => object.name == 'Дата выполнения сделки').value;
            var freeOrder = item.custom.find(object => object.name == 'Свободный заказ').value;
            // console.log(freeOrder)
            var phone = item.contact.details.find(detail => detail.type === 'phone').data;
            var name = item.contact.name;
            var parametrs = item.custom.find(object => object.name == 'Важная информация').value;
            if (freeOrder != "") {
                var message = '\nИмя клиента: ' + name + '\nАдрес клиента: ' + address.value + '\nТелефон клиента: ' + phone + '\nДата и время заказа: ' + dateOne + '\nСвободный заказ?: ' + freeOrder + '\nПараметры заказа: ' + parametrs;// объединяем id и адрес в одну строку
            }
            const inlineKeyboard = {
                inline_keyboard: [
                    [{ text: 'Написать менеджеру', callback_data: 'add_freeOrders_callback' }]
                ]
            };

            // Отправляем сообщение с инлайн кнопкой и текстом
            ctx.replyWithMarkdown(message, { reply_markup: inlineKeyboard }).catch(err => console.log(err));
        });

    } catch (error) {
        console.log("Ошибка при получении данных из LPTracker: " + error);
    }
});


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
                        [{ text: 'Добавить фото внешнего вида', callback_data: 'add_appearance_photo_' + leadId }],
                        [{ text: 'Не могу отправить фото внешнего вида', callback_data: 'not_send_outfit' }],
                        [{ text: 'Отправить фото чека', callback_data: 'add_receipt_photo_' + leadId }]
                        [{ text: 'Не могу отправить фото чека', callback_data: 'notSendCheck' }],
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

bot.action(/add_receipt_photo_(\d+)/g, (ctx) => {
    const leadId = ctx.match[1];
    setSessionStep(ctx.update.callback_query.from.id, 'receipt_photo_' + leadId);
    ctx.reply('Пришлите фото чека');
});

bot.action(/add_appearance_photo_(\d+)/g, (ctx) => {
    const leadId = ctx.match[1];
    setSessionStep(ctx.update.callback_query.from.id, 'appearance_photo_' + leadId);
    ctx.reply('Пришлите фото чека');
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



bot.action('send_outfit', async (ctx) => {
    await ctx.reply('Фото внешнего вида');
    await ctx.scene.enter('lookScene'); // Entering the payScene
});

bot.action('not_send_outfit', (ctx) => {
    ctx.reply('Почему не можете отправить фото внешнего вида?');

    bot.on('text', async (ctx) => {
        try {
            const textDescription = ctx.message.text;


            const uploadResponse = await fetch(`https://direct.lptracker.ru/lead/${idLead}`, {
                headers: {
                    "Content-Type": "application/json",
                    "token": lpTrackerToken
                },
                method: "PUT",
                body: JSON.stringify({
                    "custom": {
                        "2126626": textDescription
                    }
                })
            });

            const result = await uploadResponse.json();
            // console.log('Результат:', result);
        } catch (error) {
            console.error('Ошибка:', error);
        }
    });
});



bot.action('notSendCheck', (ctx) => {
    ctx.reply('Почему не можете отправить фото чека?');

    bot.on('text', async (ctx) => {
        try {
            const textDescription = ctx.message.text;


            const uploadResponse = await fetch('https://direct.lptracker.ru/lead/81709010', {
                headers: {
                    "Content-Type": "application/json",
                    "token": lpTrackerToken
                },
                method: "PUT",
                body: JSON.stringify({
                    "custom": {
                        "2126627": textDescription
                    }
                })
            });

            const result = await uploadResponse.json();
            // console.log('Результат:', result);
        } catch (error) {
            console.error('Ошибка:', error);
        }
    });
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