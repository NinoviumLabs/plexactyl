const loadConfig = require("../handlers/config.js");
const settings = loadConfig("./config.toml");
const indexjs = require("../app.js");
const fetch = require("node-fetch");

/* Ensure platform release target is met */
const plexactylModule = { "name": "Extra Features", "target_platform": "18.0.x" };

/* Module */
module.exports.plexactylModule = plexactylModule;
module.exports.load = async function (app, db) {
  app.get("/cp/panel", async (req, res) => {
    res.redirect(settings.pterodactyl.domain);
  });

  app.get("/cp/regen", async (req, res) => {
    if (!req.session.pterodactyl) return res.redirect("/login");

    if (settings.api.client.allow.regen !== true)
      return res.send("You cannot regenerate your password currently.");

    let newpassword = makeid(
      settings.api.client.passwordgenerator["length"]
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
    res.redirect("/cp/account");
  });

function makeid(length) {
  let result = "";
  let characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}}
