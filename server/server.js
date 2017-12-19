// Socket.IO I Hate you so much. I walk away from you for 6 months and
// every time I return you break so many things through pretty drastic
// object structure changes. this time it's where the socket.rooms and
// io.to() elements have been moded. Joy


/* TODO:
   How this should work.

   Incoming OSC data turned into BPM per device
   Incoming OSC data pruned into 10 point HR graph per device
   Incoming OSC data passed socket.io client if client subscribed to specific device

   Client socket.io can:
    - Get overview data (client requests once a sec)
    - Subscribe to global 10 point graph data
    - Get device ID overview
    - Subscribe to specific device ID HR live data

    QQQ: Does client request general data / global data, once a second, or ?

    test:

    python3 osc_record_replay.py ./nathan.csv 9999 replay localhost

 */
var os         = require('os');
var program    = require('commander');
const { exec } = require('child_process');

program
  .option('-n, --showname <value>', '', 'test_'+(new Date().toISOString()) )
  .option('-o, --oscport <n>', '', 9999)
  .option('-w, --wwwport <n>', '', 8081)
  .option('-i, --interface <n>', 'select interface (so we know what the network IP looks like) interfaces: '+Object.keys(os.networkInterfaces()).join(), 'wlp3s0')
  .option('-t, --runtestserver', 'default: false', false)
  .option('-w, --debug', 'default: false', false)
 .parse(process.argv);

var showname      = program.showname;
var oscport       = program.oscport;
var wwwport       = program.wwwport;
var host          = program.host;
var ip_dev        = program.interface;
var runtestserver = program.runtestserver;


// ip_dev    = "lo"; // network interface to get IP address from

var info_update_rate_ms = 2000;

var ip_prefix = os.networkInterfaces()[ip_dev]
                  .filter(t => t['family'] === 'IPv4')
                  .pop()['address']
                  .split('.').splice(0,3).join('.')+'.'; // "192.168.1.""
// if just taking last doesnt work, this filter returns all ipv4 addresses to choose
// .filter(function(t,i,a){return t['family']==='IPv4' && t.hasOwnProperty('address');})

console.log("starting on network interface '"+ip_dev+"' with network ip '"+ip_prefix+"'")
console.log("http listening on host/port", host, wwwport);
console.log("osc listening on host/port", host, oscport);



var util = require('util')
var fs   = require('fs');

if (process.stdin.isTTY) {
    var stdin = process.openStdin();
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    stdin.on( 'data', function( key ){
      if ( key === '\u0003' ) { // ctrl+c aka quit
        setTimeout(function(){process.exit()}, PROCESS_EXIT_WAIT);
      }
      else if ( key === '\u0013') { // ctrl+s aka save
          var json = JSON.stringify(show,null,4);
            fs.writeFile(show.name+'.json', json, 'utf8',
                function(){console.log('saved',show.name+'.json')});
      }
      else if ( key === '\u0014' || key === '\u001bt' ) { // ctrl+t or alt+t aka test
        console.log(util.inspect(show, {depth:null}))
      }
      else {
        console.log("unknown key: ");
      }
      // write the key to stdout all normal like
      //process.stdout.write( key );
    });
}

var Group = require('./Group.js')
var show = new Group(showname)


var express  = require('express')
var app      = express();
var www      = require('http').createServer(app);
www.listen(wwwport);
var io       = require('socket.io').listen(www);
io.set('log level',0);

var osc      = require('node-osc');

// Apprently socket.io can't check if anyone is subscribed first, because it
// is that stupid, and just tries to send anyway? Jesus, really I could
// just manage a seperate room structure in that case.
var inroom   = false;
var info_handler = null;

