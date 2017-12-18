var dgram = require('dgram');
var message = new Buffer("Some bytes");
var client = dgram.createSocket("udp4");
client.setBroadcast(true);
setInterval(function(){
client.send(message, 0, message.length, 6666, "192.168.188.255");
},1000);

// If I'm in the same machine 'localhost' works
// I need to do something 192.168.0.255 or 255.255.255
client.close();
