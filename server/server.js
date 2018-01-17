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
var Timer       = require('./Timer.js') // simple timer to do something when N time has passed
var Group       = require('./Group.js') // BPM, Device information storage a BPM detection
var osc         = require('node-osc'); // used to send OSC messages from web admin to devices
var OSCListener = require('./OSCListener.js'); // creates our OSC server to listen for pulses
var serveIndex  = require('serve-index')

var os          = require('os');
var program     = require('commander');

// require('./processor-usage.js').startWatching()
// updates global processCpuUsage by checking proc

program
  .option('-n, --showname <value>', '', 'test_'+(new Date().toISOString()) )
  .option('-o, --oscport <n>', '', 9999)
  .option('-w, --wwwport <n>', '', 8081)
  .option('-i, --interface <n>', 'select interface (so we know what the network IP looks like) interfaces: '+Object.keys(os.networkInterfaces()).join(), 'wlp3s0')
  .option('-t, --runtestserver', 'default: false', false)
  .option('-d, --debug <value>', 'default: false', false)
 .parse(process.argv);

var showname           = program.showname;
var oscport            = program.oscport;
var wwwport            = program.wwwport;
var host               = program.host;
var ip_dev             = program.interface;
var runtestserver      = program.runtestserver;
var DEBUG              = process.debug || process.env.hasOwnProperty('DEBUG');
var fs                 = require('fs')
var send_info_every_ms = 2000;

var ip_prefix = os.networkInterfaces()[ip_dev]
                  .filter(t => t['family'] === 'IPv4')
                  .pop()['address']
                  .split('.').splice(0,3).join('.')+'.';
/*
  if just taking last doesnt work, this filter returns all ipv4 addresses to choose
 .filter(function(t,i,a){return t['family']==='IPv4' && t.hasOwnProperty('address');})
*/


console.log("starting on network interface '"+ip_dev+"' with network ip '"+ip_prefix+"'")
console.log("http listening on host/port", host, wwwport);
console.log("osc listening on host/port", host, oscport);
console.log("CHECK FIREWALL");

var debug  = require('debug')
var debuga = require('debug')('samples')
var debugb = require('debug')('averages')

var show = new Group(showname)
show.on_beat_cb = on_beat_cb
setInterval(function(){
  /*       data = JSON.stringify(ev);
    RangeError: Maximum call stack size exceeded
    at JSON.stringify (<anonymous>)
  */
  process.nextTick(function() {
    //var json = JSON.stringify(show,null,4);
    var json = JSON.stringify(show,null,4);
      fs.writeFile(show.name+'_autosave.json', json, 'utf8',
          function(){console.log('saved',show.name+'.json')});
  })
},60000)

var express  = require('express')
var app      = express();
var www      = require('http').createServer(app);
www.listen(wwwport);
var io       = require('socket.io').listen(www);

