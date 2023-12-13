var fs = require("fs")
const path = require("path"); // Подключаю библиотеку path
var envPath = path.join(__dirname, ".env") // создает переменную envPath, которая содержит путь к файлу .env. __dirname - это глобальная переменная в Node.js, которая представляет путь к текущей директории, в которой находится исполняемый файл.
require("dotenv").config({ path: envPath }) //  загружает содержимое файла .env и помещает его в переменные окружения. Модуль dotenv позволяет загружать переменные окружения из файла .env в процесс Node.js
const { telegramToken, lpTrackerToken } = process.env // Деструктуризация telegramToken и lpTrackerToken изenv файла


const fetch = require('node-fetch'); // Подключаю библиотеку запросов
const { Scenes, session, Telegraf } = require('telegraf'); // Подключаю библиотеку Telegraf
const bot = new Telegraf(telegramToken); // создает новый экземпляр класса Telegraf и присваивает его переменной bot. В скобках (telegramToken) указывается аргумент, который передается в конструктор класса
var ordersPath = path.join(__dirname, "orders.json");
const cron = require('node-cron');
const payScene = require("./scenes/payScene");
const lookScene = require("./scenes/lookScene");

const stage = new Scenes.Stage([payScene, lookScene]);

bot.use(payScene, lookScene);
bot.use(stage.middleware());

var workers = require("./workers.json");
const order = { name: "Дмитрий Митин", name: "Мама" };
const chatId = workers.find(object => object.name === order.name).chatId;
// (async function () {
//     bot.launch();
//     await bot.telegram.sendMessage(chatId, { text: "Not inline button" }, { reply_markup: { keyboard: [[{ text: "Неоплаченные заказы" }], [{ text: "Заказы на сегодня" }], [{ text: "Заказы на завтра" }], [{ text: "Архив заказов" }], [{ text: "Свободные заказы" }], [{ text: "Связаться с менеджером" }]] } });
// })();

bot.launch();

bot.start(async (ctx) => {
    ctx.reply('Компания Cleaning Moscow благодарит вас за регистрацию узнать информацию о пользовании ботом можно нажав команду /help', { reply_markup: { keyboard: [[{ text: "Неоплаченные заказы" }], [{ text: "Заказы на сегодня" }], [{ text: "Заказы на завтра" }], [{ text: "Архив заказов" }], [{ text: "Свободные заказы" }], [{ text: "Связаться с менеджером" }]] } })
})

bot.help(async (ctx) => {
    ctx.reply('Взаимодействие с исполнителями в данном боте происходит посредством нажатия кнопок, в некоторых случаях с отправкой вами сообщений.\n\nТакже в данный бот будут приходить ваши новые заказы.\n\nЗа 15 минут до начала заказа придёт сообщение с вашим заказом.\n\nВ случае наличия неоплаченных заказов, вам будет направлено напоминание о том что необходимо отправить фото чека.\n\nПосмотреть сегодняшние и завтрашние заказы вы можете посредством нажатия соответствующих кнопок. \n\nТакже у вас есть возможность увидеть неоплаченные заказы.\n\nВ графе "Cвободные заказы" можно лицезреть те заказы, которые вы можете взять в работу.\n\nВ разделе "Архив заказов", вы увидите какие заказы вы выполняли раньше.\n\nА ещё всегда есть возможность связаться с вашим менеджером, при возникновении каких-либо вопросов.');
})

