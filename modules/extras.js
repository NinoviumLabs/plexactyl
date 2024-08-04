const loadConfig = require("../handlers/config.js");
const settings = loadConfig("./config.toml");
const fs = require("fs");
const indexjs = require("../app.js");
const fetch = require("node-fetch");
const Queue = require("../managers/Queue.js");

/* Ensure platform release target is met */
const plexactylModule = { "name": "Extra Features", "api_level": 3, "target_platform": "18.0.0" };

/* Module */
module.exports.plexactylModule = plexactylModule;
module.exports.load = async function (app, db) {
  app.get("/panel", async (req, res) => {
    res.redirect(settings.pterodactyl.domain);
  });

  app.get("/regen", async (req, res) => {
    if (!req.session.pterodactyl) return res.redirect("/login");

    let newsettings = loadConfig("./config.toml");

    if (newsettings.api.client.allow.regen !== true)
      return res.send("You cannot regenerate your password currently.");

    let newpassword = makeid(
      newsettings.api.client.passwordgenerator["length"]
    );
    req.session.password = newpassword;

    await fetch(
      settings.pterodactyl.domain +
        "/api/application/users/" +
        req.session.pterodactyl.id,
      {
        method: "patch",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.pterodactyl.key}`,
        },
        body: JSON.stringify({
          username: req.session.pterodactyl.username,
          email: req.session.pterodactyl.email,
          first_name: req.session.pterodactyl.first_name,
          last_name: req.session.pterodactyl.last_name,
          password: newpassword,
        }),
      }
    );

    let theme = indexjs.get(req);
    res.redirect("/security");
  });

  /* Create a Queue */
  const queue = new Queue();

  app.get("/transfercoins", async (req, res) => {
    if (!req.session.pterodactyl) return res.redirect(`/`);

    const coins = parseInt(req.query.coins);
    if (!coins || !req.query.id)
      return res.redirect(`/transfer?err=MISSINGFIELDS`);
    if (req.query.id.includes(`${req.session.userinfo.id}`))
      return res.redirect(`/transfer?err=CANNOTGIFTYOURSELF`);

    if (coins < 1) return res.redirect(`/transfer?err=TOOLOWCOINS`);

    queue.addJob(async (cb) => {
      const usercoins = await db.get(`coins-${req.session.userinfo.id}`);
      const othercoins = await db.get(`coins-${req.query.id}`);
      if (!othercoins) {
        cb();
        return res.redirect(`/transfer?err=USERDOESNTEXIST`);
      }
      if (usercoins < coins) {
        cb();
        return res.redirect(`/transfer?err=CANTAFFORD`);
      }

      await db.set(`coins-${req.query.id}`, othercoins + coins);
      await db.set(`coins-${req.session.userinfo.id}`, usercoins - coins);

      log(
        "Gifted Coins",
        `${req.session.userinfo.username} sent ${coins}\ coins to the user with the ID \`${req.query.id}\`.`
      );
      cb();
      return res.redirect(`/transfer?err=none`);
    });
  });
};

function makeid(length) {
  let result = "";
  let characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}
