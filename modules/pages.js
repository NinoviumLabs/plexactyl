const indexjs = require("../app.js");
const express = require("express");

/* Ensure platform release target is met */
const plexactylModule = { "name": "Pages", "target_platform": "18.0.x" };

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
        return res.redirect("/cp/login?prompt=none");
      }

      let theme = indexjs.get(req);
      if (
        theme.settings.mustbeloggedin.includes(req._parsedUrl.pathname) &&
        (!req.session.userinfo || !req.session.pterodactyl)
      ) {
        return res.redirect("/cp/login");
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
