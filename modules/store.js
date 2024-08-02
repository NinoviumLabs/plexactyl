
const indexjs = require("../app.js");
const adminjs = require("./admin.js");
const loadConfig = require("../handlers/config");
const settings = loadConfig("./config.toml");
const fs = require("fs");
const ejs = require("ejs");
const log = require("../misc/log.js");
const moment = require('moment');

const REWARD_AMOUNT = 150;
const DAY_IN_MILLISECONDS = 86400000;


/* REPLACE WITH HELIA 14 DONT FORGET!!! */

/* Ensure platform release target is met */
const plexactylModule = { "name": "Resources Store", "api_level": 3, "target_platform": "18.0.0" };

/* Module */
module.exports.plexactylModule = plexactylModule;
module.exports.load = async function (app, db) {
  app.get("/buy", async (req, res) => {
    if (!req.session.pterodactyl) return res.redirect("/login");

    let newsettings = await enabledCheck(req, res);
    if (!newsettings) return;

    const { type, amount, currency } = req.query;
    if (!type || !amount || !currency) return res.send("Missing type, amount or currency");

    const validTypes = ["ram", "disk", "cpu", "servers"];
    if (!validTypes.includes(type)) return res.send("Invalid type");
    if (!["ZTT", "USD"].includes(currency)) return res.send("Invalid currency");

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 1 || parsedAmount > 10)
      return res.send("Amount must be a number between 1 and 10");

    const theme = indexjs.get(req);
    const failedCallbackPath = theme.settings.redirect[`failedpurchase${type}`] || "/";

    const { per, cost } = newsettings.api.client.coins.store[type];
    const purchaseCostCoins = cost * parsedAmount;
    const purchaseCostUSD = (purchaseCostCoins / 300).toFixed(2);

    const userCoins = (await db.get(`coins-${req.session.userinfo.id}`)) || 0;
    const userUSD = (await db.get(`bal-${req.session.userinfo.id}`)) || 0.0;

    if (currency === "ZTT" && userCoins < purchaseCostCoins)
      return res.redirect(`${failedCallbackPath}?err=CANNOTAFFORD`);
    if (currency === "USD" && userUSD < purchaseCostUSD)
      return res.redirect(`${failedCallbackPath}?err=CANNOTAFFORD`);

    const newResourceCap = (await db.get(`${type}-${req.session.userinfo.id}`)) || 0 + parsedAmount;
    const extraResource = per * parsedAmount;

    if (currency === "ZTT") {
      const newUserCoins = userCoins - purchaseCostCoins;
      await db.set(`coins-${req.session.userinfo.id}`, newUserCoins);
    } else {
      const newUserUSD = userUSD - purchaseCostUSD;
      await db.set(`bal-${req.session.userinfo.id}`, newUserUSD);
    }
    
    await db.set(`${type}-${req.session.userinfo.id}`, newResourceCap);

    let extra = (await db.get(`extra-${req.session.userinfo.id}`)) || {
      ram: 0,
      disk: 0,
      cpu: 0,
      servers: 0,
    };

    extra[type] += extraResource;

    if (Object.values(extra).every((v) => v === 0)) {
      await db.delete(`extra-${req.session.userinfo.id}`);
    } else {
      await db.set(`extra-${req.session.userinfo.id}`, extra);
    }

    adminjs.suspend(req.session.userinfo.id);

    log(
      `Resources Purchased`,
      `${req.session.userinfo.username}#${req.session.userinfo.discriminator} bought ${extraResource} ${type} from the store for \`${currency === "coin" ? purchaseCostCoins : purchaseCostUSD} ${currency}\`.`
    );

    res.redirect(
      (theme.settings.redirect[`purchase${type}`]
        ? theme.settings.redirect[`purchase${type}`]
        : "/") + "?err=none"
    );
  });

