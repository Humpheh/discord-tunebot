var config = {};

// login credentials for the bot
config.bot_email = '<email>';
config.bot_password = '<password>';

// server to join and default channels #'s which should be connected to
config.server_id = "82955839243928320";
config.default_channels = []; // eg [1,2,3] - find ids from !serverlist command

// number of skip requests requried to pass the song
config.skip_req = 2

module.exports = config;
