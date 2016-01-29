var DiscordClient = require('discord.io');
var fs = require('fs');
var ytdl = require('ytdl-core');
var sqlite3 = require('sqlite3').verbose();
var config = require('./config');

// ====== Setup the database ====== //
var db = new sqlite3.Database('db.db');

db.serialize(function(){
    db.run("CREATE TABLE IF NOT EXISTS "+
        "music (name TEXT, id TEXT, filename TEXT, user TEXT, duration INT, active TEXT);");
    db.run("CREATE UNIQUE INDEX IF NOT EXISTS music_i ON music (id);");
    db.run("CREATE TABLE IF NOT EXISTS playlist (id TEXT, user TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP);");
    db.run("CREATE UNIQUE INDEX IF NOT EXISTS playlist_i ON playlist (id, user);");
});

var text_channel;
var voice_channel;
var serverlist = [];

var shuffle = function(array) {
    // http://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
    var currentIndex = array.length, temporaryValue, randomIndex;
    while (0 !== currentIndex) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }
    return array;
}

var logStatus = function(text){
    console.log(text);
    if (text_channel != undefined)
        bot.sendMessage({ to: text_channel, message: text });
};

var buildServerList = function(){
    var id = 0;
    var channels = bot.servers[config.server_id]['channels'];
    var outstr = '';
    for (var i in channels){
        outstr += '`' + id + "`: " + channels[i].name + " - " + channels[i].type + "\n";
        serverlist.push(channels[i].id);
        id += 1;
    }

    for (var i in config.default_channels){
        joinChannel(config.default_channels[i]);
    }

    return outstr;
};

var joinVoiceChannel = function(){
    bot.joinVoiceChannel(voice_channel, function() {
        logStatus("Joined voice channel!");
    });
};

var leaveVoiceChannel = function(){
    bot.leaveVoiceChannel(voice_channel);
    voice_channel = undefined;
    logStatus("Left voice channel.");
}

var joinChannel = function(id){
    var id = parseInt(id);
    if (id < 0 || id > serverlist.length) {
        return "Failed to join invalid channel.";
    }
    var channels = bot.servers[config.server_id]['channels'];
    var channelId = serverlist[id];
    if (channelId in channels){
        if (channels[channelId].type == "text"){
            text_channel = channelId;
            return "Joined text channel " + channelId;
        } else {
            voice_channel = channelId;
            joinVoiceChannel();
            return "Joined voice channel " + channelId;
        }
    }
    return "Invalid channel to join.";
};

var helpstr = "\n`!serverlist`\n        List the id's of the servers the bot can join." +
    "\n`!leave`\n        Leave the current voice chat." +
    "\n`!joinserver <id>`\n        Join a voice/text server to output to." +
    "\n`!play`\n        Begin playing music." +
    "\n`!stop`\n        Stop playing music." +
    "\n`!q <youtube id>`\n        Add a song with the YouTube id to the queue." +
    "\n`!?` / `!list`\n        List the current play queue." +
    "\n`!skip`\n        Skip this song." +
    "\n`!loadpast`\n        Load previously played songs into your queue." +
    "\n`!clearqueue`\n        Clear all songs from your queue." +
    "\n`!removenext`\n        Remove the next song from your queue." +
    "\n`!h`\n        Show help." +
    "\n`!shuffle`\n        Shuffle your queue." +
    "\n`!playlist`\n        Shows the user playlist." +
    "\n`!add <id seperated by spaces>`\n        Adds songs to the queue (ids from !playlist)." +
    "\n`!remove <id seperated by spaces>`\n        Removes songs from playlist (ids from !playlist).";

// ====== Setup the Discord bot ====== //
var bot = new DiscordClient({
    email: config.bot_email,
    password: config.bot_password,
    autorun: true
});

bot.on('ready', function() {
    console.log("Bot ready: " + bot.username + " (" + bot.id + ")");
    buildServerList();
});

