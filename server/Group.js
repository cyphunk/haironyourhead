/*
  Current Global View 1 - History
   - live data (gifs)

   - history
       bpm_global:
       bpm_individuals:

minute
onconnect:

/history/all
/history/device_id
/live/device_id

*/

// obj contains _last_ms tracker
// return false or elapsed ms
// ILL probably regret making this function. thought it would be more efficient
// to pass around object references instead of creating object functions on
// each object


// EFFICIENCY IDEA:
/*
  is_it_time_yet(): check for multiplier before accessing
                 use local values rather than object ? (though using object faster actually)
  BPM._calc*: use local values instead of objects?

  Not sure where function definition should go to only be made and referenced
   should we create it in the constructor function or in the prototype?
   at the moment we have put them in the prototype
   do we need to care?

  using is_it_time_yet(2) and then is_it_time_yet(1) may get called twice

  if OSC provides timestamp already maybe better to grap that in the pulse
  functions rather than always calling Date to define `now`

  In bpm you could store beat_width_ms and then * by systolic_width to get your wait?
    faster than calculating based on beat_avg?
*/

var Timer = require('./Timer.js')


DEBUG = [
    'beat',
    // 'show_bpm',
    // 'bpm_detect',
    // 'bpm_systolic',
    // 'bpm_add',
    // 'bpm_init'
]

if (DEBUG.length > 0 && process.stdin.isTTY)
    console.debug = function() {
        if (DEBUG.indexOf(arguments[0])>=0)
            console.log.apply(this,arguments)
    }
else
    console.debug = function(){}


function Pulse(id, samples_per_second, options) {
    this.id         = id
    this.options    = options;
    this.samples_ps = samples_per_second   || 10; // low res

    this.samples = [];

    this.samples_record_timer = new Timer(1000 / this.samples_ps /* wait_for_ms */ )
}
Pulse.prototype = {
    append: function(value){
        // first sample
        if (this.samples.length === 0) {
            this.samples.push(value)
            this.samples_record_timer.start_now();
        }
        // If more than two cycles have passed it indicates a large gap to fill
        else if (elapsed_ms = this.samples_record_timer.is_it_time_yet(2)) {
            // how many samples are missing that we need to fill in for?
            var n_samples_missing  = parseInt(elapsed_ms / this.samples_record_timer.wait_for_ms);
            if (this.options.null_on_fail) {
                this.samples.concat( Array(n_samples_missing-1).fill(0) )
                this.samples.push(value)
            }
            else {
                this.samples.concat( Array(n_samples_missing).fill(value) )
            }
        }
        // if one cycle has passed, record a sample
        else if (this.samples_record_timer.is_it_time_yet()) {
            this.samples.push(value)
        }
        // assume data is coming in live and never store time stamps
        // rather than keep timestamps for every value
        // we just make sure to fill up the array for missing values
        // and keep the start time
    },
}