io.set('log level',0);


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
    info_handler = setInterval(function(){
        socket.emit('update_info', { show: show.get_info() })
    }, send_info_every_ms)

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

    function slice_samples(array_name='samples',
                           device_id, start_time, end_time) {
        var ret =  {};
        // assume all devices if no device id passed
        var device_ids = device_id ? [device_id]
                                   : Object.keys(show.devices)

        // assume we want all samples:
        device_ids.forEach(function(id) {
            debuga('slice_samples id',id)

            if (!show.devices.hasOwnProperty(id) || !show.devices[id].hasOwnProperty('bpm') ||  !show.devices[id].bpm.hasOwnProperty(array_name) )
                return

            // ALL SAMPLES
            ret[id] = { id: id, bpm: { } }
            if (!start_time && !end_time) {
                // omg socket.io can't handle passing back assoc array with keys
                // that are strNum
                ret[id].bpm[array_name] = show.devices[id].bpm[array_name]
            }
            // ONLY LAST SAMPLE for each
            else if (start_time == 'latest') {
                if (!show.devices[id].bpm[array_name].length) {
                    ret[id].bpm[array_name] = []
                }
                else {
                    var last = show.devices[id].bpm[array_name].length-1
                    ret[id].bpm[array_name] = [show.devices[id].bpm[array_name][last]]
                }
                // gsr: { samples: show.devices[id].gsr.samples.filter(filter) } }
            }
            // SAMPLES BETWEEN RANGE
            else {
                var filter = function(entry) {
                    console.log('filter',entry[0],start_time)
                    console.log('filter',entry[0],end_time)
                    if (start_time && entry[0] < start_time) return false;
                    if (end_time && entry[0] > end_time) return false;
                    return true;
                }
                // omg socket.io can't handle passing back assoc array with keys
                // that are strNum
                ret[id].bpm[array_name] = show.devices[id].bpm[array_name].filter(filter)
                // gsr: { samples: show.devices[id].gsr.samples.filter(filter) } }
            }
        });
        return ret;

    }
    socket.on('get_samples', function(device_id,start_time,end_time) {
        debuga('socket.io<get_samples',device_id,start_time,end_time);

        var ret =  slice_samples('samples', device_id,start_time,end_time);
        socket.emit('samples',  ret);
    });


    socket.on('get_averages', function(device_id,start_time,end_time) {
        debuga('socket.io<get_averages',device_id,start_time,end_time);
        var ret =  slice_samples('averages', device_id,start_time,end_time);
        socket.emit('averages',  ret);
    });

    socket.on('osc_send', function(data) {
        console.log('socket.io<osc_send', data);
        try {
        var client = new osc.Client( ip_prefix+data.device_id.replace('device_',''), 8888);
        client.send(data.path, data.value);
        } catch(e){console.log(e)}

    });


    socket.on('subscribe_to_device_graph', function(device_id) {
        console.log('socket.io<subscribe_to_device_graph', device_id);
        socket.join_exclusive('device_graph:'+device_id);
        console.log('socket.rooms', socket.manager.roomClients);
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
app.use('/vis', express.static('client/vis'), serveIndex('client/vis', {'icons': true}))

var oscserver = new OSCListener.Server(oscport);

oscserver.on_message_cb = processOsc;
oscserver.start();

// call back on beat detection
function on_beat_cb (data) {
    // only add valid beats to our count
    show.update_total_bpm_info(data.bpm[1])
    show.update_aggregate_device(data.bpm[0]) //provide time so function doesnt need to
    show.devices[data.id].bpm.generate_average_spread()
    if (io.sockets.manager.rooms.hasOwnProperty('/global_graphs')) {
        console.log('send graph data')
        // append global info to data
        data.show = show.get_info()
        io.sockets.to('global_graphs').emit('update_global_graphs', data)
    }
    // less than optimal... update device 0 for audiance
}

var graph_pkts = 0;
var osc_pkts = 0;
var show_beats_valid=0, show_beats_total=0, show_beats_valid_sum=0;
var print_info_timer = new Timer(20000)
print_info_timer.start_at(new Date().getTime()-16000) // run first time

function processOsc(message) {
    // console.log("osc", message);

    osc_pkts+=1;

    if (process.stdin.isTTY && print_info_timer.is_it_time_yet()) {
        console.log("SHOW INFORMATION");
        Object.keys(show.devices).forEach(function(v){
            var device=show.devices[v]
            console.log(device.id,"\t",
                        device.bpm.bpm_avg,"\t",
                        device.bpm.samples.slice(
                            device.bpm.samples.length-3).join())
            console.log('averages',device.bpm.averages.length)
            console.log(device.bpm.averages)
            // console.log(device.bpm.bpm_window.join())
        });
        // total beats:
        console.log("show total beats:", show.total_beats_count);
        console.log("show average bpm:",
                    show.total_beats_sum/show.total_beats_count);
        console.log('osc packets_per_second:', packets_per_second(osc_pkts))
        // console.log('processor CPU:', global.processCpuUsage*100)
    }


    // parse message
    var path = message[0].split('/');
    var device_id = 'device_'+path[1];
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

        // console.log('device_id', device_id);
        io.sockets.to('device_graph:'+device_id).emit('update_device_graph', message);
        // // in the future change this to once a second?
        // io.sockets.to('global_graphs').emit('update_global_graphs', message);
    }

};









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












/*

 Test Server Setup

 */


 if (runtestserver) {
     const { exec } = require('child_process');

     app.use('/runtest', (req, res) => {
         exec('/bin/ps aux | grep osc_record_replay.py | grep timeout | grep -v grep | wc -l', (err, stdout, stderr) => {
           console.log(`stdou: ${stdout}`);
           console.log(`stderr: ${stderr}`);
           if (stdout && parseInt(stdout) > 0) {
               res.send(`Test streams already running: ${stdout}<br><br><a href="/runtestend">stop streams</a><br><br><a href="/runtestcleardata">reset show data</a>`);
           }
           else {
               res.send(`Test streams already running: 0<br><br><a href="/runtestbegin">start streams</a> for 20 minutes<br><a href="/runtestbegin41">start 41 streams</a> for 20 minutes<br><br><a href="/runtestcleardata">reset show data</a>`);
           }
         });

     });
     app.use('/runtestbegin', (req, res) => {
       exec('cd ./test/osc_player/ && timeout 20m ./run.sh >/dev/null &', (err, stdout, stderr) => {});
       // exec('cd ./test/osc_player/ && timeout 20m ./run4.sh >/dev/null &', (err, stdout, stderr) => {});
         res.redirect('back');
     });
     app.use('/runtestbegin41', (req, res) => {
       exec('cd ./test/osc_player/ && timeout 20m ./run41.sh >/dev/null &', (err, stdout, stderr) => {});
       // exec('cd ./test/osc_player/ && timeout 20m ./run4.sh >/dev/null &', (err, stdout, stderr) => {});
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



/*

 Terminal interface

 */

if (process.stdin.isTTY) {
    var util = require('util')

    var stdin = process.openStdin();
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    stdin.on( 'data', function( key ){
      if ( key === '\u0003' ) { // ctrl+c aka quit
        setTimeout(function(){process.exit()}, PROCESS_EXIT_WAIT);
      }
      else if ( key === '\u0013') { // ctrl+s aka save
        process.nextTick(function() {
          var json = JSON.stringify(show,null,4);
            fs.writeFile(show.name+'.json', json, 'utf8',
                function(){console.log('saved',show.name+'.json')});
        })
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