bot.on('message', function(user, userID, channelID, message, rawEvent) {
    var cmds =  message.split(" ");
    var cmd = cmds[0].toLowerCase();
    switch (cmd){
        case '!serverlist':
            var result = buildServerList();
            bot.sendMessage({ to: channelID, message: result });
            break;
        case '!leave':
            leaveVoiceChannel();
            break;
        case '!joinserver':
            if (cmds.length != 2) break;
            var result = joinChannel(cmds[1]);
            bot.sendMessage({ to: channelID, message: result });
            break;
        case '!play':
            startMusic();
            break;
        case '!stop':
            stopSong();
            break;
        case '!q':
        case '!queue':
            if (cmds.length != 2) break;
            queueSong(cmds[1], user);
            break;
        case '!?':
        case '!list':
            printQueue();
            break;
        case '!skip':
            skipSong(user);
            break;
        case '!h':
            logStatus(helpstr);
            break;
        case '!loadpast':
            loadpast(user);
            break;
        case '!clearqueue':
            clearqueue(user);
            break;
        case '!removenext':
            removenext(user);
            break;
        case '!shuffle':
            shuffleQueue(user);
            break;
        case '!playlist':
            outPlaylist(user, channelID);
            break;
        case '!add':
            var arr = cmds.slice(1);
            var ids = [];
            for (i in arr){
                try{
                    ids.push(parseInt(arr[i]));
                } catch (e) {}
            }
            queueIds(user, ids);
            break;
        case '!remove':
            var arr = cmds.slice(1);
            var ids = [];
            for (i in arr){
                try{
                    ids.push(parseInt(arr[i]));
                } catch (e) {}
            }
            removeIds(user, ids);
            break;
    }
});

var download = function(id, user) {
    var isvalidchars = /^[a-zA-Z0-9_-]+$/.test(id);
    if (!isvalidchars || id == null || id.length != 11){
        logStatus("Not a valid YouTube ID.");
        return false;
    }

    var url = 'http://www.youtube.com/watch?v=' + id;
    var fn = 'music/' + id + '.mp3';

    try {
        // if file exists, do not download again
        fs.accessSync(fn, fs.F_OK);
        return true;
    } catch (e) { /* create it */ }

    var download = ytdl(url, { filter: 'audioonly' });
    var info;

    logStatus("Beginning to download new song...")
    download.on('info', (i) => {
        info = i;
    }).on('finish', () => {
        logStatus("**Downloaded:** " + info.title);
        var insert = db.prepare("INSERT OR IGNORE INTO music VALUES (?,?,?,?,?,?)");
        insert.run([info.title, id, fn, user, info.length_seconds, "1"])
        insert.finalize();
    }).on('error', (error) => {
        logStatus("Error: " + error);
        fs.unlink(fn);
    }).pipe(fs.createWriteStream(fn));
    return true;
};

var currentuser;
var currentsong;
var playing = false;
var queue = {};
var usrcycle = [];
var currentskip = [];

var removenext = function(user){
    if (!(user in queue) || queue[user].length == 0) {
        logStatus("No song to remove from your queue.");
        return;
    }
    queue[user].shift();
    logStatus("Removed next song from your queue.");
};

var clearqueue = function(user){
    queue[user] = [];
    logStatus("Cleared " + user + " queue.");
};

var shuffleQueue = function(user) {
    if (user in queue) {
        queue[user] = shuffle(queue[user]);
        logStatus("Shuffled " + user + " queue.");
    }
};

var queueSong = function(id, user, dontnote) {
    if (!download(id)){
        return;
    }
    if (!(user in queue)) {
        queue[user] = [];
    }

    if (usrcycle.indexOf(user) == -1){
        usrcycle.push(user);
    }
    if (!(id in queue[user])){
        queue[user].push(id);
        db.run("INSERT OR IGNORE INTO playlist VALUES (?, ?, CURRENT_TIMESTAMP)", [id, user]);
        if (dontnote !== true)
            logStatus("Song queued.");
    } else {
        if (dontnote !== true)
            logStatus("Song already in your queue.");
    }
};

var printQueue = function(){
    var idarr = [];
    var usrarr = [];
    var usrcount = {};
    var cycledo = true;
    for (var i in usrcycle){
        usrcount[usrcycle[i]] = 0;
    }

    while (cycledo) {
        cycledo = false;
        for (var i in usrcycle) {
            var uname = usrcycle[i];
            var item = queue[uname][usrcount[uname]];

            if (item === undefined) {
                continue;
            }

            idarr.push(item);
            usrarr.push(uname);
            usrcount[uname] += 1;
            cycledo = true;
        }
    }

    var count = 0;
    var outstr = ":arrow_forward: **Now Playing:** ";
    if (currentsong !== undefined){
        outstr +=  currentsong.name + " *(" + currentuser + ")*";
    } else {
        outstr += "*None*";
    }
    outstr += "\n\n**Up Next:**";

    if (idarr.length == 0){
        outstr += "\n*No songs in queue*";
    }

    var getdata = function(ids, depth){
        if (ids.length == 0){
            logStatus(outstr);
            return;
        }
        if (depth >= 5){
            outstr += "\n\n*And " + ids.length + " more songs.*";
            logStatus(outstr);
            return;
        }
        var id = ids.shift();
        db.get("SELECT * FROM music WHERE id = ?", id, function(err, row) {
            var name = "*Unknown File*";
            if (err === null){
                name = row.name;
            }
            outstr += "\n**" + (count+1) + "** - '" + name + "' *(" + usrarr[count] + ")*";
            count += 1;
            getdata(ids, depth + 1);
        });
    };
    getdata(idarr, 0);
};

