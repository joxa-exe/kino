require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = Number(process.env.ADMIN_ID);
const CHANNELS = process.env.CHANNELS.split(",");

const KINO_FILE = "./kinolar.json";
const USERS_FILE = "./users.json";

/* ---------- YORDAMCHI FUNKSIYALAR ---------- */
function loadJSON(path, def) {
  if (!fs.existsSync(path)) {
    fs.writeFileSync(path, JSON.stringify(def, null, 2));
    return def;
  }
  try {
    return JSON.parse(fs.readFileSync(path));
  } catch {
    return def;
  }
}

function saveJSON(path, data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

function addUser(id) {
  const users = loadJSON(USERS_FILE, []);
  if (!users.includes(id)) {
    users.push(id);
    saveJSON(USERS_FILE, users);
  }
}

/* ---------- MAJBURIY OBUNA ---------- */
async function checkSub(ctx) {
  if (ctx.from.id === ADMIN_ID) return true;

  let notSub = [];

  for (let ch of CHANNELS) {
    try {
      const m = await ctx.telegram.getChatMember(ch, ctx.from.id);
      if (["left", "kicked"].includes(m.status)) notSub.push(ch);
    } catch {
      notSub.push(ch);
    }
  }

  if (notSub.length > 0) {
    await ctx.reply(
      "❌ Kino olish uchun quyidagi kanallarga obuna bo‘ling:",
      Markup.inlineKeyboard(
        notSub.map(c => [Markup.button.url(`➕ ${c}`, `https://t.me/${c.replace("@", "")}`)])
      )
    );
    return false;
  }

  return true;
}

/* ---------- START ---------- */
bot.start(async (ctx) => {
  addUser(ctx.from.id);

  if (!(await checkSub(ctx))) return;

  ctx.reply("🎬 Kino kodini yuboring:");
});

/* ---------- KINO QIDIRISH ---------- */
bot.on("text", async (ctx) => {
  const code = ctx.message.text.trim();

  if (!(await checkSub(ctx))) return;

  const kinolar = loadJSON(KINO_FILE, {});
  const kino = kinolar[code];

  if (!kino) {
    return ctx.reply("❌ Bunday kino mavjud emas");
  }

  await ctx.replyWithVideo(kino.file_id, {
    caption: `🎬 ${kino.title}`
  });
});

/* ---------- ADMIN PANEL ---------- */
bot.command("admin", (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;

  ctx.reply(
    "👑 ADMIN PANEL",
    Markup.keyboard([
      ["➕ Kino qo‘shish", "🗑 Kino o‘chirish"],
      ["📊 Statistika"]
    ]).resize()
  );
});

/* ---------- STATISTIKA ---------- */
bot.hears("📊 Statistika", (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;

  const users = loadJSON(USERS_FILE, []);
  const kinolar = loadJSON(KINO_FILE, {});

  ctx.reply(
    `📊 STATISTIKA\n\n` +
    `👥 Foydalanuvchilar: ${users.length}\n` +
    `🎬 Kinolar: ${Object.keys(kinolar).length}`
  );
});

/* ---------- KINO QO‘SHISH ---------- */
let step = {};

bot.hears("➕ Kino qo‘shish", (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  step[ctx.from.id] = { stage: "code" };
  ctx.reply("🔢 Kino kodini yuboring:");
});

bot.on("video", (ctx) => {
  const st = step[ctx.from.id];
  if (!st || ctx.from.id !== ADMIN_ID) return;

  const kinolar = loadJSON(KINO_FILE, {});
  kinolar[st.code] = {
    title: st.title,
    file_id: ctx.message.video.file_id
  };
  saveJSON(KINO_FILE, kinolar);

  delete step[ctx.from.id];
  ctx.reply("✅ Kino saqlandi");
});

bot.on("text", (ctx, next) => {
  const st = step[ctx.from.id];
  if (!st || ctx.from.id !== ADMIN_ID) return next();

  if (st.stage === "code") {
    st.code = ctx.message.text.trim();
    st.stage = "title";
    return ctx.reply("🎬 Kino nomini yuboring:");
  }

  if (st.stage === "title") {
    st.title = ctx.message.text.trim();
    st.stage = "video";
    return ctx.reply("📹 Kino videosini yuboring:");
  }

  next();
});

/* ---------- KINO O‘CHIRISH ---------- */
bot.hears("🗑 Kino o‘chirish", (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  step[ctx.from.id] = { stage: "delete" };
  ctx.reply("❌ O‘chiriladigan kino kodini yuboring:");
});

bot.on("text", (ctx, next) => {
  const st = step[ctx.from.id];
  if (!st || st.stage !== "delete" || ctx.from.id !== ADMIN_ID) return next();

  const kinolar = loadJSON(KINO_FILE, {});
  if (!kinolar[ctx.message.text]) {
    ctx.reply("❌ Bunday kino yo‘q");
  } else {
    delete kinolar[ctx.message.text];
    saveJSON(KINO_FILE, kinolar);
    ctx.reply("🗑 Kino o‘chirildi");
  }

  delete step[ctx.from.id];
});

/* ---------- CRASHDAN HIMOYA ---------- */
process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

/* ---------- ISHGA TUSHIRISH ---------- */
bot.launch();
console.log("✅ BOT ISHGA TUSHDI");
