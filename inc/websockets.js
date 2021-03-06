var ButtonAPI      = require('thebutton'),
    async          = require('async'),
    userHandler    = require('./userHandler.js'),
    instance_token = require('node-uuid').v4(),
    api            = new ButtonAPI(),
    clients        = {},
    subClient      = null;

var timer = 100,
    state = 0,
    mode = 'setup',
    last_ticker = 0,
    shuttingDown = false;

exports.init = function(f, server, redis) {
    f.getLumberJack().info('[Socket.IO Notification]'.blue + ' Current instance token is ' + instance_token);

    var redisLib  = require('redis');
    subClient  = redisLib.createClient(f.getConfig().redis.port, f.getConfig().redis.host);
    subClient.auth(f.getConfig().redis.password);

    api.getNewToken(function(tokenData) {
        api.connect(tokenData.token, tokenData.epoch);
        api.on('tick', function(data) {
            last_ticker = now();
            //Unknown why, but the seconds are always one off, not a timing issue
            timer = data.time_left - 1;
        });
    });

    process.on('SIGTERM', function () {
        shuttingDown = true;
        async.waterfall([
            function(callback) {
                redisClient.get('isDesignatedMaster', function(err, reply) {
                    if(reply !== null && reply == instance_token) {
                        redisClient.del('isDesignatedMaster', function(err) {
                            callback();
                        });
                    } else {
                        callback();
                    }
                });
            },
            function(callback) {
                for (var i = Object.keys(clients).length - 1; i >= 0; i--) {
                    clients[Object.keys(clients)[i]].emit('reload');
                };

                server.close();

                callback();
            }
        ], function (err) {
            setTimeout(function() {
                if(err) {
                    console.log("Error! " + err);
                    process.exit(1);
                } else {
                    process.exit(0);
                }
            }, 5000);
        });
    });

    setInterval(function () {
        var autoclickers = [];
        var manuals = [];

        //Kick all idle users
        userHandler.kick_idlers(redis, clients, function(to_kick) {
            for (var i = 0; i < to_kick.length; i++) {
              console.log('kicking ' + to_kick[i] + ' for idling');
              clients[to_kick[i]].disconnect();
              delete clients[to_kick[i]];
            }
        });

        //Check if this server had the mutex lock. If so, set it for 5 mins
        redis.get('isDesignatedMaster', function(err, reply) {
            if(reply !== null && reply !== instance_token) {
                return;
            }
            redis.setex('isDesignatedMaster', 300, instance_token);
            if (now() - last_ticker > 5) {
                mode = 'inconsistent';
            } else {
                userHandler.manage_tiers(redis, clients, timer, mode, state, function(msg) {
                    mode = msg.newMode;
                    state = msg.newState;
                });
            }
        });

        //Notify the clients of any detail changes
        redis.lrange('autoclickers', 0, -1, function(err, autoclickers) {
            redis.lrange('manuals', 0, -1, function(err, manuals) {
                for (var username in clients) {
                    redis.hgetall('users:' + username, function(err, client) {
                        if (!client || !(client.online === 'true')) {
                            return;
                        }

                        var client_msg = {
                          server_timer: timer,
                          autoclickers: autoclickers.length,
                          manuals: manuals.length,
                          alerted: (client.alerted === 'true'),
                          instance_token: instance_token,
                          autoclick: (client.autoclick === 'true'),
                          mode: mode,
                          armed: mode != 'inconsistent'
                        };
                        if(clients[username]) {
                            clients[username].emit('update', client_msg);
                        }
                    });
                };
            });
        });
    }, 333);

    subClient.subscribe('alert_user');
    subClient.subscribe('command_channel');

    subClient.on('message', function (channel, message) {
        //Handle alerting a user on this server from a global pub/sub
        if(channel === 'alert_user') {
            message = JSON.parse(message);
            if(message.username in clients) {
                if (message.type === 1) {
                  clients[message.username].emit('alert_autoclick');
                } else if (message.type === 2) {
                  clients[message.username].emit('alert_manual');

                }
            }
        }
        //Handle global command rollout
        if(channel === 'command_channel') {
            var command = message.split(' ')[0];
                message = message.substr(message.indexOf(' ') + 1);
            if(command === 'announce') {
                for (var i = Object.keys(clients).length - 1; i >= 0; i--) {
                    clients[Object.keys(clients)[i]].emit('announcement', {body: message});
                };
            }
            if(command === 'setMode' && message === 'reset') {
                mode = 'setup';
            }
            if(command === 'setMode' && (message === 'safe' || message === 'cautious' || message === 'testing')) {
                mode = message + 'Set';
            }
        }
    });
};

