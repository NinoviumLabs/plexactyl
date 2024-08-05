const fetch = require("node-fetch");

module.exports = (key, db, ip, res) => {
  return new Promise(async (resolve) => {
    let ipcache = await db.get(`vpncheckcache-${ip}`);
    if (!ipcache) {
      vpncheck = await (
        await fetch(`https://proxycheck.io/v2/${ip}?key=${key}&vpn=1`)
      )
        .json()
        .catch(() => {});
    }
    if (ipcache || (vpncheck && vpncheck[ip])) {
      if (!ipcache) ipcache = vpncheck[ip].proxy;
      await db.set(`vpncheckcache-${ip}`, ipcache, 172800000);
      // Is a VPN/proxy?
      if (ipcache === "yes") {
        resolve(true);
        return res.send('VPN Detected! Please disable your VPN to continue.');
      } else return resolve(false);
    } else return resolve(false);
  });
};
