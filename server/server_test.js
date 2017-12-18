var host = process.argv[2] || (console.log("missing host") || process.exit());
var port = process.argv[3] || 6666;
var csvdata = process.argv[4] || null;

console.log("arguments - host:", host,", port:" port,", csvfile:",csvfile);
console.log("csvfile is from osc_player. if null or blank then just send some example")
console.log("listening on host/port", host, port);

var osc = require('node-osc');

var client = new osc.Client(host, port);


setInterval(send, 1000);

function send() {
    client.send('/201/hr', 200);
}