function BPM(id, samples_per_second, options, on_beat_cb) {
    this.options    = options;
    this.id         = id;
    this.samples_ps = samples_per_second;
    this.on_beat_cb = on_beat_cb;

    var now = new Date().getTime();

    // store history of BPM's (every `samples_ps`) here:
    this.samples_start_time = now; // when our log started, because we dont store timestamps
    this.samples = [];     // we will assume each sample is in sync with `samples_ps`

    // last recorded BPM average
    this.bpm_avg      = 0; // DYNAMIC

    // `bpm_window` window stores N number of beats that we use to calculate BPM
    this.bpm_window   = []; //Array(this.options.bpm_window_size).fill(now);

    // timer used to know when we should record current BPM (`this.bpm_avg`)
    // into `this.samples`
    this.samples_record_timer = new Timer(1000 / this.samples_ps /* wait_for_ms */ );

    // Toggle for beat peak detection
    // true to look for beat, false to wait for systolic peak to pass:
    this._waitingforbeatpeak = true;

    // EFFICIENCY IDEA: could move to global Group object initialization?

    // over this value is when the Beat is detected
    this.options.systolic_floor_value = options.pulse_max*options.systolic_floor

    // some calculates to know how long the systolic peak / Beat could last
    this.options.systolic_max_ms      = ((60/options.bpm_min)*1000)*options.systolic_width
    this.options.systolic_min_ms      = ((60/options.bpm_max)*1000)*options.systolic_width

    // this timer is used to wait for systolic time to pass
    //                                 vv beat width in ms vv  will change when `bpm_avg`
    this.systolic_timer = new Timer( ((60/options.bpm_min)*1000) * options.systolic_width );

    // toggle for no beat / beat floor detection
    // true set after systolic peak passed so we know now to wait for low pulse
    this._waitingforbeatfloor = false;

    // after peak we wait for a pulse benieth this floor before knowing the
    // full heart beat stages have passed and we can start looking for a new
    // beat by setting `_waitingforbeatpeak = true`
    this.options.diastolic_roof_value = options.pulse_max*options.diastolic_roof

    // spread record is 10 second window recorder
    this.spread_record_timer = new Timer(10000); // once every 10 seconds
    this.spread_buffer = []
    this.spread = []

    console.debug('bpm_init', 'samples_record_timer:', this.samples_record_timer.wait_for_ms, this.samples_record_timer.last_ms, '(wait_ms last_ms)')
    console.debug('bpm_init', 'systolic_timer:', this.systolic_timer.wait_for_ms, this.systolic_timer.last_ms, '(wait_ms last_ms)')
    console.debug('bpm_init', 'systolic:', this.options.systolic_min_ms, this.options.systolic_max_ms, '(systolic_min_ms systolic_max_ms)')
}
BPM.prototype = {
    bpm_valid: function(bpm) {
                   return bpm >= this.options.bpm_min &&
                          bpm <= this.options.bpm_max; },
    calc_bpm_avg: function () {
        if (this.bpm_length < 2)
            return -1
        var avg_beat_length_ms = (this.bpm_window[this.bpm_window.length-1]-this.bpm_window[0]) / this.bpm_window.length
        var avg = (60*1000) / avg_beat_length_ms
        if (!this.bpm_valid(avg))
            return 0; //this.options.default_bpm_avg;
        return parseInt(avg);
    },
    bpm_window_add: function(timestamp) {
        if (this.bpm_window.length >= this.options.bpm_window_size)
            this.bpm_window.shift()
        this.bpm_window.push(timestamp)
        console.debug('bpm_add', this.bpm_window, '(bpm_window)')
    },

    systolic_wait_ms_valid: function(ms) {
                                return ms >= this.options.systolic_min_ms &&
                                       ms <= this.options.systolic_max_ms; },
    calc_systolic_wait_ms: function () {
        var ms = ((60/this.bpm_avg)*1000) * this.options.systolic_width;
        console.debug('bpm_systolic',ms,this.bpm_avg,this.systolic_timer.wait_for_ms,'(ms bpm_avg wait_ms)')
        if (!this.systolic_wait_ms_valid(ms))
            return this.options.systolic_min_ms;
        console.debug('bpm_systolic', 'valid')
        return ms;
    },
    /*
    append: function(value){
        // first sample
        if (this.samples.length === 0) {
            console.debug(arguments[0], 'first')
            var now = new Date().getTime();
            this.samples.push(value)
            this._last_ms = now;
            return;
        }
        // If more than two cycles have passed it indicates a large gap to fill
        else if (elapsed_ms = this.systolic_timer.is_it_time_yet(2)) {
            var n_missing  = parseInt(elapsed_ms / this.systolic_timer.wait_for_ms);
            console.debug(arguments[0],'n_missing', n_missing, elapsed_ms, this.systolic_timer.wait_for_ms)
            this.samples.concat( Array(n_missing-1)
                                 .fill(this.samples) )
            this.samples.push(value)
        }
        // if one cycle has passed, record a sample
        else if (this.systolic_timer.is_it_time_yet(this)) {
            console.debug(arguments[0], '')
            this.samples.push(value)
        }
        // assume data is coming in live and never store time stamps
        // rather than keep timestamps for every value
        // we just make sure to fill up the array for missing values
        // and keep the start time
    },
    */
    detect: function(pulse_value) {
        console.debug('bpm_detect','detect begin', pulse_value)
        if (this._waitingforbeatpeak) {
            if (pulse_value >= this.options.systolic_floor_value) {
                console.debug('bpm_detect','pulse_value > systolic_floor_value:',pulse_value,this.options.systolic_floor_value)
                console.debug('beat', "bang")

                this._waitingforbeatpeak = false;

                var now = new Date().getTime()
                // store beat in sliding average window
                this.bpm_window_add(now)
                // calculate the bpm avg
                this.bpm_avg = this.calc_bpm_avg()

                // update the systolic wait time for the new avg
                this.systolic_timer.set_wait_for(this.calc_systolic_wait_ms())
                this.systolic_timer.start_at(now)
                // Store in GPM in samples history??

                // first run, always store
                if (this.samples.length == 0) {
                    this.samples_start_time = now
                    this.samples.push([now,this.bpm_avg])
                    this.samples_record_timer.start_at(now)
                }
                // not first but way too much time passed, fill in gap
                else if (elapsed_ms = this.samples_record_timer.is_it_time_yet(2)) {
                    console.debug('bpm_detect', 'too much time elapsed :', this.samples_record_timer.wait_for_ms*2 , '(wait_ms*2)')
                    // too long has passed, fill in
                    var n_missing  = parseInt(elapsed_ms / this.samples_record_timer.wait_for_ms);
                    console.debug('bpm_detect',n_missing,this.samples)
                    if (this.options.null_on_fail) {
                        for (i=n_missing-1;i>0;i--)
                            this.samples.push([now-(this.samples_record_timer.wait_for_ms*i),0])
                        this.samples.push([now,this.bpm_avg])
                    }
                    else {
                        for (i=n_missing-1;i>=0;i--)
                            this.samples.push([now-(this.samples_record_timer.wait_for_ms*i),this.bpm_avg])
                    }
                }
                else if (elapsed_ms = this.samples_record_timer.is_it_time_yet()) {
                    console.debug('bpm_detect','enough time elapsed :', this.samples_record_timer.wait_for_ms, '(wait_ms)')
                    this.samples.push([now,this.bpm_avg])
                }

                // Let parents do something?
                // CALLBACK
                if (typeof this.on_beat_cb === 'function') {
                    this.on_beat_cb({id: this.id, bpm: [now, this.bpm_avg]})
                }
            }
        }
        else if (this._waitingforbeatfloor || this.systolic_timer.is_it_time_yet() ) {
            if (!this._waitingforbeatfloor)
                console.debug('bpm_detect', 'passed systolic_time, look for floor:', this.systolic_timer.wait_for_ms, this.options.diastolic_roof_value, '(wait_ms diastolic_roof_value)')
            else
                console.debug('bpm_detect','look for floor:',  this.options.diastolic_roof_value, '(diastolic_roof_value)')

            this._waitingforbeatfloor = true
            // systolic waiting period has passed
            if (pulse_value <= this.options.diastolic_roof_value) {
                console.debug('bpm_detect','found floor', '(pulse_value)')
                this._waitingforbeatpeak = true
                this._waitingforbeatfloor = false

            }
        }
    }
}



