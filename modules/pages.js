const indexjs = require("../app.js");
const ejs = require("ejs");
const express = require("express");
const loadConfig = require("../handlers/config");
const settings = loadConfig("./config.toml");
const fetch = require("node-fetch");
const arciotext = require("../misc/afk.js");

/* Ensure platform release target is met */
const plexactylModule = { "name": "Pages", "api_level": 3, "target_platform": "18.0.0" };

/* Module */
module.exports.plexactylModule = plexactylModule;
module.exports.load = async function (app, db) {
  app.all("/", async (req, res) => {
    try {
      if (
        req.session.pterodactyl &&
        req.session.pterodactyl.id !==
          (await db.get("users-" + req.session.userinfo.id))
      ) {
        return res.redirect("/login?prompt=none");
      }

      let theme = indexjs.get(req);
      if (
        theme.settings.mustbeloggedin.includes(req._parsedUrl.pathname) &&
        (!req.session.userinfo || !req.session.pterodactyl)
      ) {
        return res.redirect("/login");
      }

      if (theme.settings.mustbeadmin.includes(req._parsedUrl.pathname)) {
        const renderData = await indexjs.renderdataeval(req, theme);
        res.render(theme.settings.index, renderData);
        return;
      }

      const renderData = await indexjs.renderdataeval(req, theme);
      res.render(theme.settings.index, renderData);
    } catch (err) {
      console.log(err);
      res.render("500.ejs", { err });
    }
  });

  app.use("/assets", express.static("./assets"));
  app.use("/preline", express.static("./node_modules/preline"));
};
