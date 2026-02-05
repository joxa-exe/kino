const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
require('dotenv').config();

console.log('🎬 KINO BOT - TO\'LIQ ISHLAYDI');

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = parseInt(process.env.ADMIN_ID);
const CHANNEL_ID = process.env.CHANNEL_ID;
const CHANNEL_USERNAME = process.env.CHANNEL_USERNAME;

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
        const member = await ctx.telegram.getChatMember(CHANNEL_ID, userId);
        return ['creator', 'administrator', 'member'].includes(member.status);
    } catch (error) {
        console.error('Obuna tekshirish xatosi:', error);
        return false;
    }
}

// ========== /start ==========
bot.start(async (ctx) => {
    const userId = ctx.from.id;
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
            `kinolar shu kanalda @NOVAkino_kod` +
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
    const userId = ctx.from.id;
    
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
    const userId = ctx.from.id;
    
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
// Kino qo'shish
bot.action('add_film', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) {
        await ctx.answerCbQuery('❌ Siz admin emassiz!');
        return;
    }
    
    await ctx.answerCbQuery();
    adminState[ctx.from.id] = { step: 'waiting_video' };
    
    await ctx.editMessageText(
        '📤 KINO QO\'SHISH\n\n' +
        '1. Video yoki fayl yuboring\n' +
        '2. Keyin raqam kiriting (faqat raqam)\n\n' +
        '❌ Bekor qilish uchun /admin'
    );
});

// Kinolar ro'yxati
bot.action('list_films', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) {
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

// Kino o'chirish
bot.action('delete_film', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) {
        await ctx.answerCbQuery('❌ Siz admin emassiz!');
        return;
    }
    
    await ctx.answerCbQuery();
    const raqamlar = Object.keys(kinolar).sort((a, b) => parseInt(a) - parseInt(b));
    
    if (raqamlar.length === 0) {
        await ctx.editMessageText('📭 O\'chirish uchun kino yo\'q.');
        return;
    }
    
    // Inline keyboard yaratish
    const keyboard = [];
    
    // Har 3 tasini bitta qatorga
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

// Kino o'chirish (har bir raqam uchun)
bot.action(/del_.+/, async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) {
        await ctx.answerCbQuery('❌ Siz admin emassiz!');
        return;
    }
    
    await ctx.answerCbQuery();
    const raqam = ctx.match[0].replace('del_', '');
    
    if (!kinolar[raqam]) {
        await ctx.editMessageText(`❌ "${raqam}" raqami bilan kino topilmadi.`);
        return;
    }
    
    // Kino o'chirish
    delete kinolar[raqam];
    saqlash();
    
    await ctx.editMessageText(`✅ "${raqam}" raqami bilan kino O'CHIRILDI.`);
});