io.sockets.on('connection', function(socket) {
    console.log('socket.io<connection', socket.id);
    inroom = false; // on new connect assume there are no rooms

    // used to leave all rooms of socket accept self room
    socket.leave_all = function() {
        for (var room in this.manager.roomClients[this.id]) {
            if (room == '') continue;  // default room required for socket.emit(...
            this.leave(room.slice(1)); // remove '/' char
        }
        inroom = false;
    };
    socket.join_exclusive = function(newroom) {
        this.leave_all();
        this.join(newroom);
        inroom = true;
    };


    if (info_handler)
        clearInterval(info_handler)
    setInterval(function(){
        socket.emit('update_info', { show: {
                    beats_total: show_beats_total,
                    beats_valid: show_beats_valid,
                    beats_valid_sum: show_beats_valid_sum,
                    bpm_avg: show_beats_valid_sum/show_beats_valid
                }
        })
    },info_update_rate_ms)
    socket.on('disconnect', function() {
        console.log('socket.io disconnected');

    });



    socket.on('get_show_info', function() {
        console.log('socket.io<get_show_info');
        var info = {
            name: show.name,
            timebegin: show.timebegin,
            device_ids: Object.keys(show.devices),
            beats_total: show_beats_total,
            beats_valid: show_beats_valid,
            beats_valid_sum: show_beats_valid_sum,
            bpm_avg: show_beats_valid_sum/show_beats_valid,
            options: show.options
        }
        socket.emit('show_info', info);
    });
    socket.on('get_samples', function(device_id,start_time,end_time) {
        console.log('socket.io<get_samples',device_id,start_time,end_time);

        var ret =  {};

        // var device_id  = data.hasOwnProperty('device_id') ? data.device_id : null
        // var start_time = data.hasOwnProperty('start_time') ? data.start_time : null
        // var end_time   = data.hasOwnProperty('end_time') ? data.end_time : null
        // var start_time = start_time ? start_time : show.timebegin
        // var end_time   = end_time   ? end_time   : new Date().getTime()+1000;

        // assume all devices if no device id passed
        if (!device_id)
            var device_ids = Object.keys(show.devices)
        else
            var device_ids = [device_id]

        // assume we want all samples:
        device_ids.forEach(function(id) {
            if (!show.devices.hasOwnProperty(id))
                return
            // ALL SAMPLES
            if (!start_time && !end_time) {
                // omg socket.io can't handle passing back assoc array with keys
                // that are strNum
                ret['dev_'+id] = { id: ''+id,
                                   bpm: { samples: show.devices[id].bpm.samples },
                                   // gsr: { samples: show.devices[id].gsr.samples } }
                                 }
            }
            // ONLY LAST SAMPLE for each
            else if (start_time = 'latest') {
                ret['dev_'+id] = { id: ''+id,
                                   bpm: { samples: [show.devices[id].bpm.samples[show.devices[id].bpm.samples.length-1]] },
                                  // gsr: { samples: show.devices[id].gsr.samples.filter(filter) } }
                          }
            }
            // SAMPLES BETWEEN RANGE
            else {
                var filter = function(entry) {
                    if (start_time && entry[0] < start_time) return false;
                    if (end_time && entry[0] > end_time) return false;
                    return true;
                }
                // omg socket.io can't handle passing back assoc array with keys
                // that are strNum
                ret['dev_'+id] = { id: ''+id,
                                   bpm: { samples: show.devices[id].bpm.samples.filter(filter) },
                                   // gsr: { samples: show.devices[id].gsr.samples.filter(filter) } }
                                 }
            }
        });

        console.log('ret', ret)
        socket.emit('samples',  ret);
    });


    socket.on('subscribe_to_device_graph', function(device_id) {
        console.log('socket.io<subscribe_to_device_graph', device_id);
        // processOsc >> emit('')
        socket.join_exclusive('device_graph:'+device_id);
        console.log('socket.rooms', socket.manager.roomClients);
    });
    socket.on('get_overview', function(data) {
        console.log('socket.io<get_overview', data);
        // send device_overview on this socket
    });
    socket.on('subscribe_to_global_graphs', function(poll_timeout) {
        console.log('socket.io<subscribe_to_global_graphs, poll_timeout:', poll_timeout);
        // processOsc >> emit('') after pruned graph created
        socket.join_exclusive('global_graphs');
        console.log('socket.rooms', socket.manager.roomClients);
    });
    socket.on('unsubscribe', function(data) {
        console.log('socket.io<unsubscribe');
        socket.leave_all();
    });
    socket.on('osc_send', function(data) {
        console.log('socket.io<osc_send', data);
        var client = new osc.Client( ip_prefix+data.device_id, 8888);
        client.send(data.path, data.value);
    });
});


app.get('/', function (req, res) {
    res.sendFile(__dirname + '/client/index.html');
});
app.use('/', express.static(__dirname + '/client'));
// app.get('/device/list', function (req, res) {
//     res.setHeader('Content-Type', 'application/json');
//     res.send(JSON.stringify(Object.keys(show.devices)));
// });
// app.get('/device/all', function (req, res) {
//     res.setHeader('Content-Type', 'application/json');
//     res.send(JSON.stringify(show.devices));
// });
// app.get('/device/:device_id', function (req, res) {
//     res.setHeader('Content-Type', 'application/json');
//     res.send(JSON.stringify(show.devices[req.params.device_id]));
// });
if (runtestserver) {
    app.use('/runtest', (req, res) => {
        exec('/bin/ps aux | grep osc_record_replay.py | grep timeout | grep -v grep | wc -l', (err, stdout, stderr) => {
          console.log(`stdou: ${stdout}`);
          console.log(`stderr: ${stderr}`);
          if (stdout && parseInt(stdout) > 0) {
              res.send(`Test streams already running: ${stdout}<br><br><a href="/runtestend">stop streams</a><br><br><a href="/runtestcleardata">reset show data</a>`);
          }
          else {
              res.send(`Test streams already running: 0<br><br><a href="/runtestbegin">start streams</a> for 20 minutes<br><br><a href="/runtestcleardata">reset show data</a>`);
          }
        });

    });
    app.use('/runtestbegin', (req, res) => {
        exec('cd ./test/osc_player/ && timeout 20m ./run4.sh >/dev/null &', (err, stdout, stderr) => {});
        res.redirect('back');
    });
    app.use('/runtestend', (req, res) => {
        exec("/bin/ps aux | grep osc_record_replay.py | grep -v grep | awk '{print $2}' | xargs kill", (err, stdout, stderr) => {});
        res.redirect('back');
    });
    app.use('/runtestcleardata', (req, res) => {
        show.reset();
        res.redirect('back');
    });
}


