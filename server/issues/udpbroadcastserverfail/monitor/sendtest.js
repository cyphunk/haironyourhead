var host = process.argv[2] || (console.log("missing host") || process.exit());
var port = process.argv[3] || 6666;
console.log("listening on host/port", host, port);


var SRC_PORT = 6025;
var dgram = require('dgram');
var server = dgram.createSocket("udp4");

server.bind(SRC_PORT, function () {
    server.setBroadcast(true);
    setInterval(multicastNew, 1000);
});

function multicastNew() {
    var message = new Buffer("Multicast message!");
    server.send(message, 0, message.length, port, host, function () {
        console.log("Sent '" + message + "'");
    });
}
