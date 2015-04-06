/*
* =========================
* Main Squire Config
* =========================
*/

//The host to bind the HTTP server to
exports.httpHost = "localhost";

//The port to bind the HTTP server to (Optional)
exports.httpPort = 8080;

//The settings for our redis instance
exports.redis = {
    host: "localhost",
    port: 6379,
    password: "password"
};