var OSCListener = require('./OSCListener.js');
var oscserver = new OSCListener.Server(oscport);

oscserver.on_message_cb = processOsc;
oscserver.start();

// call back on beat detection
show.on_beat_cb = function (data) {
    show_beats_total ++
    if (io.sockets.manager.rooms.hasOwnProperty('/global_graphs')) {
        console.log('send graph data')
        // append global info to data
        data.show = {
            beats_total: show_beats_total,
            beats_valid: show_beats_valid,
            beats_valid_sum: show_beats_valid_sum,
            bpm_avg: show_beats_valid_sum/show_beats_valid_sum
        }
        io.sockets.to('global_graphs').emit('update_global_graphs', data)
    }
}

var prevtimestamp = 0;
var graph_pkts = 0;
var osc_pkts = 0;
var show_beats_valid=0, show_beats_total=0, show_beats_valid_sum=0;
function processOsc(message) {
    // console.log("osc", message);

    // debug
    osc_pkts+=1;
    print_every_ms(function(){
        console.log('pps osc:', packets_per_second(osc_pkts))
        console.log("show.devices");
        Object.keys(show.devices).forEach(function(v){
            var device=show.devices[v]
            console.log(device.id,device.bpm.bpm_avg, device.bpm.samples.slice(device.bpm.samples.length-15), "\n",device.bpm.bpm_window.join(),"hmm")

            device.bpm.samples.filter(function(item){
                show_beats_valid_sum+=item[1];
                if(item[1]<=0) return;
                show_beats_valid++
            })

        });
        // total beats:
        console.log("show total beats:",show_beats_total);
        console.log("show average bpm:", show_beats_valid_sum/show_beats_valid);
        // console.log("show total beats",show.devices.)
    },10000);


    // parse message
    var path = message[0].split('/');
    var device_id = path[1];
    var type = path[2];
    var pulse_value = message[1];


    if (!show.devices.hasOwnProperty(device_id)) {
        console.log('add_device', device_id)
        show.add_device(device_id)
    }
    show.devices[device_id].bpm.detect(pulse_value)

    // if socket is subscribed

    // Apprently socket.io can't check if anyone is subscribed first, because it
    // is that stupid, and just tries to send anyway? Jesus, really I could
    // just manage a seperate room structure in that case.
    if (io.sockets.manager.rooms.hasOwnProperty('/device_graph:'+device_id) &&
        type === 'hr') {
        // ONLY HR HERE
        graph_pkts+=1;
        // print_every_ms(function(){
        //     console.log('pps graph:', packets_per_second(graph_pkts)) },4000);

        // print_every_ms(function(){
        //     console.log('pps device:', packets_per_second(graph_pkts)) },4000);

        // console.log('device_id', device_id);
        io.sockets.to('device_graph:'+device_id).emit('update_device_graph', message);
        // // in the future change this to once a second?
        // io.sockets.to('global_graphs').emit('update_global_graphs', message);
    }

};









var print_every_ms_t = null;
function print_every_ms(/*args, ..., milliseconds */) {
    // first (causes this to also run first call)
    var args=Object.values(arguments);
    var ms = args.pop();
    var now = new Date().getTime();
    if (!print_every_ms_t) print_every_ms_t = now-ms-1;

    var callback = null;
    if (typeof args[0] == 'function')
        callback = args[0];
    if (now > print_every_ms_t+ms) {
        if (callback)
            callback();
        else
            console.log(args.join(' '));
        print_every_ms_t = now;
    }
}
var pps_prev_time = new Date().getTime();
var pps_prev_packet_total = 0;
function packets_per_second(packets_total) {
    var now = new Date().getTime();
    var elapsed_ms = now - pps_prev_time;
    var elapsed_packets = packets_total - pps_prev_packet_total;
    var packets_per_ms = elapsed_packets / elapsed_ms;
    pps_prev_time = now;
    pps_prev_packet_total = packets_total;
    return packets_per_ms *1000;
}






var flattenObject = function(obj) {
    if (obj === null) {
        return null;
    }

    if (Array.isArray(obj)) {
        var newObj = [];
        for (var i = 0; i < obj.length; i++) {
            if (typeof obj[i] === 'object') {
                newObj.push(flatten(obj[i]));
            }
            else {
                newObj.push(obj[i]);
            }
        }
        return newObj;
    }

    var result = Object.create(obj);
    for(var key in result) {
        if (typeof result[key] === 'object') {
            result[key] = flatten(result[key]);
        }
        else {
            result[key] = result[key];
        }
    }
    return result;
}
