# discord-tunebot
Discord bot for playing music requests through voice chat. This is a quick (and messy) bot that takes YouTube requests and plays them back through the voice chat on Discord (<https://discordapp.com/>). This bot is not 100% stable.

The bot takes requests of YouTube videos streams them through the voice chat. Each user can add videos, and the bot rotates through each user in turn for their request.

## Installation
##### Setup node.js
You will need `node.js` to run this bot (<https://nodejs.org/en/>). Once this is installed, navigate to the directory of this and run `npm install` to install the required dependencies. You'll also need to ensure you have downloaded and installed `ffmpeg` (<https://www.ffmpeg.org/>) and that it is in your path variable.

##### Setup config
To add the credentials, rename the `config_example.js` to `config.js` and update the fields with the required login details. You will also need to change the `server_id` field. To get this value, go into the Discord desktop app, right click on the server icon on the left that you want the bot to join and select 'Copy Link'. You will then have a link which looks something like: `https://discordapp.com/channels/82955839391934220/140775196578924181`. The ID after channels is the ID of the server and can be set in config.

##### Setup channels
To run the server, run `node bot.js`. The bot will automatically login to the server if it has access rights, and will create the database file. Type `!serverlist` to get a list of the servers. You need to select one text and one voice server for the bot to log to and to output audio to respectively. The ID's can then be used by `!join <id>` to join that channel. These id's can also be set in the config under `default_channels` to join them automatically on startup. The bot is now running!

## Usage

To see a list of commands, type `!h`. 

##### List of Commands

  - `!serverlist`: List the id's of the servers the bot can join.
  - `!leave`: Leave the current voice chat.
  - `!joinserver <id>`: Join a voice/text server to output to.
  - `!play`: Begin playing music.
  - `!stop`: Stop playing music.
  - `!queue <youtube id>`: Add a song with the YouTube id to the queue (example `!queue dQw4w9WgXcQ`)
  - `!?` or `!list`: List the current play queue.
  - `!skip` Skip this song (instant if requester, requires votes otherwise).
  - `!loadpast` Load previously played songs into your queue.
  - `!clearqueue` Clear all songs from your queue.
  - `!removenext` Remove the next song from your queue.
  - `!h` Show help.
