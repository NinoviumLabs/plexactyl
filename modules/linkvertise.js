const loadConfig = require("../handlers/config");
const settings = loadConfig("./config.toml");

/* Ensure platform release target is met */
const plexactylModule = { "name": "Linkvertise", "target_platform": "18.1.x" };

/* Module */
module.exports.plexactylModule = plexactylModule;
module.exports.load = async function(app, db) {
  const lvcodes = {}

  app.get(`/cp/lv/gen`, async (req, res) => {
    if (!req.session.pterodactyl) return res.redirect("/cp/login");

    const userId = req.session.userinfo.id;
    const now = Date.now();

    const code = makeid(12);
    const referer = req.headers.referer || req.headers.referrer || '';
    const lvurl = linkvertise(settings.linkvertise.userid, referer + `redeem?code=${code}`);

    lvcodes[userId] = {
      code: code,
      user: userId,
      generated: now
    };

    res.redirect(lvurl);
  });

  app.get(`/cp/earnredeem`, async (req, res) => {
    if (!req.session.pterodactyl) return res.redirect("/cp/login");

    const code = req.query.code;
    if (!code) return res.send('An error occurred with your browser!');
    if (!req.headers.referer || !req.headers.referer.includes('linkvertise.com')) return res.redirect('/cp/earn?err=BYPASSER');

    const userId = req.session.userinfo.id;
    const usercode = lvcodes[userId];
    if (!usercode) return res.redirect(`/cp/earn`);
    if (usercode.code !== code) return res.redirect(`/cp/earn`);
    delete lvcodes[userId];

    // Adding coins
    const coins = await db.get(`coins-${userId}`) || 0;
    const additionalCoins = settings.linkvertise.coins; // Fallback to 10 if not set
    await db.set(`coins-${userId}`, coins + additionalCoins);

    res.redirect(`/cp/earn?err=LINKVERTISECOMPLETED`);
  });

function linkvertise(userid, link) {
  var base_url = `https://link-to.net/${userid}/${Math.random() * 1000}/dynamic`;
  var href = base_url + "?r=" + btoa(encodeURI(link));
  return href;
}

function btoa(str) {
  var buffer;

  if (str instanceof Buffer) {
    buffer = str;
  } else {
    buffer = Buffer.from(str.toString(), "binary");
  }
  return buffer.toString("base64");
}

function makeid(length) {
  let result = '';
  let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

function msToHoursAndMinutes(ms) {
  const msInHour = 3600000
  const msInMinute = 60000

  const hours = Math.floor(ms / msInHour)
  const minutes = Math.round((ms - (hours * msInHour)) / msInMinute * 100) / 100

  let pluralHours = `s`
  if (hours === 1) {
    pluralHours = ``
  }
  let pluralMinutes = `s`
  if (minutes === 1) {
    pluralMinutes = ``
  }

  return `${hours} hour${pluralHours} and ${minutes} minute${pluralMinutes}`
}}