bot.hears('Неоплаченные заказы', async (ctx) => {

    try {
        const response = await fetch("https://direct.lptracker.ru/lead/103451/list?offset=0&limit=20&sort[updated_at]=3&filter[created_at_from]=1535529725", { headers: { token: lpTrackerToken } });
        const data = await response.json();

        if (data.result && data.result.length > 0) {
            data.result.forEach(({ custom, contact }) => {
                const address = custom.find(object => object.name === 'Адрес');
                const check = custom.find(object => object.name === 'Чек').value;
                const phone = contact.details.find(detail => detail.type === 'phone').data;
                const executor = custom.find(object => object.name === 'Исполнитель').value;
                const name = contact.name;
                const parameters = custom.find(object => object.name === 'Важная информация').value;

                let message = `\nИмя клиента: ${name}\nАдрес клиента: ${address.value}\nТелефон клиента: ${phone}\nПараметры заказа: ${parameters} \nИсполнитель: ${executor}`;

                if (check === null && executor.includes('Абсолют Новосибирск')) {
                    message += '\nФото чека не добавлено'; // Add a message for when the check is null

                    const inlineKeyboard = {
                        inline_keyboard: [
                            [{ text: 'Добавить фото чека', callback_data: 'add_photo_check_callback' }]
                        ]
                    };

                    var workers = require("./workers.json");
                    const order = { name: "Мама" };
                    const chatId = workers.find(object => object.name === order.name).chatId;

                    // Отправка сообщения с использованием chatId
                    ctx.telegram.sendMessage(chatId, message, { reply_markup: inlineKeyboard, parse_mode: 'Markdown' }).catch(err => console.log(err));
                }
                else if (check === null && executor.includes('Александр Краснодар')) {
                    message += '\nФото чека не добавлено'; // Add a message for when the check is null

                    const inlineKeyboard = {
                        inline_keyboard: [
                            [{ text: 'Добавить фото чека', callback_data: 'add_photo_check_callback' }]
                        ]
                    };

                    var workers = require("./workers.json");
                    const order = { name: "Дмитрий Митин" };
                    const chatId = workers.find(object => object.name === order.name).chatId;

                    // Отправка сообщения с использованием chatId
                    ctx.telegram.sendMessage(chatId, message, { reply_markup: inlineKeyboard, parse_mode: 'Markdown' }).catch(err => console.log(err));
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
            if(timeNow === dateOneA){
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
            if(timeNow === dateOneA){
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
//         bot.telegram.sendMessage(1013645358, 'У вас есть неоплаченные заказы', {
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
        bot.telegram.sendMessage(1013645358, 'У вас есть неоплаченные заказы', {
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
        bot.telegram.sendMessage(1013645358, 'У вас есть неоплаченные заказы', {
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




let idLead; // Объявите переменную idLead в доступной области видимости

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
            var idLead = item.id;
            var address = item.custom.find(object => object.name == 'Адрес');
            var dateOne = item.custom.find(object => object.name == 'Дата выполнения сделки').value;
            var phone = item.contact?.details?.find(detail => detail.type === 'phone').data;
            var name = item.contact?.name;
            var parametrs = item.custom.find(object => object.name == 'Важная информация').value;

            if (String(dateOne) === String(timeNow)) {
                var message = 'ID: ' + idLead + '\nИмя клиента: ' + name + '\nАдрес клиента: ' + address.value + '\nТелефон клиента: ' + phone + '\nДата и время заказа: ' + dateOne + '\nПараметры заказа: ' + parametrs;
                var message2 = idLead;
                const inlineKeyboard = {
                    inline_keyboard: [
                        [{ text: 'Добавить фото внешнего вида', callback_data: 'look' }],
                        [{ text: 'Не могу отправить фото внешнего вида', callback_data: 'not_send_outfit' }],
                        [{ text: 'Отправить фото чека', callback_data: 'add_photo_check_callback' }],
                        [{ text: 'Не могу отправить фото чека', callback_data: 'notSendCheck' }],
                        [{ text: 'Памятка', callback_data: 'remember' }]
                    ]
                };

                // Используйте метод bot.telegram.sendMessage
                bot.telegram.sendMessage(1013645358, message, { reply_markup: inlineKeyboard }).catch(err => console.log(err));
                bot.telegram.sendMessage(1013645358, message2, { reply_markup: inlineKeyboard }).catch(err => console.log(err));
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

bot.action('add_photo_check_callback', (ctx) => {
    ctx.reply('Пришлите фото чека');

    // Внутри функции обратного вызова bot.on('photo')
    bot.on('photo', async (ctx) => {
        try {
            // Обработка фотографии чека
            const dataTwo = await ctx.telegram.getFile(ctx.message.photo[0].file_id);
            const fileLink = await ctx.telegram.getFileLink(dataTwo.file_id);
            const fileResponse = await fetch(fileLink);
            const fileBuffer = await fileResponse.buffer();

            const base64Data = fileBuffer.toString('base64');

            const data = {
                name: 'file1.jpg',
                mime: 'image/jpeg',
                data: base64Data,
                custom_field_id: 2079688 // Используйте другой custom_field_id для чеков
            };

            console.log(idLead); // Теперь idLead должна быть доступна здесь

            const uploadResponse = await fetch(`https://direct.lptracker.ru/lead/${idLead}/file`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'token': lpTrackerToken
                },
                body: JSON.stringify(data)
            });

            const result = await uploadResponse.json();
            // console.log('Результат:', result);
        } catch (error) {
            console.error('Ошибка:', error);
        }
    });
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
            bot.telegram.sendMessage(1013645358, message, { reply_markup: inlineKeyboard }).catch(err => console.log(err));
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
//         bot.telegram.sendMessage(1013645358, 'У вас есть неоплаченные заказы', {
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
            bot.telegram.sendMessage(1013645358, message).catch(err => console.log(err));
        });
    }
    catch (error) {
        console.error('Ошибка:', error);
    }
}

const forManager = '52 17 * * *'; // Каждую минуту

// Запускаем cron по расписанию
cron.schedule(forManager, forManagerFunction);
