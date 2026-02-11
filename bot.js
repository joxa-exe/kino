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
let daily = {};
let weekly = {};
let monthly = {};
const adminState = {};
const lastRequest = {}; // anti-spam

if (fs.existsSync('kinolar.json')) kinolar = JSON.parse(fs.readFileSync('kinolar.json'));
if (fs.existsSync('users.json')) users = JSON.parse(fs.readFileSync('users.json'));
if (fs.existsSync('daily.json')) daily = JSON.parse(fs.readFileSync('daily.json'));
if (fs.existsSync('weekly.json')) weekly = JSON.parse(fs.readFileSync('weekly.json'));
if (fs.existsSync('monthly.json')) monthly = JSON.parse(fs.readFileSync('monthly.json'));

const save = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));

// ================= OBUNA =================
async function checkObuna(ctx, userId) {
    for (const ch of CHANNELS) {
        const channel = ch.startsWith('@') ? ch : '@' + ch;
        try {
            const m = await ctx.telegram.getChatMember(channel, userId);
            if (!['creator', 'administrator', 'member'].includes(m.status)) return false;
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

    if (id === ADMIN_ID) return ctx.reply('👑 Admin panel: /admin');

    if (!(await checkObuna(ctx, id)))
        return ctx.reply('❌ Avval kanallarga obuna bo‘ling', kanalKeyboard());

    ctx.reply('🎬 Kino olish uchun raqam yuboring');
});

// ================= CHECK SUB =================
bot.action('check_sub', async (ctx) => {
    await ctx.answerCbQuery();
    (await checkObuna(ctx, ctx.from.id.toString()))
        ? ctx.editMessageText('✅ Obuna tasdiqlandi')
        : ctx.editMessageText('❌ Hali obuna emassiz', kanalKeyboard());
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
    adminState.step = 'file';
    ctx.editMessageText('📤 Video yoki fayl yuboring');
});

bot.action('delete', (ctx) => {
    adminState.step = 'delete';
    ctx.editMessageText('🗑 O‘chiriladigan kino raqamini yuboring');
});

bot.action('stats', (ctx) => {
    const today = new Date().toISOString().slice(0, 10);
    const w = Object.values(weekly).reduce((a, b) => a + b, 0);
    const m = Object.values(monthly).reduce((a, b) => a + b, 0);
    const all = Object.values(kinolar).reduce((a, b) => a + (b.views || 0), 0);

    let msg =
        `📊 STATISTIKA\n\n` +
        `🎬 Kinolar: ${Object.keys(kinolar).length}\n` +
        `👥 Userlar: ${Object.keys(users).length}\n` +
        `👁 Jami: ${all}\n` +
        `📅 Bugun: ${daily[today] || 0}\n` +
        `📈 Haftalik: ${w}\n` +
        `📆 Oylik: ${m}`;

    ctx.editMessageText(msg);
});

bot.action('top', (ctx) => {
    const sorted = Object.entries(kinolar)
        .sort((a, b) => (b[1].views || 0) - (a[1].views || 0))
        .slice(0, 5);

    if (!sorted.length) return ctx.editMessageText('❌ Hozircha yo‘q');

    let text = '🏆 TOP 5 KINO\n\n';
    sorted.forEach(([k, v], i) => {
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

    // anti-spam (3 sekund)
    if (lastRequest[id] && now - lastRequest[id] < 3000) return;
    lastRequest[id] = now;

    const today = new Date().toISOString().slice(0, 10);
    const week = new Date().getWeek?.() || 'w';
    const month = new Date().toISOString().slice(0, 7);

    // delete
    if (id === ADMIN_ID && adminState.step === 'delete') {
        if (!kinolar[text]) return ctx.reply('❌ Topilmadi');
        delete kinolar[text];
        save('kinolar.json', kinolar);
        adminState.step = null;
        return ctx.reply('🗑 O‘chirildi');
    }

    // admin code
    if (id === ADMIN_ID && adminState.step === 'code') {
        adminState.code = text;
        adminState.step = 'desc';
        return ctx.reply('📝 Tavsif yozing');
    }

    // admin desc
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

    // user kino
    if (!/^\d+$/.test(text) || !kinolar[text]) return;

    if (!(await checkObuna(ctx, id)))
        return ctx.reply('❌ Avval obuna bo‘ling', kanalKeyboard());

    kinolar[text].views++;
    daily[today] = (daily[today] || 0) + 1;
    weekly[week] = (weekly[week] || 0) + 1;
    monthly[month] = (monthly[month] || 0) + 1;

    save('kinolar.json', kinolar);
    save('daily.json', daily);
    save('weekly.json', weekly);
    save('monthly.json', monthly);

    const cap = `🎬 Raqam: ${text}\n📝 ${kinolar[text].description}`;
    kinolar[text].type === 'video'
        ? ctx.replyWithVideo(kinolar[text].fileId, { caption: cap })
        : ctx.replyWithDocument(kinolar[text].fileId, { caption: cap });
});

// ================= RUN =================
bot.launch();
console.log('✅ BOT ISHGA TUSHDI');
process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());
