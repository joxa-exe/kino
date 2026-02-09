const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
require('dotenv').config();

console.log('🎬 KINO BOT - TO\'LIQ ISHLAYDI');

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID; // STRING SAQLASH
const CHANNEL_USERNAME = process.env.CHANNEL_USERNAME; // @Nova_premyum

console.log('📋 Sozlamalar:');
console.log(`👑 Admin ID: ${ADMIN_ID}`);
console.log(`📢 Kanal: ${CHANNEL_USERNAME}`);

const bot = new Telegraf(BOT_TOKEN);

// Kinolarni saqlash
let kinolar = {};
const adminState = {};

if (fs.existsSync('kinolar.json')) {
    kinolar = JSON.parse(fs.readFileSync('kinolar.json', 'utf8'));
    console.log(`📂 ${Object.keys(kinolar).length} ta kino yuklandi`);
}

function saqlash() {
    fs.writeFileSync('kinolar.json', JSON.stringify(kinolar, null, 2));
}

// ========== OBUNANI TEKSHIRISH ==========
async function checkObuna(ctx, userId) {
    try {
        const member = await ctx.telegram.getChatMember(`@${CHANNEL_USERNAME.replace('@', '')}`, userId);
        return ['creator', 'administrator', 'member'].includes(member.status);
    } catch (error) {
        console.error('Obuna tekshirish xatosi:', error);
        return false;
    }
}

// ========== /start ==========
bot.start(async (ctx) => {
    const userId = ctx.from.id.toString(); // STRINGGA O'TKAZISH
    const name = ctx.from.first_name || 'Foydalanuvchi';
    
    console.log(`🚀 /start: ${userId} (${name})`);
    
    // ADMIN uchun
    if (userId === ADMIN_ID) {
        await ctx.reply(
            `👑 Admin, salom ${name}!\n\n` +
            `🎬 Kino olish uchun raqam yuboring.\n` +
            `👨‍💻 Admin panel: /admin`
        );
        return;
    }
    
    // USER uchun - MAJBURIY OBUNA
    const obuna = await checkObuna(ctx, userId);
    
    if (obuna) {
        // OBUNA BO'LGAN
        await ctx.reply(
            `✅ Salom ${name}!\n\n` +
            `🎬 Kino botiga xush kelibsiz!\n\n` +
            `📽️ Kino olish uchun raqam yuboring.\n` +
            `Masalan: 123`
        );
    } else {
        // OBUNA BO'LMAGAN
        await ctx.reply(
            `👋 Salom ${name}!\n\n` +
            `🎬 Kino botiga xush kelibsiz!\n\n` +
            `❌ Kanalga obuna bo'lmagansiz!\n\n` +
            `Kino olish uchun avval kanalga obuna bo'ling:\n` +
            `${CHANNEL_USERNAME}`,
            Markup.inlineKeyboard([
                [
                    Markup.button.url('📢 Kanalga o\'tish', `https://t.me/${CHANNEL_USERNAME.replace('@', '')}`),
                    Markup.button.callback('✅ Obunani tekshirish', 'check_sub')
                ]
            ])
        );
    }
});

// ========== OBUNANI TEKSHIRISH TUGMASI ==========
bot.action('check_sub', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();
    
    const obuna = await checkObuna(ctx, userId);
    
    if (obuna) {
        await ctx.editMessageText(
            `✅ Obuna tasdiqlandi!\n\n` +
            `🎬 Endi kino raqamini yuboring:\n` +
            `Masalan: 123`
        );
    } else {
        await ctx.editMessageText(
            `❌ Hali obuna bo'lmagansiz!\n\n` +
            `Iltimos, kanalga obuna bo'ling:\n` +
            `${CHANNEL_USERNAME}`,
            Markup.inlineKeyboard([
                [
                    Markup.button.url('📢 Kanalga o\'tish', `https://t.me/${CHANNEL_USERNAME.replace('@', '')}`),
                    Markup.button.callback('✅ Obunani tekshirish', 'check_sub')
                ]
            ])
        );
    }
});