app.post('/convert', async (req, res) => {
    if (!req.session.pterodactyl) {
        return res.status(401).send({ message: 'Unauthorized' });
    }

    const userId = req.session.userinfo.id;
    const { fromCurrency, toCurrency, amount } = req.body;

    if (!fromCurrency || !toCurrency || !amount) {
        return res.status(400).send({ message: 'Missing parameters' });
    }

    if (amount <= 0) {
        return res.status(400).send({ message: 'Amount must be greater than zero' });
    }

    if (fromCurrency === toCurrency) {
        return res.status(400).send({ message: 'Conversion between the same currency is not allowed' });
    }

    try {
        const userCoins = (await db.get(`coins-${userId}`)) || 0;
        const userUSD = (await db.get(`bal-${userId}`)) || 0.0;

        if (fromCurrency === 'USD' && toCurrency === 'ZTT') {
            if (userUSD < amount) {
                return res.status(400).send('Insufficient USD balance');
            }

            const coinsToConvert = amount * 300;
            await db.set(`bal-${userId}`, userUSD - amount);
            await db.set(`coins-${userId}`, userCoins + coinsToConvert);
            
            return res.send({ message:  `Converted $${amount} USD to ${coinsToConvert} ZTT` });
        } else if (fromCurrency === 'ZTT' && toCurrency === 'USD') {
            const usdToConvert = amount / 300;
            if (userCoins < amount) {
                return res.status(400).send({ message:  'Insufficient ZTT balance' });
            }

            await db.set(`coins-${userId}`, userCoins - amount);
            await db.set(`bal-${userId}`, userUSD + usdToConvert);

            return res.send({ message:  `Converted ${amount} ZTT to $${usdToConvert.toFixed(2)} USD` });
        } else {
            return res.status(400).send({ message: 'Invalid currency type' });
        }
    } catch (error) {
        console.error('Conversion error:', error);
        return res.status(500).send({ message: 'Internal server error' });
    }
});

app.post('/claim-reward', async (req, res) => {
  if (!req.session.pterodactyl) {
      return res.status(401).send('Unauthorized');
  }

  const userId = req.session.userinfo.id;
  const lastClaim = await db.get(`last-claim-${userId}`);

  if (lastClaim && new Date() - new Date(lastClaim) < DAY_IN_MILLISECONDS) {
      return res.status(403).send('Reward already claimed today.');
  }

  await db.set(`last-claim-${userId}`, new Date().toISOString());
  const currentCoins = (await db.get(`bal-${userId}`)) || 0;
  await db.set(`bal-${userId}`, currentCoins + 0.45);

  res.redirect('../dashboard?err=CLAIMED')
});

app.get('/reward-status', async (req, res) => {
  if (!req.session.pterodactyl) {
      return res.status(401).send('Unauthorized');
  }

  const userId = req.session.userinfo.id;
  const lastClaim = await db.get(`last-claim-${userId}`);

  if (!lastClaim) {
      return res.json({ claimable: true, nextClaimIn: null });
  }

  const timePassed = new Date() - new Date(lastClaim);
  if (timePassed >= DAY_IN_MILLISECONDS) {
      return res.json({ claimable: true, nextClaimIn: null });
  } else {
      const nextClaimIn = DAY_IN_MILLISECONDS - timePassed;
      return res.json({ claimable: false, nextClaimIn });
  }
});

  async function enabledCheck(req, res) {
    const newsettings = loadConfig("./config.toml");
    if (newsettings.api.client.coins.store.enabled) return newsettings;

    const theme = indexjs.get(req);
    ejs.renderFile(
      `./views/${theme.settings.notfound}`,
      await eval(indexjs.renderdataeval),
      null,
      function (err, str) {
        delete req.session.newaccount;
        if (err) {
          console.log(
            `App ― An error has occurred on path ${req._parsedUrl.pathname}:`
          );
          console.log(err);
          return res.send(
            "An error has occurred while attempting to load this page. Please contact an administrator to fix this."
          );
        }
        res.status(200);
        res.send(str);
      }
    );
    return null;
  }
};