// Statistika
bot.action('stats', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) {
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

// Video/document qabul qilish (admin uchun)
bot.on(['video', 'document'], async (ctx) => {
    const userId = ctx.from.id;
    
    // Faqat admin uchun
    if (userId !== ADMIN_ID) return;
    
    // Faqat kino qo'shish holatida
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
    const userId = ctx.from.id;
    const text = ctx.message.text;
    
    console.log(`📩 Text: "${text}" from ${userId}`);
    
    // AGAR /admin BO'LSA
    if (text === '/admin') {
        // /admin komandasini yuqoridagi handler qabul qiladi
        return;
    }
    
    // AGAR KOMANDA BO'LSA
    if (text.startsWith('/')) {
        await ctx.reply('❌ Noma\'lum komanda!');
        return;
    }
    
    // AGAR ADMIN KINO QO'SHISH HOLATIDA BO'LSA
    if (userId === ADMIN_ID && adminState[userId] && adminState[userId].step === 'waiting_code') {
        const raqam = text.trim();
        
        // FAQAT RAQAM BO'LISHINI TEKSHIRISH
        if (!/^\d+$/.test(raqam)) {
            await ctx.reply('❌ Faqat raqam kiriting! Qayta kiriting:');
            return;
        }
        
        if (raqam.length < 1) {
            await ctx.reply('❌ Raqam kamida 1 raqamdan iborat bo\'lishi kerak! Qayta kiriting:');
            return;
        }
        
        // Agar raqam allaqachon mavjud bo'lsa
        if (kinolar[raqam]) {
            await ctx.reply(`❌ "${raqam}" raqami allaqachon mavjud! Boshqa raqam kiriting:`);
            return;
        }
        
        const state = adminState[userId];
        
        // Kino qo'shish
        kinolar[raqam] = {
            fileId: state.fileId,
            type: state.type,
            addedAt: new Date().toISOString(),
            addedBy: userId
        };
        
        saqlash();
        
        await ctx.reply(
            `✅ KINO QO'SHILDI!\n\n` +
            `📁 Raqam: ${raqam}\n` +
            `🎬 Turi: ${state.type}\n` +
            `📅 Sana: ${new Date().toLocaleString()}\n\n` +
            `Test qilish uchun ${raqam} raqamini yuboring.`
        );
        
        // Holatni tozalash
        delete adminState[userId];
        return;
    }
    
    // ODDIY FOYDALANUVCHI KINO OLISH
    const raqam = text.trim();
    
    // FAQAT RAQAM BO'LISHINI TEKSHIRISH
    if (!/^\d+$/.test(raqam)) {
        await ctx.reply('❌ Faqat raqam kiriting!');
        return;
    }
    
    // Kino mavjudligini tekshirish
    if (!kinolar[raqam]) {
        await ctx.reply('❌ Bunday raqamli kino topilmadi!');
        return;
    }
    
    const kino = kinolar[raqam];
    
    // MAJBURIY OBUNANI TEKSHIRISH
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
        if (kino.type === 'video') {
            await ctx.replyWithVideo(kino.fileId, {
                caption: `🎬 Raqam: ${raqam}\n\n✅ Tomosha qiling!`
            });
        } else {
            await ctx.replyWithDocument(kino.fileId, {
                caption: `🎬 Raqam: ${raqam}\n\n✅ Yuklab oling!`
            });
        }
        
        console.log(`✅ ${userId} foydalanuvchi "${raqam}" raqamli kinoni yukladi`);
    } catch (error) {
        console.error('Kino yuborish xatosi:', error);
        await ctx.reply('❌ Kino yuborishda xatolik yuz berdi.');
    }
});

// /help
bot.command('help', async (ctx) => {
    const userId = ctx.from.id;
    
    if (userId === ADMIN_ID) {
        await ctx.reply(
            `👑 Admin buyruqlari:\n\n` +
            `/admin - Admin panel\n\n` +
            `Kino qo'shish:\n` +
            `1. /admin > "Kino qo'shish"\n` +
            `2. Video yuboring\n` +
            `3. Raqam yozing (faqat raqam)\n\n` +
            `📢 Kanal: ${CHANNEL_USERNAME}`
        );
    } else {
        await ctx.reply(
            `📖 Botdan foydalanish:\n\n` +
            `1. Kanalga obuna bo'ling\n` +
            `2. Raqam yuboring (faqat raqam)\n` +
            `3. Kino oling!\n\n` +
            `📢 Kanal: ${CHANNEL_USERNAME}\n` +
            `🔢 Raqamni admin beradi.`
        );
    }
});

// /list - kinolar ro'yxati (faqat admin)
bot.command('list', async (ctx) => {
    const userId = ctx.from.id;
    
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
});

// ========== BOTNI ISHGA TUSHIRISH ==========
bot.launch()
    .then(() => {
        console.log('\n✅✅✅ BOT ISHGA TUSHDI!');
        console.log(`🤖 Bot: @${bot.botInfo.username}`);
        console.log(`⏰ Vaqt: ${new Date().toLocaleString()}`);
    })
    .catch(err => {
        console.error('\n❌❌❌ BOT ISHGA TUSHMADI:', err.message);
        process.exit(1);
    });

// To'xtatish
process.once('SIGINT', () => {
    console.log('\n🛑 Bot to\'xtatilmoqda...');
    bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
    console.log('\n🛑 Bot to\'xtatilmoqda...');
    bot.stop('SIGTERM');
});
