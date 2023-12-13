const { Scenes } = require("telegraf");
const path = require("path"); // Подключаю библиотеку path
var envPath = path.join(__dirname, ".env") // создает переменную envPath, которая содержит путь к файлу .env. __dirname - это глобальная переменная в Node.js, которая представляет путь к текущей директории, в которой находится исполняемый файл.
require("dotenv").config({ path: envPath }) //  загружает содержимое файла .env и помещает его в переменные окружения. Модуль dotenv позволяет загружать переменные окружения из файла .env в процесс Node.js
const { lpTrackerToken } = process.env // Деструктуризация telegramToken и lpTrackerToken изenv файла
const fs = require("fs");
const { promisify } = require("util");

const writeFilePromise = promisify(fs.writeFile);

const lookScene = new Scenes.BaseScene("lookScene")
/*
lookScene.enter(ctx => ctx.reply("Отправьте фото внешнего вида"))

lookScene.on('photo', async (ctx) => {
    try {
        const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id
        const fileLink = await ctx.telegram.getFileLink(fileId)
        var fileBuffer = await downloadFile(fileLink, "./image.png")
        const base64Data = fileBuffer.toString('base64')

        const data = {
            name: './image.png',
            mime: 'image/png',
            data: base64Data,
            custom_field_id: 2116594
        }

        const uploadResponse = await fetch(`https://direct.lptracker.ru/lead/81066525/file`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'token': lpTrackerToken
            },
            body: JSON.stringify(data)
        })

        const result = await uploadResponse.json()
        console.log('Результат:', result)
        ctx.reply("Фотография успешно загружена")
        ctx.scene.leave()
    } catch (error) {
        console.error('Ошибка при оатправке запроса:', error)
        ctx.reply('Произошла ошибка при отправке фото внешнего вида')
    }
})

async function downloadFile(url, outputPath) {
    const res = await fetch(url);
    const arrBuffer = await res.arrayBuffer();
    await writeFilePromise(outputPath, Buffer.from(arrBuffer));
    return Buffer.from(arrBuffer)
}

module.exports = lookScene
*/