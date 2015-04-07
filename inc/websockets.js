var ButtonAPI      = require('thebutton'),
    async          = require('async'),
    userHandler    = require('./userHandler.js'),
    instance_token = require('node-uuid').v4(),
    api            = new ButtonAPI(),
    clients        = {},
    subClient      = null;

//TODO sort this shit out
var timer = 100;
var state = 0;
var mode = 'setup';

exports.init = function(f, server, redis) {
    f.getLumberJack().info('[Socket.IO Notification]'.blue + ' Current instance token is ' + instance_token);

    var redis  = require('redis');
    subClient  = redis.createClient(f.getConfig().redis.port, f.getConfig().redis.host);
    subClient.auth(f.getConfig().redis.password);

    setInterval(function () {
        var autoclickers = [];
        var manuals = [];

        userHandler.kick_idlers(redis, clients, function(to_kick) {
            for (var i = 0; i < to_kick.length; i++) {
              console.log('kicking ' + to_kick[i] + ' for idling');
              clients[to_kick[i]].disconnect();
              delete clients[to_kick[i]];
            }
        });

    //     async.waterfall([
    //         function(callback) {
    //             redis.get("canRunInterval", function(err, reply) {
    //                 if(reply !== instance_token) {
    //                     return callback("Instance token Mismatch");
    //                 }
    //                 redis.set("canRunInterval", 300, instance_token);
    //                 kick_idlers();
    //                 return callback(null, reply)
    //             });
    //         },
    //         function(reply, callback) {
    //             client.keys("users:*", function (err, keys) {
    //                 async.each(keys, function(key, cb) {
    //                     redis.hgetall(key, function(err, data) {
    //                         if (data.valid && !(data.alerted  === 'true') && (data.online  === 'true')) {
    //                             if (data.autoclick === 'true') {
    //                                 autoclickers.push(i);
    //                                 return cb(null);
    //                             } else {
    //                                 manuals.push(i);
    //                                 return cb(null);
    //                             }
    //                         }
    //                     });
    //                 }, callback);
    //             });
    //         },
    //         function(callback) {
    //             console.log('Timer: ' + timer);
    //             console.log('Autoclickers: ' + autoclickers.length + ' ' + autoclickers);
    //             console.log('Manuals: ' + manuals.length + ' ' + manuals);

    //             for (var i in clients) {
    //                 redis.hgetall('users:' + clients[i].username, function(err, client) {
    //                     if (!client || !(client.online === 'true')) {
    //                         return;
    //                     }

    //                     var client_msg = {
    //                       server_timer: timer,
    //                       autoclickers: message.autoclickers.length,
    //                       manuals: message.manuals.length,
    //                       alerted: (client.alerted === 'true'),
    //                       instance_token: instance_token,
    //                       autoclick: (client.autoclick === 'true'),
    //                       mode: mode
    //                     };
    //                     clients[i].emit('update', client_msg);
    //                 });
    //             }

    //             redis.publish("update_users", JSON.stringify({autoclickers: autoclickers, manuals: manuals}));

    //             manage_tiers(autoclickers, manuals);
    //         }
    //     ], function (err, result) {
    //         if(err) {
    //             console.error(err);
    //         }
    //     });
    //
    //     button_client.on('message', function (msg) {
    //         msg = JSON.parse(msg);
    //         timer = msg.payload.seconds_left;
    //     });
    }, 100);

    subClient.subscribe('update_users');
    subClient.on('message', function (channel, message) {
        if(channel = 'update_users') {
            message = JSON.parse(message);
            for (var i in clients) {
                redis.hgetall('users:' + clients[i].username, function(err, client) {
                    if (!client || !(client.online === 'true')) {
                        return;
                    }

                    var client_msg = {
                      server_timer: timer,
                      autoclickers: message.autoclickers.length,
                      manuals: message.manuals.length,
                      alerted: (client.alerted === 'true'),
                      instance_token: instance_token,
                      autoclick: (client.autoclick === 'true'),
                      mode: mode
                    };
                    clients[i].emit('update', client_msg);
                });
            }
        }
    });
};