// ========== /admin PANEL ==========
bot.command('admin', async (ctx) => {
    const userId = ctx.from.id.toString();
    
    console.log(`🔧 /admin bosildi: ${userId}`);
    
    if (userId !== ADMIN_ID) {
        await ctx.reply('❌ Siz admin emassiz!');
        return;
    }
    
    console.log('✅ Admin panel ochilmoqda...');
    
    await ctx.reply(
        '👨‍💻 ADMIN PANEL',
        Markup.inlineKeyboard([
            [
                Markup.button.callback('🎬 Kino qo\'shish', 'add_film'),
                Markup.button.callback('📋 Kinolar ro\'yxati', 'list_films')
            ],
            [
                Markup.button.callback('🗑️ Kino o\'chirish', 'delete_film'),
                Markup.button.callback('📊 Statistika', 'stats')
            ]
        ])
    );
});

// ========== ADMIN CALLBACK HANDLERS ==========
bot.action('add_film', async (ctx) => {
    const userId = ctx.from.id.toString();
    
    if (userId !== ADMIN_ID) {
        await ctx.answerCbQuery('❌ Siz admin emassiz!');
        return;
    }
    
    await ctx.answerCbQuery();
    adminState[userId] = { step: 'waiting_video' };
    
    await ctx.editMessageText(
        '📤 KINO QO\'SHISH\n\n' +
        '1. Video yoki fayl yuboring\n' +
        '2. Keyin raqam kiriting (faqat raqam)\n\n' +
        '❌ Bekor qilish uchun /admin'
    );
});

bot.action('list_films', async (ctx) => {
    const userId = ctx.from.id.toString();
    
    if (userId !== ADMIN_ID) {
        await ctx.answerCbQuery('❌ Siz admin emassiz!');
        return;
    }
    
    await ctx.answerCbQuery();
    const raqamlar = Object.keys(kinolar).sort((a, b) => parseInt(a) - parseInt(b));
    
    if (raqamlar.length === 0) {
        await ctx.editMessageText('📭 Hozircha kinolar mavjud emas.');
        return;
    }
    
    let message = `📋 JAMI ${raqamlar.length} TA KINO:\n\n`;
    
    raqamlar.forEach((raqam, index) => {
        const kino = kinolar[raqam];
        const sana = new Date(kino.addedAt).toLocaleDateString();
        message += `${index + 1}. ${raqam} (${kino.type}) - ${sana}\n`;
    });
    
    await ctx.editMessageText(message);
});

bot.action('delete_film', async (ctx) => {
    const userId = ctx.from.id.toString();
    
    if (userId !== ADMIN_ID) {
        await ctx.answerCbQuery('❌ Siz admin emassiz!');
        return;
    }
    
    await ctx.answerCbQuery();
    const raqamlar = Object.keys(kinolar).sort((a, b) => parseInt(a) - parseInt(b));
    
    if (raqamlar.length === 0) {
        await ctx.editMessageText('📭 O\'chirish uchun kino yo\'q.');
        return;
    }
    
    const keyboard = [];
    for (let i = 0; i < raqamlar.length; i += 3) {
        const row = [];
        for (let j = 0; j < 3 && i + j < raqamlar.length; j++) {
            row.push(Markup.button.callback(raqamlar[i + j], `del_${raqamlar[i + j]}`));
        }
        keyboard.push(row);
    }
    
    await ctx.editMessageText(
        '🗑️ O\'CHIRISH UCHUN KINO TANLANG:',
        Markup.inlineKeyboard(keyboard)
    );
});

bot.action(/del_.+/, async (ctx) => {
    const userId = ctx.from.id.toString();
    
    if (userId !== ADMIN_ID) {
        await ctx.answerCbQuery('❌ Siz admin emassiz!');
        return;
    }
    
    await ctx.answerCbQuery();
    const raqam = ctx.match[0].replace('del_', '');
    
    if (!kinolar[raqam]) {
        await ctx.editMessageText(`❌ "${raqam}" raqami bilan kino topilmadi.`);
        return;
    }
    
    delete kinolar[raqam];
    saqlash();
    
    await ctx.editMessageText(`✅ "${raqam}" raqami bilan kino O'CHIRILDI.`);
});

