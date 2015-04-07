var f      = require('./inc/functions.js'),
    redis  = require('redis'),
    client = redis.createClient(f.getConfig().redis.port, f.getConfig().redis.host),
    app    = require('socket.io')(f.getConfig().httpPort);

//Output the console ASCII art
f.ascii(f);

//Initiate LumberJack for logging with winston
f.setupLumberJack(f);

// Authenticate with the Redis server
f.redis(f.getLumberJack().getWinston(), client, f.getConfig().redis);

//Deals with routing and general logic
f.handleWebsockets(f, app, client);

//Log the websocket server on the port specified, defaults to 1337
f.getLumberJack().info("Listening at wss://" + f.getConfig().httpHost + ":" + String(f.getConfig().httpPort).rainbow);