exports.handleConnection = function(f, socket, redis) {
    socket.on('initData', function (msg) {
        //If the user doesn't provide a username, quit
        if (!msg.username) {
            return;
        }

        redis.hgetall('users:' + msg.username, function(err, reply) {
            //Since Redis stores boolean as strings we need to explicitly check/set each bool since 'false' is truthy
            //
            if(reply && (reply.online === 'true')) {
                socket.emit('multipleClients');
                return;
            }

            var client = reply;

            if(reply) {
                client = {
                  username: msg.username,
                  last_ping: now(),
                  valid: msg.valid,
                  client_time: msg.client_time,
                  instance_token: msg.instance_token,
                  online: true,
                  autoclick: ('autoclick' in msg ? msg.autoclick : (reply.autoclick === 'true'))
                };
            } else {
                client = {
                  alerted: false,
                  username: msg.username,
                  last_ping: now(),
                  valid: msg.valid,
                  client_time: msg.client_time,
                  instance_token: msg.instance_token,
                  online: true,
                  autoclick: ('autoclick' in msg ? msg.autoclick : false)
                };
            }

            if (client.instance_token != 'not_set' && client.instance_token != instance_token) {
                console.log('Now reloading' + msg.username);
                socket.emit('reload');
                client.online = false;
                return;
            }

            redis.hmset('users:' + msg.username, client);
            console.log(msg.username + ' just logged in.');

            clients[msg.username] = socket;
            socket.username = msg.username;
        });
    });

    socket.on('ping', function (msg) {
        //If the user doesn't provide a username, quit
        if (!socket.username || !(socket.username in clients)) {
            return;
        }

        redis.hgetall('users:' + socket.username, function(err, client) {
            if (!client) {
                return;
            }
            if (msg.instance_token != 'not_set' && msg.instance_token != instance_token) {
                console.log('Now reloading ' + msg.username + '...');
                socket.emit('reload');
                return;
            }

            //Update last_ping, client_time and autoClick if set
            var updatedClient = {};

            updatedClient.last_ping = now();
            updatedClient.client_time = msg.client_time;
            updatedClient.autoclick = msg.autoclick;
            updatedClient.instance_token = msg.instance_token;

            if('autoclick' in msg) {
                if(updatedClient.autoclick === true) {
                    redis.lpush('autoclickers', socket.username);
                    redis.lrem('manuals', 0, socket.username);
                } else {
                    redis.lpush('manuals', socket.username);
                    redis.lrem('autoclickers', 0, socket.username);
                }
            }

            redis.hmset('users:' + socket.username, updatedClient);
        });
    });

    socket.on('disconnect', function (msg) {
        if (socket.username) {
            console.log(socket.username + ' just disconnected.');
            redis.hset('users:' + socket.username, 'online', false);
            redis.lrem('autoclickers', 0, socket.username);
            redis.lrem('manuals', 0, socket.username);
            delete clients[socket.username];
        }
    });
};

exports.handleAnnouncements = function(f, server, redisClient) {
    subClient.subscribe('announcement_channel');
    subClient.on('message', function (channel, message) {
        if(channel = 'announcement_channel') {
            for (var i = Object.keys(clients).length - 1; i >= 0; i--) {
                clients[Object.keys(clients)[i]].emit('announcement', {body: message});
            };
        }
    });

    var readline = require('readline'),
        rl = readline.createInterface(process.stdin, process.stdout);

    rl.setPrompt('Announcement> ');
    rl.prompt();

    rl.on('line', function(line) {
        redisClient.publish("announcement_channel", line);
        console.log('Sent to all users!');
        rl.prompt();
    })
};

function now() {
  return new Date().getTime() / 1000;
}