bot.action('stats', async (ctx) => {
    const userId = ctx.from.id.toString();
    
    if (userId !== ADMIN_ID) {
        await ctx.answerCbQuery('❌ Siz admin emassiz!');
        return;
    }
    
    await ctx.answerCbQuery();
    const jamiKino = Object.keys(kinolar).length;
    const videolar = Object.values(kinolar).filter(k => k.type === 'video').length;
    const dokumentlar = Object.values(kinolar).filter(k => k.type === 'document').length;
    
    await ctx.editMessageText(
        `📊 BOT STATISTIKASI:\n\n` +
        `🎬 Jami kinolar: ${jamiKino}\n` +
        `📹 Videolar: ${videolar}\n` +
        `📄 Dokumentlar: ${dokumentlar}`
    );
});

// ========== VIDEO/DOCUMENT QABUL QILISH ==========
bot.on(['video', 'document'], async (ctx) => {
    const userId = ctx.from.id.toString();
    
    if (userId !== ADMIN_ID) return;
    if (!adminState[userId] || adminState[userId].step !== 'waiting_video') return;
    
    const fileId = ctx.message.video ? ctx.message.video.file_id : ctx.message.document.file_id;
    const type = ctx.message.video ? 'video' : 'document';
    
    adminState[userId] = {
        step: 'waiting_code',
        fileId: fileId,
        type: type
    };
    
    await ctx.reply(
        `✅ ${type === 'video' ? '📹 Video' : '📄 Fayl'} qabul qilindi!\n\n` +
        `🔢 Endi kino raqamini kiriting (faqat raqam):\n` +
        `Masalan: 123, 456, 789`
    );
});

