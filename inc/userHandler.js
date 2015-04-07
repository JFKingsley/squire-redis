var async = require('async');

function alert_knights(redis, num, clients) {
  console.log('alerting ' + num + ' knights');

    async.waterfall([
        function(callback) {
            redis.lrange('autoclickers', 0, -1, function(err, data) {
                callback(null, data);
            })
        },
        function(autoclickers, callback) {
            redis.lrange('manuals', 0, -1, function(err, data) {
                callback(null, autoclickers, data);
            })
        }
    ], function (err, autoclickers, manuals) {
        for (var i = 0; i < num; i++) {
            if (autoclickers.length > 0) {
                var j        = Math.floor(Math.random() * autoclickers.length),
                    username = autoclickers[j];

                console.log('alerting autoclicker ' + username);

                redis.hset('users:' + username, 'alerted', 'autoclick');
                redis.lrem('autoclickers', 0, username);

                if(username in clients) {
                    clients[username].emit('alert_autoclick');
                } else {
                    redisClient.publish("alert_user", JSON.stringify({
                        username: username,
                        type: 1
                    }));
                }
                autoclickers.splice(j);
            } else if (manuals.length > 0) {
                var j        = Math.floor(Math.random() * manuals.length),
                    username = manuals[j];

                console.log('alerting manual ' + username);

                redis.hset('users:' + username, 'alerted', 'manual');
                redis.lrem('manuals', 0, username);

                if(username in clients) {
                    clients[username].emit('alert_manual');
                } else {
                    redis.publish("alert_user", JSON.stringify({
                        username: username,
                        type: 2
                    }));
                }
                manuals.splice(j);
            } else {
                console.log('ISSUE! NOBODY TO ALERT!');
            }
        }
    });
}


exports.kick_idlers = function(redis, clients, cb) {
    var time = now();
    var to_kick = [];

    async.each(clients, function(client, callback) {s
        redis.hgetall('users:' + client.username, function(err, reply) {
            if (reply.online === 'true') {
                var age = time - reply.last_ping;
                if (age > 5) {
                    to_kick.push(client.username);
                    redis.hset('users:' + client.username, 'online', false);
                    callback();
                }
            }
        });
    }, function(err, data) {
        cb(to_kick);
    });
}

function clear_alerts(redis) {
    console.log('Clearing alerts...');
    redis.keys("users:*", function (err, keys) {
        keys.forEach(function (key, pos) {
            redis.hset(key, "alerted", false);
        });
    });
}

exports.manage_tiers = function(redis, clients, timer, mode, state, callback) {
    redis.lrange('autoclickers', 0, -1, function(err, autoclickers) {
        if(mode === 'testingSet') {
            if (timer >= 58 && state > 0) {
                state = 0;
                clear_alerts(redis)
            } else if (timer < 56 && state == 0) {
                state = 1;
                alert_knights(redis, 1, clients);
            } else if (timer < 54 && state == 1) {
                state = 2;
                alert_knights(redis, 3, clients);
            }
            return callback({newMode: mode, newState: state});
        }

        if(autoclickers.length <= 3 || mode === 'cautiousSet') {
            if(!(mode === 'cautiousSet')) {
                mode = 'cautious';
            }
            if (timer >= 30 && state > 0) {
                state = 0;
                clear_alerts()
            } else if (timer < 30 && state == 0) {
                state = 1;
                alert_knights(redis, 1, clients);
            } else if (timer < 20 && state == 1) {
                state = 2;
              alert_knights(redis, 2, clients);
            } else if (timer < 10 && state == 2) {
                state = 3;
                alert_knights(redis, 3, clients);
            }
        }

        if (autoclickers.length > 3 || mode === 'safeSet') {
            if(!(mode === 'safeSet')) {
                mode = 'safe';
            }
            if (timer >= 9 && state > 0) {
                state = 0;
                clear_alerts(redis)
            } else if (timer < 9 && state == 0) {
                state = 1;
                alert_knights(redis, 1, clients);
            } else if (timer < 6 && state == 1) {
                state = 2;
                alert_knights(redis, 3, clients);
            }
        }

        callback({newMode: mode, newState: state});
    });
}

function now() {
  return new Date().getTime() / 1000;
}