function Device(id, options, on_beat_cb) {
    this.id    = id;
    this.name2 = this.name
    this.bpm   = new BPM(this.id, options.bpm_samples_per_second, options.bpm, on_beat_cb);
    // this.pulse = new Pulse(id, options.pulse_samples_per_second, options.pulse);
    // this.gsr   = new GSR(id, options.gsr_samples_per_second);
}
Device.prototype = {
    show_all: function() {
        console.log(this)
    },
}

var default_options = {
    pulse_samples_per_second: 10, // 10=2,160,000 values per hour
    bpm_samples_per_second: 1,    //  1=  216,000
    gsr_samples_per_second: 1,

    bpm: {
        default_bpm_avg: 60,
        pulse_min: 0,
        pulse_max: 1000,
        systolic_floor: 0.6, // beat if over pulse_max*this
        diastolic_roof: 0.4, // after pulse_max*this start looking again
        systolic_width: 0.3, // after bpm*this time is we will look for new beat
        bpm_min: 40,
        bpm_max: 220,
        bpm_window_size: 6,
        null_on_fail: false,
    },
    pulse: {
        null_on_fail: true
    },
    update_group_info_on_beat: true, // false for efficiency
}


function Group(name, options) {
    this.name       = name || new Date().toISOString();
    this.options    = Object.assign({}, default_options, options);

    this.timebegin  = new Date().getTime();
    this.timeend    = null;

    this.on_beat_cb = function(d){console.log('on_beat_cb',d)};

    this.devices    = {};
    this.bpm_avg    = [];

    this.total_beats_count = 0;
    this.total_beats_sum = 0;

}
Group.prototype = {
    add_device: function(device_id) {
        if (!this.devices.hasOwnProperty[device_id])
            this.devices[device_id] = new Device(device_id, this.options, this.on_beat_cb);
    },
    end: function() {
        this.timeend = new Date().getTime();
    },
    reset: function () {
        this.timebegin = new Date().getTime();

        this.devices = {}
        this.bpm_avg = []
    },
    update_total_bpm_info: function (bpm) {
        // THIS here is in the cb context (BPM object)
        console.debug('show_bpm', 'data',bpm ,this.options.update_group_info_on_beat)
        if (this.options.update_group_info_on_beat
            && bpm > 0) {
            // this too is not in Group context
            this.total_beats_count += 1
            this.total_beats_sum += bpm
            console.debug('show_bpm', 'update', this.total_beats_sum, this.total_beats_sum )
        }
    },
    get_info: function () {
        return {
            total_beats_count: this.total_beats_count,
            total_beats_sum: this.total_beats_sum,
            total_bpm_avg: this.total_beats_sum/this.total_beats_count
        }
    },
    get_bpm_last: function (device_id) {
        if (device_id && this.devices.hasOwnProperty(device_id)) {
            var len = this.devices[device_id].bpm.samples.length
            var sample = this.devices[device_id].bpm.samples[len-1]
            return { device_id: { bpm: { samples: [ sample ] } } }
        }
        else {
            var devices = {}
            Object.keys(this.devices).forEach(function(device_id) {
                var len = this.devices[device_id].bpm.samples.length
                var sample = this.devices[device_id].bpm.samples[len-1]
                devices[device_id] = { bpm: { samples: [ sample ]} }
            })
            return devices;
        }
    }
}


module.exports = Group;
