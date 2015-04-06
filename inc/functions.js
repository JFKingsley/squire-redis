var fs = require('fs');

module.exports = {
  setupLumberJack: function(f) {
    var LumberJack = require('lumberjack');

    this.lumberjack = new LumberJack(false, undefined, {
      prefix: 'Squire',
      timestamp: true,
      colors: true,
      ignoreLevelSentry: ['debug']
    });
  },
  getLumberJack: function() {
    return this.lumberjack;
  },
  getConfig: function() {
    return require('../config/config.js');
  },
  getVersion: function() {
    return require('../package.json').version;
  },
  handleWebsockets: function(app, redis) {
    require('../inc/websockets.js').handleWebsockets(app, redis);
  },
  ascii: function() {
    console.log("" +
      "                   _____             _               \n" +
      "                  / ____|           (_)              \n" +
      "                 | (___   __ _ _   _ _ _ __ ___      \n" +
      "                 \\___ \\ / _` | | | | | '__/ _ \\   \n" +
      "                  ____) | (_| | |_| | | | |  __/     \n" +
      "                 |_____/ \\__, |\\__,_|_|_|  \\___|  \n" +
      "                            | |                      \n" +
      "                            |_|                      \n" +
      "\n" +
      "                 Squire v" + require('../package.json').version + " is launching...\n");
  },
  redis: function (winston, client, config) {
    client.auth(config.password);
    winston.info("[Redis Notification]".yellow + " Connecting to Redis server at " + config.host.bold + " on port " + String(config.port).bold);
  }
};
