var dgram = require('dgram');
var util = require('util');

var host = process.argv[2] || (console.log("missing host") || process.exit());
var port = process.argv[3] || 6666;
console.log("listening on host/port", host, port);

server = dgram.createSocket('udp4');

server.on('listening', function () {
    this.addMembership(host);
    var address = server.address();
    console.log("listening", address);
    //server.setBroadcast(true);
});

server.on('message', function (msg, rinfo) {
    console.log("message",msg);
    // try {
    //     var decoded = decode(msg);
    //     // [<address>, <typetags>, <values>*]
    //     if (decoded) {
    //         server.emit('message', decoded, rinfo);
    //         server.emit(decoded[0], decoded, rinfo);
    //     }
    // }
    // catch (e) {
    //     console.log("can't decode incoming message: " + e.message);
    // }
});


server.bind(port, "192.168.188.30", function() {
    // this.addMembership(host)
    // this.setBroadcast(true);
});