var getPlaylist = function(user, callback){
    var rows = [];
    db.each("SELECT * FROM playlist LEFT JOIN music ON music.id = playlist.id WHERE playlist.user = ?", user, function(err, row) {
        rows.push(row);
    }, function() {
        callback(rows);
    });
};

var removeIds = function(user, ids){
    getPlaylist(user, function(rows){
        var count = 0;
        for (i in ids){
            try {
                db.run("DELETE FROM playlist WHERE user = ? AND id = ?", [user, rows[ids[i]].id]);
                count += 1;
            } catch (e) { }
        }
        logStatus("Removed " + count + " songs from *" + user + "* playlist.");
    });
};

var queueIds = function(user, ids){
    getPlaylist(user, function(rows){
        var count = 0;
        for (i in ids){
            try {
                queueSong(rows[ids[i]].id, user, true);
                count += 1;
            } catch (e) { }
        }
        logStatus("Queued " + count + " songs from *" + user + "* playlist.");
    });
};

var outPlaylist = function(user, channelId){
    getPlaylist(user, function(rows){
        var outstr = "**" + user + "'s playlist:**\n";
        for (var i in rows){
            var row = rows[i];
            var newstr = "**" + i + "**: '" + row.name + "'\n";
            if ((outstr + newstr).length >= 2000){
                //output here
                bot.sendMessage({ to: channelId, message: outstr });
                outstr = "";
            }
            outstr += newstr;
        }
        bot.sendMessage({ to: channelId, message: outstr });
    });
};

var loadpast = function(user){
    getPlaylist(user, function(rows){
        var shuffled = shuffle(rows);
        for (var i in shuffled){
            queueSong(shuffled[i].id, user, true);
        }
        logStatus("Added " + rows.length + " songs to queue.");
    });
};

var startMusic = function(){
    if (!playing) {
        getNextSong();
    } else {
        logStatus("Music already playing.");
    }
};

var getNextSong = function(){
    if (usrcycle.length == 0){
        logStatus("No music is queued.");
        stopSong();
        return undefined;
    }

    var user = usrcycle.shift();

    if (queue[user].length == 0){
        return getNextSong();
    }
    // readd the user to the queue if they have more songs waiting
    if (queue[user].length > 1) {
        usrcycle.push(user);
    }

    var songid = queue[user].shift();
    playSong(songid, user);
    return undefined;
};

var playSong = function(id, user){
    if (user === undefined){
        user = "No user";
    }

    db.get("SELECT * FROM music WHERE id = ?", id, function(err, row) {
        if (err !== null){
            logStatus("Song not found: " + err);
            return;
        }
        if (row == undefined){
            stopSong();
            return;
        }
        currentsong = row;
        currentuser = user;
        currentskip = [];

        bot.getAudioContext({ channel: voice_channel, stereo: true}, function(stream) {
            logStatus(":musical_note: **Now Playing:** " + row.name + " *(" + user + ")*");
            stream.stopAudioFile(); //To stop an already playing file
            playing = true;
            stream.playAudioFile(row.filename); //To start playing an audio file, will stop when it's done.
            stream.removeAllListeners('fileEnd');
            stream.once('fileEnd', function() {
                playing = false;
                console.log("play next file...");
                getNextSong();
            });
        });
    });
};

var stopSong = function(){
    bot.getAudioContext({ channel: voice_channel, stereo: true}, function(stream) {
        logStatus(":musical_note: **Stopped music**")
        stream.stopAudioFile();
        playing = false;
        currentuser = undefined;
        currentsong = undefined;
    });
};

var skipSong = function(user){
    if (currentuser == user){
        logStatus("*" + user + "* skipped the song.");
        getNextSong();
    } else if (currentskip.length >= config.skip_req) {
        logStatus(currentskip.length + " people voted to skip the song.");
        getNextSong();
    } else if (currentskip.indexOf(user) == -1) {
        currentskip.push(user);
        logStatus(currentskip.length + " votes to skip the song. (" + config.skip_req + " needed)");
    } else {
        logStatus(user + " has already attempted to skip the song. " + currentskip.length + "/" + config.skip_req + " so far.");
    }
};
