const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
require('dotenv').config();

console.log('🎬 KINO BOT - DESCRIPTION VERSION');

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID.toString();
const CHANNELS = process.env.CHANNELS.split(',').map(c => c.trim());

const bot = new Telegraf(BOT_TOKEN);

// ================== DATA ==================
let kinolar = {};
const adminState = {};

if (fs.existsSync('kinolar.json')) {
    kinolar = JSON.parse(fs.readFileSync('kinolar.json', 'utf8'));
}

function saqlash() {
    fs.writeFileSync('kinolar.json', JSON.stringify(kinolar, null, 2));
}

// ================== OBUNA TEKSHIRISH ==================
async function checkObuna(ctx, userId) {
    for (const ch of CHANNELS) {
        const channel = ch.startsWith('@') ? ch : '@' + ch;
        try {
            const member = await ctx.telegram.getChatMember(channel, userId);
            if (!['creator', 'administrator', 'member'].includes(member.status)) {
                return false;
            }
        } catch {
            return false;
        }
    }
    return true;
}

// ================== KANAL TUGMALARI ==================
function kanalKeyboard() {
    return Markup.inlineKeyboard([
        ...CHANNELS.map(ch => [
            Markup.button.url(
                `📢 ${ch}`,
                `https://t.me/${ch.replace('@', '')}`
            )
        ]),
        [Markup.button.callback('✅ Obunani tekshirish', 'check_sub')]
    ]);
}

// ================== /START ==================
bot.start(async (ctx) => {
    const userId = ctx.from.id.toString();

    if (userId === ADMIN_ID) {
        return ctx.reply('👑 Admin panel: /admin');
    }

    if (!(await checkObuna(ctx, userId))) {
        return ctx.reply(
            '❌ Avval barcha kanallarga obuna bo‘ling:',
            kanalKeyboard()
        );
    }

    await ctx.reply('🎬 Kino olish uchun @NOVAkino_kod dan olgan kodni yuboring');
});

// ================== CHECK SUB ==================
bot.action('check_sub', async (ctx) => {
    await ctx.answerCbQuery();
    if (await checkObuna(ctx, ctx.from.id.toString())) {
        await ctx.editMessageText('✅ Obuna tasdiqlandi. Kino raqamini yuboring');
    } else {
        await ctx.editMessageText('❌ Hali obuna emasiz', kanalKeyboard());
    }
});

// ================== ADMIN PANEL ==================
bot.command('admin', async (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;
    await ctx.reply(
        '👨‍💻 ADMIN PANEL',
        Markup.inlineKeyboard([
            [Markup.button.callback('🎬 Kino qo‘shish', 'add_film')],
            [Markup.button.callback('📋 Kinolar', 'list_films')]
        ])
    );
});

// ================== ADD FILM ==================
bot.action('add_film', async (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;
    adminState[ADMIN_ID] = { step: 'file' };
    await ctx.editMessageText('📤 Video yoki fayl yuboring');
});

// ================== FILE ==================
bot.on(['video', 'document'], async (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;
    if (!adminState[ADMIN_ID] || adminState[ADMIN_ID].step !== 'file') return;

    adminState[ADMIN_ID] = {
        step: 'code',
        fileId: ctx.message.video
            ? ctx.message.video.file_id
            : ctx.message.document.file_id,
        type: ctx.message.video ? 'video' : 'document'
    };

    await ctx.reply('🔢 Kino raqamini kiriting');
});

// ================== TEXT ==================
bot.on('text', async (ctx) => {
    const userId = ctx.from.id.toString();
    const text = ctx.message.text.trim();

    // ADMIN → KOD
    if (userId === ADMIN_ID && adminState[ADMIN_ID]?.step === 'code') {
        if (!/^\d+$/.test(text)) return ctx.reply('❌ Faqat raqam kiriting');

        adminState[ADMIN_ID].code = text;
        adminState[ADMIN_ID].step = 'desc';

        return ctx.reply('📝 Kino tavsifini yozing');
    }

    // ADMIN → DESCRIPTION
    if (userId === ADMIN_ID && adminState[ADMIN_ID]?.step === 'desc') {
        const state = adminState[ADMIN_ID];

        kinolar[state.code] = {
            fileId: state.fileId,
            type: state.type,
            description: text,
            addedAt: new Date().toISOString()
        };

        saqlash();
        delete adminState[ADMIN_ID];

        return ctx.reply(
            `✅ Kino qo‘shildi!\n\n` +
            `🎬 Raqam: ${state.code}\n` +
            `📝 Tavsif: ${text}`
        );
    }

    // USER → KINO OLISH
    if (!/^\d+$/.test(text)) return;

    if (!kinolar[text]) {
        return ctx.reply('❌ Bunday raqamli kino yo‘q');
    }

    if (!(await checkObuna(ctx, userId))) {
        return ctx.reply('❌ Avval obuna bo‘ling', kanalKeyboard());
    }

    const kino = kinolar[text];
    const caption =
        `🎬 Raqam: ${text}\n` +
        `📝 Tavsif: ${kino.description || 'Mavjud emas'}`;

    if (kino.type === 'video') {
        await ctx.replyWithVideo(kino.fileId, { caption });
    } else {
        await ctx.replyWithDocument(kino.fileId, { caption });
    }
});

// ================== START BOT ==================
bot.launch().then(() => console.log('✅ BOT ISHGA TUSHDI'));
process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());
