// var dgram = require('dgram');

var osc = require('node-osc');

DEBUG = process.env.hasOwnProperty('DEBUG')

var debug = require('debug')('osc')

function Server(port, on_message_cb) {
    this.port = port;
    this.on_message_cb = on_message_cb;
    // this.server = dgram.createSocket('udp4');
    this.server = null;
    this.serverip = "0.0.0.0";
}

Server.prototype = {
    stop: function() {
        this.server.close();
    },

    start: function () {
        console.log("OSCListener started on port", this.port);
        var _this = this;

        // this.server.on('listening', function () {
        //     // this.addMembership(s.serverip);
        //     var address = _this.server.address();
        //     console.log("listening", address);
        //     //server.setBroadcast(true);
        // });
        // this.server.on('message', function (message, rinfo) {
        //     _this.on_message_cb(message);
        // });
        // this.server.bind(this.port, this.serverip, function() {
        //     // this.addMembership(host)
        //     // this.setBroadcast(true);
        // });


        this.server = new osc.Server(this.port, this.serverip);
        this.server.on("message", function (message, rinfo) {
            debug('message', message)
            _this.on_message_cb(message);
            // console.log("Message:");
            // console.log(message);

        });

    }

}

exports.Server = Server;
