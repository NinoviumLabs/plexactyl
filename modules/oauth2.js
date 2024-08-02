
"use strict";

const loadConfig = require("../handlers/config");
const settings = loadConfig("./config.toml");
const fetch = require("node-fetch");
const indexjs = require("../app.js");
const log = require("../misc/log.js");
const fs = require("fs");
const { renderFile } = require("ejs");
const vpnCheck = require("../misc/vpnCheck.js");

const oauth2Link = settings.api.client.oauth2.link.replace(/\/$/, "");
const callbackPath = settings.api.client.oauth2.callbackpath.replace(/^\//, "/");
const pterodactylDomain = settings.pterodactyl.domain.replace(/\/$/, "");

/* Ensure platform release target is met */
const plexactylModule = { "name": "Discord OAuth2", "api_level": 3, "target_platform": "18.0.0" };

/* Module */
module.exports.plexactylModule = plexactylModule;
module.exports.load = async function (app, db) {
  app.get("/login", async (req, res) => {
    if (req.query.redirect) req.session.redirect = "/" + req.query.redirect;
    const newsettings = loadConfig("./config.toml");
    res.redirect(getOAuth2Url(newsettings, req.query.prompt));
  });

  app.get("/logout", (req, res) => {
    const theme = indexjs.get(req);
    req.session.destroy(() => {
      res.redirect(theme.settings.redirect.logout || "/");
    });
  });

  app.get(callbackPath, async (req, res) => {
    if (!req.query.code) return res.redirect(`/login`);
    res.send(getOAuth2CallbackHtml(req.query.code));
  });

  app.get(`/submitlogin`, async (req, res) => {
    const customredirect = req.session.redirect;
    delete req.session.redirect;
    if (!req.query.code) return res.send("Missing code.");

    const newsettings = loadConfig("./config.toml");
    const ip = getClientIp(req, newsettings);
    
    if (await checkVpnAndBlock(ip, newsettings, db, res)) return;

    const codeinfo = await fetchOAuth2Token(req.query.code);
    if (codeinfo.ok !== true) return res.redirect(`/login`);

    const codeInfoJson = await codeinfo.json();
    if (await hasMissingScopes(codeInfoJson.scope, newsettings, res)) return;

    const userinfo = await fetchUserinfo(codeInfoJson.access_token);
    if (settings.whitelist.status && !settings.whitelist.users.includes(userinfo.id)) {
      return res.send("Service is under maintenance.");
    }

    const guildsinfo = await fetchGuildsinfo(codeInfoJson.access_token);
    if (userinfo.verified) {
      if (await handleVerifiedUser(req, res, db, userinfo, guildsinfo, codeInfoJson, customredirect)) {
        return;
      }
    } else {
      res.send("Not verified a Discord account. Please verify the email on your Discord account.");
    }
  });
};

async function handleVerifiedUser(req, res, db, userinfo, guildsinfo, codeInfoJson, customredirect) {
  const newsettings = loadConfig("./config.toml");
  const ip = getClientIp(req, newsettings);

  if (await checkDuplicateIpUser(db, ip, userinfo.id, res, newsettings)) return true;

  await handleJ4R(db, userinfo, guildsinfo, newsettings);
  await handleJoinGuild(userinfo.id, codeInfoJson.access_token, newsettings);
  await handleGiveRole(userinfo.id, newsettings);
  await handleRolePackages(db, userinfo.id, newsettings);

  if (await db.get("users-" + userinfo.id)) {
    req.session.pterodactyl = await fetchPterodactylUser(db, userinfo.id);
  } else {
    if (newsettings.api.client.allow.newusers) {
      const genpassword = newsettings.api.client.passwordgenerator.signup
        ? makeid(newsettings.api.client.passwordgenerator.length)
        : null;
      await createUser(db, userinfo, genpassword, req);
    } else {
      return res.send("New users cannot signup currently.");
    }
  }

  req.session.userinfo = userinfo;
  const theme = indexjs.get(req);
  res.redirect(customredirect || theme.settings.redirect.callback || "/");
  return false;
}

function getOAuth2Url(newsettings, prompt) {
  return `https://discord.com/api/oauth2/authorize?client_id=${settings.api.client.oauth2.id}&redirect_uri=${encodeURIComponent(
    oauth2Link + callbackPath
  )}&response_type=code&scope=identify%20email${
    newsettings.api.client.bot.joinguild.enabled ? "%20guilds.join" : ""
  }${newsettings.api.client.j4r.enabled ? "%20guilds" : ""}${
    settings.api.client.oauth2.prompt === false
      ? "&prompt=none"
      : prompt
      ? prompt === "none"
        ? "&prompt=none"
        : ""
      : ""
  }`;
}

function getOAuth2CallbackHtml(code) {
  return `
<!doctype html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Space+Grotesk:wght@300..700&family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
  <style>
    @keyframes slideDown {
      from {
        transform: translateY(-100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
    #splashText {
      animation: slideDown 0.3s ease-out;
      overflow: hidden;
      white-space: nowrap;
    }
  </style>
</head>
<body class="bg-[#10181e] flex flex-col items-center justify-center min-h-screen">
  <div class="flex flex-col items-center">
    <img src="../assets/spinner.png" class="h-10 w-10 animate-spin">
    <span id="splashText" style="font-family: 'Space Grotesk'" class="mt-6 uppercase text-zinc-400/50 text-sm tracking-widest">...</span>
  </div>
  <script>
    var splashTexts = ["Inventing new colors for the rainbow.", "Calculating the meaning of life."];
    function updateSplashText() {
      var randomIndex = Math.floor(Math.random() * splashTexts.length);
      var splashText = splashTexts[randomIndex];
      var splashElement = document.getElementById("splashText");
      splashElement.style.animation = 'none';
      splashElement.offsetHeight;
      splashElement.style.animation = 'slideDown 0.3s ease-out';
      splashElement.textContent = splashText;
    }
    setInterval(updateSplashText, 1000);
    updateSplashText();
  </script>
  <script type="text/javascript" defer>
    history.pushState('/login', 'Logging in...', '/login')
    window.location.replace('/submitlogin?code=${encodeURIComponent(code.replace(/'/g, ""))}')
  </script>
</body>
</html>
`;
}

async function fetchOAuth2Token(code) {
  return fetch("https://discord.com/api/oauth2/token", {
    method: "post",
    body: `client_id=${settings.api.client.oauth2.id}&client_secret=${settings.api.client.oauth2.secret}&grant_type=authorization_code&code=${encodeURIComponent(
      code
    )}&redirect_uri=${encodeURIComponent(oauth2Link + callbackPath)}`,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
}

async function hasMissingScopes(scopes, newsettings, res) {
  const requiredScopes = ["identify", "email"];
  if (newsettings.api.client.bot.joinguild.enabled) requiredScopes.push("guilds.join");
  if (newsettings.api.client.j4r.enabled) requiredScopes.push("guilds");

  const missingScopes = requiredScopes.filter(scope => !scopes.includes(scope));
  if (missingScopes.length) {
    res.send(`Missing scopes: ${missingScopes.join(", ")}`);
    return true;
  }
  return false;
}

async function fetchUserinfo(accessToken) {
  const response = await fetch("https://discord.com/api/users/@me", {
    method: "get",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.json();
}

async function fetchGuildsinfo(accessToken) {
  const response = await fetch("https://discord.com/api/users/@me/guilds", {
    method: "get",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.json();
}

async function fetchPterodactylUser(db, userId) {
  const response = await fetch(
    `${pterodactylDomain}/api/application/users/${await db.get("users-" + userId)}?include=servers`,
    {
      method: "get",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.pterodactyl.key}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch Pterodactyl user');
  }

  const data = await response.json();
  return data.attributes;
}

async function createUser(db, userinfo, genpassword, req) {
  const accountResponse = await fetch(`${pterodactylDomain}/api/application/users`, {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.pterodactyl.key}`,
    },
    body: JSON.stringify({
      username: userinfo.id,
      email: userinfo.email,
      first_name: userinfo.username,
      last_name: `#${userinfo.discriminator}`,
      password: genpassword,
    }),
  });
  
  if (accountResponse.ok) {
    const accountInfo = await accountResponse.json();
    const userIds = (await db.get("users")) || [];
    userIds.push(accountInfo.attributes.id);
    await db.set("users", userIds);
    await db.set("users-" + userinfo.id, accountInfo.attributes.id);
    req.session.newaccount = true;
    req.session.password = genpassword;
  } else {
    const accountListResponse = await fetch(
      `${pterodactylDomain}/api/application/users?include=servers&filter[email]=${encodeURIComponent(
        userinfo.email
      )}`,
      {
        method: "get",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.pterodactyl.key}`,
        },
      }
    );
    const accountList = await accountListResponse.json();
    const user = accountList.data.find((acc) => acc.attributes.email === userinfo.email);
    if (user) {
      const userIds = (await db.get("users")) || [];
      if (!userIds.includes(user.attributes.id)) {
        userIds.push(user.attributes.id);
        await db.set("users", userIds);
        await db.set("users-" + userinfo.id, user.attributes.id);
        req.session.pterodactyl = user.attributes;
      } else {
        res.send("We have detected an account with your Discord email on it but the user id has already been claimed on another Discord account.");
      }
    } else {
      res.send("An error has occurred when attempting to create your account.");
    }
  }
  log("signup", `${userinfo.username}#${userinfo.discriminator} logged in to the dashboard for the first time!`);
}

async function handleJ4R(db, userinfo, guildsinfo, newsettings) {
  if (newsettings.api.client.j4r.enabled) {
    if (guildsinfo.message === "401: Unauthorized") {
      res.send("Please allow us to know what servers you are in to let the J4R system work properly. <a href='/login'>Login again</a>");
      return;
    }
    let userj4r = (await db.get(`j4rs-${userinfo.id}`)) || [];
    let coins = (await db.get(`coins-${userinfo.id}`)) || 0;

    for (const guild of newsettings.api.client.j4r.ads) {
      if (guildsinfo.find((g) => g.id === guild.id) && !userj4r.find((g) => g.id === guild.id)) {
        userj4r.push({ id: guild.id, coins: guild.coins });
        coins += guild.coins;
      }
    }

    for (const j4r of userj4r) {
      if (!guildsinfo.find((g) => g.id === j4r.id)) {
        userj4r = userj4r.filter((g) => g.id !== j4r.id);
        coins -= j4r.coins;
      }
    }

    await db.set(`j4rs-${userinfo.id}`, userj4r);
    await db.set(`coins-${userinfo.id}`, coins);
  }
}

async function handleJoinGuild(userId, accessToken, newsettings) {
  if (newsettings.api.client.bot.joinguild.enabled) {
    if (typeof newsettings.api.client.bot.joinguild.guildid === "string") {
      await fetch(`https://discord.com/api/guilds/${newsettings.api.client.bot.joinguild.guildid}/members/${userId}`, {
        method: "put",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bot ${newsettings.api.client.bot.token}`,
        },
        body: JSON.stringify({ access_token: accessToken }),
      });
    } else if (Array.isArray(newsettings.api.client.bot.joinguild.guildid)) {
      for (const guild of newsettings.api.client.bot.joinguild.guildid) {
        await fetch(`https://discord.com/api/guilds/${guild}/members/${userId}`, {
          method: "put",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bot ${newsettings.api.client.bot.token}`,
          },
          body: JSON.stringify({ access_token: accessToken }),
        });
      }
    } else {
      res.send("api.client.bot.joinguild.guildid is not an array nor a string.");
    }
  }
}

async function handleGiveRole(userId, newsettings) {
  if (newsettings.api.client.bot.giverole.enabled) {
    if (typeof newsettings.api.client.bot.giverole.guildid === "string" && typeof newsettings.api.client.bot.giverole.roleid === "string") {
      await fetch(`https://discord.com/api/guilds/${newsettings.api.client.bot.giverole.guildid}/members/${userId}/roles/${newsettings.api.client.bot.giverole.roleid}`, {
        method: "put",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bot ${newsettings.api.client.bot.token}`,
        },
      });
    } else {
      res.send("api.client.bot.giverole.guildid or roleid is not a string.");
    }
  }
}

async function handleRolePackages(db, userId, newsettings) {
  if (newsettings.api.client.packages.rolePackages.roles) {
    const memberResponse = await fetch(`https://discord.com/api/v9/guilds/${newsettings.api.client.packages.rolePackages.roleServer}/members/${userId}`, {
      headers: { Authorization: `Bot ${newsettings.api.client.bot.token}` },
    });
    const memberInfo = await memberResponse.json();

    if (memberInfo.user) {
      const currentPackage = await db.get(`package-${userId}`);
      if (Object.values(newsettings.api.client.packages.rolePackages.roles).includes(currentPackage)) {
        for (const rolePackage in newsettings.api.client.packages.rolePackages.roles) {
          if (newsettings.api.client.packages.rolePackages.roles[rolePackage] === currentPackage && !memberInfo.roles.includes(rolePackage)) {
            await db.set(`package-${userId}`, newsettings.api.client.packages.default);
          }
        }
      }
      for (const role of memberInfo.roles) {
        if (newsettings.api.client.packages.rolePackages.roles[role]) {
          await db.set(`package-${userId}`, newsettings.api.client.packages.rolePackages.roles[role]);
        }
      }
    }
  }
}

async function checkVpnAndBlock(ip, newsettings, db, res) {
  if (newsettings.antivpn.status && ip !== "127.0.0.1" && !newsettings.antivpn.whitelistedIPs.includes(ip)) {
    const vpn = await vpnCheck(newsettings.antivpn.APIKey, db, ip, res);
    return vpn;
  }
  return false;
}

function getClientIp(req, newsettings) {
  const ip = newsettings.api.client.oauth2.ip["trust x-forwarded-for"]
    ? req.headers["x-forwarded-for"] || req.connection.remoteAddress
    : req.connection.remoteAddress;
  return (ip ? ip : "::1").replace(/::1/g, "::ffff:127.0.0.1").replace(/^.*:/, "");
}

async function checkDuplicateIpUser(db, ip, userId, res, newsettings) {
  if (newsettings.api.client.oauth2.ip["duplicate check"] && ip !== "127.0.0.1") {
    const ipUser = await db.get(`ipuser-${ip}`);
    if (ipUser && ipUser !== userId) {
      renderFile(
        `./themes/${newsettings.defaulttheme}/alerts/alt.ejs`,
        {
          settings: newsettings,
          db,
          extra: { home: { name: "VPN Detected" } },
        },
        null,
        (err, str) => {
          if (err) {
            res.send('Another account on your IP has been detected, there can only be one account per IP. Think this is a mistake? <a href="https://discord.gg/halexnodes" target="_blank">Join our discord.</a>');
          } else {
            res.status(200).send(str);
          }
        }
      );
      return true;
    } else if (!ipUser) {
      await db.set(`ipuser-${ip}`, userId);
    }
  }
  return false;
}

function makeid(length) {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length }, () => characters.charAt(Math.floor(Math.random() * characters.length))).join("");
}
