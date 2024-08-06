<hr>

# Plexactyl

All features:
- Resource Management (Use it to create servers, etc)
- Coins (AFK Page earning, Linkvertise earning, Transferring coins)
- Servers (create, view, edit servers)
- User System (auth, regen password, etc)
- Store (buy resources with coins)
- Dashboard (view resources)
- Join for Resources (join discord servers for resources, no frontend)
- Admin (set/add/remove coins & resources)
- API (for bots & other things)

<hr>

# Install Guide

**Caution:** Ensure that Pterodactyl is already configured on a domain or else Plexactyl may not function properly.

Access your VPS through SSH and run these Commands:

```bash
1. sudo apt update -y && sudo apt upgrade -y
2. sudo apt install -y python3-certbot-nginx
3. cd /var/www
4. # Download and unzip the latest Plexactyl release from GitHub into the current folder
5. curl -sL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   # Customize the config.toml file, specifically updating the panel domain, API key, and Discord authentication settings.
6. node . # Start Plexactyl. Take a look at "Running in background and on startup" if you want Plexactyl to run in the background
          # Ctrl + C to stop Plexactyl
8. sudo ufw allow 80
9. sudo ufw allow 443
10. certbot certonly --nginx -d <Your Domain>
11. nano /etc/nginx/sites-enabled/plexactyl.conf
12. # Copy the nginx config from Nginx Proxy Config section and replace <domain> with your domain and <port> with the Port Plexactyl is running on 
    # (You can find the port in the config.toml)
13. sudo systemctl restart nginx
14. # Attempt to access your Plexactyl domain


# Nginx Proxy Config
server {
    listen 80;
    server_name <domain>;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;

    location /afk/ws {
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_pass "http://localhost:<port>/afk/ws";
    }
    
    server_name <domain>;
    ssl_certificate /etc/letsencrypt/live/<domain>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/<domain>/privkey.pem;
    ssl_session_cache shared:SSL:10m;
    ssl_protocols SSLv3 TLSv1 TLSv1.1 TLSv1.2;
    ssl_ciphers  HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
      proxy_pass http://localhost:<port>/;
      proxy_buffering off;
      proxy_set_header X-Real-IP $remote_addr;
  }
}
```

<hr>

# Additional Configuration

#### **Changing the EGG IDs**:
 Pterodactyl often changes the IDs of the EGGs so you might need to change the IDs in the config.toml to match the Pterodactyl ones
 You can find the eggs for Minecraft by using `panel.example.com/admin/nests`. Replace panel.example.com with the actual Domain of your Pterodactyl Installation

How to add more eggs:
1. [Download them from the eggs repository](https://github.com/pelican-eggs/)
2. Add the eggs to your panel
3. Get the egg ID of the egg and configure the variables, startup command, egg ID and docker image.

# Updating 

⚠️ database.sqlite compatibility with Dashactyl 0.4 or Plexactyl/Heliactyl 12 has not been tested.

From Heliactyl or Dashactyl v0.4 to Plexactyl:
1. Store certain information such as your api keys, discord auth settings, etc in a .txt file or somewhere safe
2. Download database.sqlite (This is the Database which includes important data about the user and servers)
3. Delete all files in the directory of the server (or delete and remake the folder if done in ssh)
4. Upload the latest Plexactyl release and unzip it
5. Upload database.sqlite and reconfigure config.toml

Move to a newer Plexactyl release:
1. Delete everything except config.toml, database.sqlite
2. Upload the latest Plexactyl release and unzip it
3. reconfigure config.toml and upload your old database.sqlite
4. All done now start Plexactyl again

# Running in background and on startup
Installing [pm2](https://github.com/Unitech/pm2):
- Run `npm install pm2 -g` on the vps

Starting the Dashboard in Background:
- Change directory to your Plexactyl folder Using `cd` command, Example: `cd /var/www/plexactyl` 
- To run Plexactyl, use `pm2 start index.js --name "Plexactyl"`
- To view logs, run `pm2 logs Plexactyl`

Making the dashboard runs on startup:
- Make sure your dashboard is running in the background with the help of [pm2](https://github.com/Unitech/pm2)
- You can check if Plexactyl is running in background with `pm2 list`
- Once you confirmed that Plexactyl is running in background, you can create a startup script by running `pm2 startup` and `pm2 save`
- Note: Supported init systems are `systemd`, `upstart`, `launchd`, `rc.d`
- To stop your Plexactyl from running in the background, use `pm2 unstartup`

To stop a currently running Plexactyl instance, use `pm2 stop Plexactyl`

# Legacy Deprecation Notice

Heliactyl has now reached EOL (End Of Life) and should not be used in Production.
Please update to Plexactyl or [Fixed Heliactyl](https://github.com/OvernodeProjets/Fixed-Heliactyl)
