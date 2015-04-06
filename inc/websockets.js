var ButtonAPI = require('thebutton');
var api = new ButtonAPI();

exports.handleWebsockets = function(server, redis) {
  var knight_pool   = {},
      alerted       = {},
      sockets       = {},
      current_tier  = 0,
      lowest        = 100,
      last_period   = [],
      period_length = 60 * 1;

  function now() {
    return new Date().getTime() / 1000;
  }

  server.on('connection', function (socket) {
    socket.on('ping', function (msg) {
      if (!msg.username || !msg.valid) {
        return;
      }

      knight_pool[msg.username] = now();
      sockets[msg.username] = socket;
    });
  });

  function alert_knights(num) {
    var keys = Object.keys(knight_pool);

    num = Math.min(num, keys.length);

    for (var i = 0; i < num; i++) {
      var id = Math.floor(keys.length * Math.random());
      var key = keys[id];

      delete knight_pool[key];
      keys = Object.keys(knight_pool);

      alerted[key] = true;
      sockets[key].emit('alert');
      console.log('Sounding alarm for: ' + key);
    }
  }

  function alert_all() {
    var keys = Object.keys(knight_pool);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      alerted[key] = true;
      sockets[key].emit('alert');
    }
    knight_pool = {};
  }

  api.getNewToken(function(tokenData) {

      api.connect(tokenData.token, tokenData.epoch);

      api.on('buttonReset', function(data) {
          var time_left = data.secondsLeft;
          lowest = Math.min(lowest, time_left);

          last_period.push(time_left);
          if (last_period.length > period_length) {
            last_period.shift();
          }
          var lowest_period = 100;
          for (var i = 0; i < last_period.length; i++) {
            lowest_period = Math.min(lowest_period, last_period[i]);
          }

          console.log(last_period + ' ' + last_period.length);

          console.log('');
          console.log(time_left);

          var keys = Object.keys(knight_pool);

          var s = '' + keys.length + ': ';
          for (var i = 0; i < keys.length; i++) {
            s += keys[i] + ' ';
          }
          console.log(s);

          for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var obj = {
              pool_size: keys.length,
              time_left: time_left,
              panic: false,
              lowest_period: lowest_period,
              lowest_start: lowest
            };
            if (key in alerted) {
              obj.panic = true;
            }
            sockets[key].emit('update', obj);
          }

          // kicking idlers
          kick_idlers();

          if (Object.keys(alerted).length > 0) {
            console.log('alerted ' + Object.keys(alerted));
          }

          manage_tiers(time_left);
      });
  });

  function kick_idlers() {
    var time = now();
    var to_kick = [];
    for (var key in knight_pool) {
      var age = time - knight_pool[key];
      if (age > 10) {
        to_kick.push(key);
      }
    }
    for (var i = 0; i < to_kick.length; i++) {
      delete knight_pool[to_kick[i]];
    }
  }

  function manage_tiers(time_left) {
    if (time_left >= 10) {
      current_tier = 0;
      alerted = {};
    }
    if (time_left >= 8 && time_left < 10 && current_tier == 0) {
      alert_knights(1);
      current_tier = 1
    }
    if (time_left >= 5 && time_left < 8 && current_tier == 1) {
      alert_knights(3);
      current_tier = 2
    }
    if (time_left >= 3 && time_left < 5 && current_tier == 2) {
      alert_knights(5);
      current_tier = 3
    }
    if (time_left < 3  && current_tier == 3) {
      alert_all();
      current_tier = 4;
    }
  }
}
