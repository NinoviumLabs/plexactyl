const fetch = require("node-fetch");
const loadConfig = require("../handlers/config");
const settings = loadConfig("./config.toml");

module.exports = () => {
  return new Promise(async (resolve) => {
    const allServers = [];

    async function getServersOnPage(page) {
      return (
        await fetch(
          settings.pterodactyl.domain +
            "/api/application/servers/?page=" +
            page,
          {
            headers: {
              Authorization: `Bearer ${settings.pterodactyl.key}`,
            },
          }
        )
      ).json();
    }

    let currentPage = 1;
    while (true) {
      const page = await getServersOnPage(currentPage);
      allServers.push(...page.data);
      if (page.meta.pagination.total_pages > currentPage) {
        currentPage++;
      } else {
        break;
      }
    }

    resolve(allServers);
  });
};
