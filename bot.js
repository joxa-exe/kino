const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
require('dotenv').config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID.toString();
const CHANNELS = process.env.CHANNELS.split(',').map(c => c.trim());

const bot = new Telegraf(BOT_TOKEN);

// ================= DATA =================
let kinolar = {};
let users = {};
const adminState = {};
const lastRequest = {};

if (fs.existsSync('kinolar.json'))
    kinolar = JSON.parse(fs.readFileSync('kinolar.json', 'utf8'));

if (fs.existsSync('users.json'))
    users = JSON.parse(fs.readFileSync('users.json', 'utf8'));

const save = (f, d) =>
    fs.writeFileSync(f, JSON.stringify(d, null, 2));

// ================= OBUNA =================
async function checkObuna(ctx, userId) {
    for (const ch of CHANNELS) {
        try {
            const member = await ctx.telegram.getChatMember(
                ch.startsWith('@') ? ch : '@' + ch,
                userId
            );
            if (!['creator', 'administrator', 'member'].includes(member.status))
                return false;
        } catch {
            return false;
        }
    }
    return true;
}

const kanalKeyboard = () =>
    Markup.inlineKeyboard([
        ...CHANNELS.map(c => [
            Markup.button.url(`📢 ${c}`, `https://t.me/${c.replace('@', '')}`)
        ]),
        [Markup.button.callback('✅ Obunani tekshirish', 'check_sub')]
    ]);

// ================= START =================
bot.start(async (ctx) => {
    const id = ctx.from.id.toString();
    users[id] = true;
    save('users.json', users);

    if (id === ADMIN_ID)
        return ctx.reply('👑 Admin panel: /admin');

    if (!(await checkObuna(ctx, id)))
        return ctx.reply('❌ Avval kanallarga obuna bo‘ling', kanalKeyboard());

    ctx.reply('🎬 Kino olish uchun raqam yuboring');
});

// ================= CHECK SUB =================
bot.action('check_sub', async (ctx) => {
    try { await ctx.answerCbQuery(); } catch {}

    const ok = await checkObuna(ctx, ctx.from.id.toString());

    if (ok) {
        try {
            await ctx.editMessageText('✅ Obuna tasdiqlandi. Kino raqamini yuboring');
        } catch {
            ctx.reply('✅ Obuna tasdiqlandi. Kino raqamini yuboring');
        }
    } else {
        try {
            await ctx.editMessageText('❌ Hali obuna emassiz', kanalKeyboard());
        } catch {
            ctx.reply('❌ Hali obuna emassiz', kanalKeyboard());
        }
    }
});

// ================= ADMIN =================
bot.command('admin', (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;

    ctx.reply(
        '👨‍💻 ADMIN PANEL',
        Markup.inlineKeyboard([
            [Markup.button.callback('🎬 Kino qo‘shish', 'add')],
            [Markup.button.callback('🗑 Kino o‘chirish', 'delete')],
            [Markup.button.callback('📊 Statistika', 'stats')],
            [Markup.button.callback('🏆 TOP kinolar', 'top')]
        ])
    );
});

// ================= ADMIN ACTIONS =================
bot.action('add', (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;
    adminState.step = 'file';
    ctx.editMessageText('📤 Video yoki fayl yuboring');
});

bot.action('delete', (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;
    adminState.step = 'delete';
    ctx.editMessageText('🗑 O‘chiriladigan kino raqamini yuboring');
});

bot.action('stats', (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;

    const totalViews = Object.values(kinolar)
        .reduce((a, b) => a + (b.views || 0), 0);

    ctx.editMessageText(
        `📊 STATISTIKA\n\n` +
        `🎬 Kinolar: ${Object.keys(kinolar).length}\n` +
        `👥 Userlar: ${Object.keys(users).length}\n` +
        `👁 Jami ko‘rishlar: ${totalViews}`
    );
});

bot.action('top', (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;

    const top = Object.entries(kinolar)
        .sort((a, b) => (b[1].views || 0) - (a[1].views || 0))
        .slice(0, 5);

    if (!top.length)
        return ctx.editMessageText('❌ Hozircha kino yo‘q');

    let text = '🏆 TOP 5 KINO\n\n';
    top.forEach(([k, v], i) => {
        text += `${i + 1}. 🎬 ${k} — 👁 ${v.views}\n`;
    });

    ctx.editMessageText(text);
});

// ================= FILE =================
bot.on(['video', 'document'], (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;
    if (adminState.step !== 'file') return;

    adminState.fileId = ctx.message.video
        ? ctx.message.video.file_id
        : ctx.message.document.file_id;
    adminState.type = ctx.message.video ? 'video' : 'document';
    adminState.step = 'code';

    ctx.reply('🔢 Kino raqamini kiriting');
});

// ================= TEXT =================
bot.on('text', async (ctx) => {
    const id = ctx.from.id.toString();
    const text = ctx.message.text.trim();
    const now = Date.now();

    // anti-spam (3 soniya)
    if (lastRequest[id] && now - lastRequest[id] < 3000) return;
    lastRequest[id] = now;

    // ===== ADMIN DELETE =====
    if (id === ADMIN_ID && adminState.step === 'delete') {
        if (!kinolar[text])
            return ctx.reply('❌ Bunday kino topilmadi');

        delete kinolar[text];
        save('kinolar.json', kinolar);
        adminState.step = null;
        return ctx.reply('🗑 Kino o‘chirildi');
    }

    // ===== ADMIN CODE =====
    if (id === ADMIN_ID && adminState.step === 'code') {
        if (!/^\d+$/.test(text))
            return ctx.reply('❌ Faqat raqam kiriting');

        adminState.code = text;
        adminState.step = 'desc';
        return ctx.reply('📝 Tavsif yozing');
    }

    // ===== ADMIN DESC =====
    if (id === ADMIN_ID && adminState.step === 'desc') {
        kinolar[adminState.code] = {
            fileId: adminState.fileId,
            type: adminState.type,
            description: text,
            views: 0
        };
        save('kinolar.json', kinolar);
        adminState.step = null;
        return ctx.reply('✅ Kino qo‘shildi');
    }

    // ===== USER KINO =====
    if (!/^\d+$/.test(text) || !kinolar[text]) {
        return ctx.reply('❌ Bunday kodli kino mavjud emas');
    }

    if (!(await checkObuna(ctx, id)))
        return ctx.reply('❌ Avval kanallarga obuna bo‘ling', kanalKeyboard());

    kinolar[text].views++;
    save('kinolar.json', kinolar);

    const cap =
        `🎬 Raqam: ${text}\n` +
        `📝 ${kinolar[text].description || 'Tavsif yo‘q'}`;

    if (kinolar[text].type === 'video') {
        ctx.replyWithVideo(kinolar[text].fileId, { caption: cap });
    } else {
        ctx.replyWithDocument(kinolar[text].fileId, { caption: cap });
    }
});

// ================= RUN =================
bot.launch().then(() => console.log('✅ BOT ISHGA TUSHDI'));

process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());