// ========== KINO OLISH ==========
bot.on('text', async (ctx) => {
    const userId = ctx.from.id.toString();
    const text = ctx.message.text.trim();
    
    console.log(`📩 Text: "${text}" from ${userId}`);
    
    // /admin komandasi
    if (text === '/admin') {
        // /admin handler yuqorida ishlaydi
        return;
    }
    
    // /help komandasi
    if (text === '/help') {
        if (userId === ADMIN_ID) {
            await ctx.reply(
                `👑 Admin buyruqlari:\n\n` +
                `/admin - Admin panel\n` +
                `/list - Kinolar ro'yxati\n` +
                `/help - Yordam\n\n` +
                `📢 Kanal: ${CHANNEL_USERNAME}`
            );
        } else {
            await ctx.reply(
                `📖 Botdan foydalanish:\n\n` +
                `1. Kanalga obuna bo'ling\n` +
                `2. Raqam yuboring (faqat raqam)\n` +
                `3. Kino oling!\n\n` +
                `📢 Kanal: ${CHANNEL_USERNAME}`
            );
        }
        return;
    }
    
    // /list komandasi
    if (text === '/list') {
        if (userId !== ADMIN_ID) {
            await ctx.reply('❌ Siz admin emassiz!');
            return;
        }
        
        const raqamlar = Object.keys(kinolar).sort((a, b) => parseInt(a) - parseInt(b));
        if (raqamlar.length === 0) {
            await ctx.reply('📭 Hozircha kinolar mavjud emas.');
            return;
        }
        
        let message = `📋 Jami ${raqamlar.length} ta kino:\n\n`;
        raqamlar.forEach((raqam, index) => {
            const kino = kinolar[raqam];
            const sana = new Date(kino.addedAt).toLocaleDateString();
            message += `${index + 1}. ${raqam} (${kino.type}) - ${sana}\n`;
        });
        
        await ctx.reply(message);
        return;
    }
    
    // ADMIN kino qo'shish holati
    if (userId === ADMIN_ID && adminState[userId] && adminState[userId].step === 'waiting_code') {
        if (!/^\d+$/.test(text)) {
            await ctx.reply('❌ Faqat raqam kiriting! Qayta kiriting:');
            return;
        }
        
        if (text.length < 1) {
            await ctx.reply('❌ Raqam kamida 1 raqamdan iborat bo\'lishi kerak! Qayta kiriting:');
            return;
        }
        
        if (kinolar[text]) {
            await ctx.reply(`❌ "${text}" raqami allaqachon mavjud! Boshqa raqam kiriting:`);
            return;
        }
        
        const state = adminState[userId];
        kinolar[text] = {
            fileId: state.fileId,
            type: state.type,
            addedAt: new Date().toISOString(),
            addedBy: userId
        };
        
        saqlash();
        delete adminState[userId];
        
        await ctx.reply(
            `✅ KINO QO'SHILDI!\n\n` +
            `📁 Raqam: ${text}\n` +
            `🎬 Turi: ${state.type}\n` +
            `📅 Sana: ${new Date().toLocaleString()}\n\n` +
            `Test qilish uchun ${text} raqamini yuboring.`
        );
        return;
    }
    
    // ODDIY FOYDALANUVCHI KINO OLISH
    if (!/^\d+$/.test(text)) {
        await ctx.reply('❌ Faqat raqam kiriting!');
        return;
    }
    
    if (!kinolar[text]) {
        await ctx.reply('❌ Bunday raqamli kino topilmadi!');
        return;
    }
    
    // OBUNANI TEKSHIRISH
    const obuna = await checkObuna(ctx, userId);
    if (!obuna) {
        await ctx.reply(
            `❌ Kanalga obuna bo'lmagansiz!\n\n` +
            `${CHANNEL_USERNAME}`,
            Markup.inlineKeyboard([
                [
                    Markup.button.url('📢 Obuna bo\'lish', `https://t.me/${CHANNEL_USERNAME.replace('@', '')}`),
                    Markup.button.callback('🔄 Tekshirish', 'check_sub')
                ]
            ])
        );
        return;
    }
    
    // KINO YUBORISH
    try {
        const kino = kinolar[text];
        if (kino.type === 'video') {
            await ctx.replyWithVideo(kino.fileId, {
                caption: `🎬 Raqam: ${text}\n\n✅ Tomosha qiling!`
            });
        } else {
            await ctx.replyWithDocument(kino.fileId, {
                caption: `🎬 Raqam: ${text}\n\n✅ Yuklab oling!`
            });
        }
        
        console.log(`✅ ${userId} foydalanuvchi "${text}" raqamli kinoni yukladi`);
    } catch (error) {
        console.error('Kino yuborish xatosi:', error);
        await ctx.reply('❌ Kino yuborishda xatolik yuz berdi.');
    }
});

// ========== BOTNI ISHGA TUSHIRISH ==========
let botStarted = false;

bot.launch()
    .then(() => {
        botStarted = true;
        console.log('\n✅✅✅ BOT ISHGA TUSHDI!');
        console.log(`🤖 Bot: @${bot.botInfo.username}`);
        console.log(`⏰ Vaqt: ${new Date().toLocaleString()}`);
        console.log('\n📝 Buyruqlar:');
        console.log('/start - Botni ishga tushirish');
        console.log('/admin - Admin panel');
        console.log('/help - Yordam');
        console.log('/list - Kinolar ro\'yxati (admin)');
    })
    .catch(err => {
        if (err.message.includes('Conflict')) {
            console.error('\n❌ XATO: Bot allaqachon ishlayapti!');
            console.log('🔄 Qanday hal qilish:');
            console.log('1. Terminalni yoping');
            console.log('2. Yangi terminal oching');
            console.log('3. Faqat shu terminalda ishga tushiring');
            console.log('\n🔧 Yoki PM2 dan foydalaning:');
            console.log('pm2 start bot.js --name "kino-bot"');
        } else {
            console.error('\n❌❌❌ BOT ISHGA TUSHMADI:', err.message);
        }
        process.exit(1);
    });

// Graceful shutdown
process.once('SIGINT', () => {
    console.log('\n🛑 Bot to\'xtatilmoqda...');
    bot.stop('SIGINT');
    process.exit(0);
});

process.once('SIGTERM', () => {
    console.log('\n🛑 Bot to\'xtatilmoqda...');
    bot.stop('SIGTERM');
    process.exit(0);
});
