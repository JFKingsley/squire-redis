var async = require('async');

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

exports.clear_alerts = function(redis) {
    console.log('Clearing alerts...');
    redis.keys("users:*", function (err, keys) {
        keys.forEach(function (key, pos) {
            redis.hset(key, "alerted", false);
        });
    });
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

function now() {
  return new Date().getTime() / 1000;
}