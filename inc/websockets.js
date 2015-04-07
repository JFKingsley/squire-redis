var ButtonAPI      = require('thebutton'),
    api            = new ButtonAPI(),
    clients        = {},
    instance_token = require('node-uuid').v4();

//TODO sort this shit out
var timer = 100;
var state = 0;
var mode = 'setup';

exports.init = function(f, server, redis) {
    f.getLumberJack().info('[Socket.IO Notification]'.blue + ' Current instance token is ' + instance_token);
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
                  valid: (msg.valid === 'true'),
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
                  valid: (msg.valid === 'true'),
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
            updatedClient.autoclick = ('autoclick' in msg ? msg.autoclick : false);
            updatedClient.instance_token = msg.instance_token;
            redis.hmset('users:' + socket.username, updatedClient);
        });
    });

    socket.on('disconnect', function (msg) {
        if (socket.username) {
            console.log(socket.username + ' just disconnected.');
            redis.hset('users:' + socket.username, 'online', false);
            delete clients[socket.username];
        }
    });
};

exports.handleAnnouncements = function(f, server, redisClient) {
    var redis  = require('redis'),
        subClient = redis.createClient(f.getConfig().redis.port, f.getConfig().redis.host);
    subClient.auth(f.getConfig().redis.password);

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

exports.handleWebsockets = function(server, redis) {

    var button_broadcast = 'wss://wss.redditmedia.com/thebutton?h=19ad9a33871d49f318ab8d882b63c101924638d1&e=1428351836'
    var button_client = new ws(button_broadcast);

    function alert_knights(num, autoclickers, manuals) {
      console.log('alerting ' + num + ' knights');

      for (var i = 0; i < num; i++) {
        if (autoclickers.length > 0) {
          var j = Math.floor(Math.random() * autoclickers.length);
          var username = autoclickers[j];
          console.log('alerting autoclicker ' + username);
          clients[username].alerted = 'autoclick';
          clients[username].socket.emit('click');
          autoclickers.splice(j);
        } else if (manuals.length > 0) {
          var j = Math.floor(Math.random() * manuals.length);
          var username = manuals[j];
          console.log('alerting manual ' + username);
          clients[username].alerted = 'manual';
          clients[username].socket.emit('alert');
          manuals.splice(j);
        } else {
          console.log('NOONE TO ALERT');
        }
      }
    }

    button_client.on('message', function (msg) {
      msg = JSON.parse(msg);
      timer = msg.payload.seconds_left;
    });

    setInterval(function () {
      kick_idlers();

      var autoclickers = [];
      var manuals = [];

      for (var i in clients) {
        if (clients[i].valid && !clients[i].alerted && clients[i].online) {
          if (clients[i].autoclick) {
            autoclickers.push(i);
          } else {
            manuals.push(i);
          }
        }
      }

      console.log('Timer: ' + timer);
      console.log('Autoclickers: ' + autoclickers.length + ' ' + autoclickers);
      console.log('Manuals: ' + manuals.length + ' ' + manuals);

      for (var i in clients) {
        var client_msg = {
          server_timer: timer,
          autoclickers: autoclickers.length,
          manuals: manuals.length,
          alerted: clients[i].alerted,
          instance_token: instance_token,
          autoclick: clients[i].autoclick,
          mode: mode
        };
        clients[i].socket.emit('update', client_msg);
      }

      manage_tiers(autoclickers, manuals);

      console.log();
    }, 100);

    function kick_idlers() {
      var time = now();
      var to_kick = [];
      for (var i in clients) {
        if (clients[i].online) {
          var age = time - clients[i].last_ping;
          if (age > 5) {
            to_kick.push(i);
          }
        }
      }
      for (var i = 0; i < to_kick.length; i++) {
        console.log('kicking ' + to_kick[i] + ' for idling');
        clients[to_kick[i]].socket.disconnect();
        clients[to_kick[i]].online = false;
      }
    }

    function clear_alerts() {
      console.log('clearing alerts');
      for (var i in clients) {
        clients[i].alerted = false;
      }
    }

    function manage_tiers(autoclickers, manuals) {
      if (autoclickers.length > 3) {
        mode = 'safe';
        console.log('safe mode');
        if (timer >= 9 && state > 0) {
          state = 0;
          clear_alerts()
        } else if (timer < 9 && state == 0) {
          state = 1;
          alert_knights(1, autoclickers, manuals);
        } else if (timer < 6 && state == 1) {
          state = 2;
          alert_knights(3, autoclickers, manuals);
        }
      } else {
        mode = 'cautious';
        console.log('cautious mode');
        if (timer >= 30 && state > 0) {
          state = 0;
          clear_alerts()
        } else if (timer < 30 && state == 0) {
          state = 1;
          alert_knights(1, autoclickers, manuals);
        } else if (timer < 20 && state == 1) {
          state = 2;
          alert_knights(2, autoclickers, manuals);
        } else if (timer < 10 && state == 2) {
          state = 3;
          alert_knights(3, autoclickers, manuals);
        }
      }
    }
}


function now() {
  return new Date().getTime() / 1000;
}
