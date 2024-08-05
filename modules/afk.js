
const loadConfig = require("../handlers/config");
const settings = loadConfig("./config.toml");

/* Ensure platform release target is met */
const plexactylModule = { "name": "AFK Page", "target_platform": "18.0.x" };

/* Module */
module.exports.plexactylModule = plexactylModule;
module.exports.load = async function(app, db) {
  app.ws("/" + settings.api.afk.path, async (ws, req) => {
    let currentlyonpage = await db.get('afkSessions');
    let settings = loadConfig("./config.toml");
    if (!req.session.pterodactyl) return ws.close();
    if (currentlyonpage[req.session.userinfo.id]) return ws.close();

    currentlyonpage[req.session.userinfo.id] = true;
    await db.set('afkSessions', currentlyonpage)

    // Retrieve the user package type from the database
    let coinRate = settings.api.afk.coins;

    let coinloop = setInterval(
      async function() {
        let usercoins = await db.get("coins-" + req.session.userinfo.id);
        usercoins = usercoins ? usercoins : 0;
        // Adjust the increment based on the user package
        usercoins = usercoins + (coinRate * (settings.api.afk.every / 60));
        await db.set("coins-" + req.session.userinfo.id, usercoins);
      }, settings.api.afk.every * 1000
    );

    ws.onclose = async() => {
      clearInterval(coinloop);
      let newonpage = await db.get('afkSessions');
      delete newonpage[req.session.userinfo.id];
      await db.set('afkSessions', newonpage)
    }
  });
};