exports.handleConnection = function(f, socket, redis) {
    socket.on('initData', function (msg) {
        //If the user doesn't provide a username, quit
        if (!msg.username || shuttingDown) {
            return;
        }

        redis.hgetall('users:' + msg.username, function(err, reply) {
            //Since Redis stores boolean as strings we need to explicitly check/set each bool since 'false' is truthy
            //
            if(reply && (reply.online === 'true')) {
                socket.emit('multipleClients');
                socket.disconnect();
                return;
            }

            var client = reply;

            if(reply) {
                client = {
                  username: msg.username,
                  last_ping: now(),
                  valid: msg.valid,
                  client_time: msg.client_time,
                  client_timer: msg.client_timer,
                  instance_token: msg.instance_token,
                  online: true,
                  address: socket.handshake.address,
                  autoclick: ('autoclick' in msg ? msg.autoclick : (reply.autoclick === 'true'))
                };
            } else {
                client = {
                  alerted: false,
                  username: msg.username,
                  last_ping: now(),
                  valid: msg.valid,
                  client_time: msg.client_time,
                  client_timer: msg.client_timer,
                  instance_token: msg.instance_token,
                  online: true,
                  address: socket.handshake.address,
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
                socket.disconnect();
                return;
            }

            //Update last_ping, client_time and autoClick if set
            var updatedClient = {};

            updatedClient.last_ping = now();
            updatedClient.client_time = msg.client_time;
            updatedClient.client_timer = msg.client_timer;
            updatedClient.autoclick = msg.autoclick;
            updatedClient.instance_token = msg.instance_token;

            if('autoclick' in msg) {
                if(updatedClient.autoclick === true) {
                    redis.lrange('autoclickers', 0, -1, function(err, data) {
                        if(data.indexOf(socket.username) === -1) {
                            redis.lpush('autoclickers', socket.username);
                            redis.lrem('manuals', 0, socket.username);
                        }
                    });
                } else {
                    redis.lrange('manuals', 0, -1, function(err, data) {
                        if(data.indexOf(socket.username) === -1) {
                            redis.lpush('manuals', socket.username);
                            redis.lrem('autoclickers', 0, socket.username);
                        }
                    })
                }
            }

            redis.hmset('users:' + socket.username, updatedClient);
        });
    });

    socket.on('disconnect', function (msg) {
        if (socket.username) {
            console.log(socket.username + ' just disconnected.');
            delete clients[socket.username];
            redis.hset('users:' + socket.username, 'online', false);
            redis.lrem('autoclickers', 0, socket.username);
            redis.lrem('manuals', 0, socket.username);
        }
    });
};

exports.handleAnnouncements = function(f, server, redisClient) {
    var readline = require('readline'),
        rl = readline.createInterface(process.stdin, process.stdout);

    rl.setPrompt('Command> ');
    rl.prompt();

    rl.on('line', function(line) {
        if(line === 'exit') {
            shuttingDown = true;
            async.waterfall([
                function(callback) {
                    redisClient.get('isDesignatedMaster', function(err, reply) {
                        if(reply !== null && reply == instance_token) {
                            redisClient.del('isDesignatedMaster', function(err) {
                                callback();
                            });
                        } else {
                            callback();
                        }
                    });
                },
                function(callback) {
                    for (var i = Object.keys(clients).length - 1; i >= 0; i--) {
                        clients[Object.keys(clients)[i]].emit('reload');
                    };

                    server.close();

                    callback();
                }
            ], function (err) {
                setTimeout(function() {
                    if(err) {
                        console.log("Error! " + err);
                        process.exit(1);
                    } else {
                        process.exit(0);
                    }
                }, 5000);
            });
        } else {
            if(line === 'mode') {
                console.log('Current mode is ' + mode);
                return rl.prompt();
            }
            if(line === 'state') {
                console.log('Current state is ' + state);
                return rl.prompt();
            }
            redisClient.publish('command_channel', line);
            console.log('Sent to all servers!');
            rl.prompt();
        }
    })
};

function now() {
  return new Date().getTime() / 1000;
}