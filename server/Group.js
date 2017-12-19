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
  isittimeyet(): check for multiplier before accessing
                 use local values rather than object ? (though using object faster actually)
  BPM._calc*: use local values instead of objects?

  Not sure where function definition should go to only be made and referenced
   should we create it in the constructor function or in the prototype?
   at the moment we have put them in the prototype
   do we need to care?

  using isittimeyet(2) and then isittimeyet(1) may get called twice

  if OSC provides timestamp already maybe better to grap that in the pulse
  functions rather than always calling Date to define `now`

  In bpm you could store beat_width_ms and then * by systolic_width to get your wait?
    faster than calculating based on beat_avg?
*/

var util = require('util'); // for inheritance

// DEBUG = ['bpm_detect', 'bpm_systolic', 'bpm_add', 'bpm_init']
// DEBUG = ['beat']
DEBUG = []
console.debug = function() {
    // if (DEBUG)
    //     console.log.apply(this,arguments)
        // console.log(Object.values(arguments).splice(1))
}
console.debug = function() {
    if (DEBUG.indexOf(arguments[0])>=0)
        console.log.apply(this,arguments)
}


function Timer(initial_last_ms=0, initial_wait_ms=0) {
    this.last_ms = initial_last_ms;
    this.wait_ms = initial_wait_ms;
}
Timer.prototype = {
    isittimeyet: function(multiplier=1) {
        var now = new Date().getTime();
        if (now >= this.last_ms+(this.wait_ms*multiplier)) {
            var elapsed_ms = now - this.last_ms;
            // console.debug('isittimeyet', now, this.last_ms, this.wait_ms, multiplier)
            // console.debug('now >= this.last_ms+(this.wait_ms*multiplier)')
            // console.debug(now,'>=',this.last_ms,'+(',this.wait_ms,'*',multiplier,')',)
            // console.debug('elapsed_ms = now - this.last_ms');
            // console.debug(elapsed_ms,' = ',now,' - ',this.last_ms)
            this.last_ms = now;
            return elapsed_ms;
        }
        else {
            return false;
        }
    }
}


function GSR(id, samples_per_second, store_window_seconds) {
}
GSR.prototype = {
    append: function(){
    },
}





function Pulse(id, samples_per_second, options) {
    this.id         = id
    this.options    = options;
    this.samples_ps = samples_per_second   || 10; // low res

    this.samples_start_time = new Date().getTime();
    this.samples = [];

    this.samples_record_timer = new Timer()
    this.samples_record_timer.wait_ms = 1000 / this.samples_ps;
    this.samples_record_timer.last_ms = this.samples_start_time;
}
Pulse.prototype = {
    append: function(value){
        // first sample
        if (this.samples.length === 0) {
            var now = new Date().getTime();
            this.samples.push(value)
            this.samples_record_timer.last_ms = now;
        }
        // If more than two cycles have passed it indicates a large gap to fill
        else if (elapsed_ms = this.samples_record_timer.isittimeyet(2)) {
            var n_missing  = parseInt(elapsed_ms / this.samples_record_timer.wait_ms);
            if (this.options.null_on_fail) {
                this.samples.concat( Array(n_missing-1).fill(0) )
                this.samples.push(value)
            }
            else {
                this.samples.concat( Array(n_missing).fill(value) )
            }
        }
        // if one cycle has passed, record a sample
        else if (this.samples_record_timer.isittimeyet()) {
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
    this.samples_record_timer = new Timer();
    this.samples_record_timer.wait_ms = 1000 / this.samples_ps;

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
    this.systolic_timer = new Timer();
    //                              vv beat width in ms vv  will change when `bpm_avg`
    this.systolic_timer.wait_ms = ((60/options.bpm_min)*1000) * options.systolic_width;
    this.systolic_timer.last_ms = 0

    // toggle for no beat / beat floor detection
    // true set after systolic peak passed so we know now to wait for low pulse
    this._waitingforbeatfloor = false;

    // after peak we wait for a pulse benieth this floor before knowing the
    // full heart beat stages have passed and we can start looking for a new
    // beat by setting `_waitingforbeatpeak = true`
    this.options.diastolic_roof_value = options.pulse_max*options.diastolic_roof

    console.debug('bpm_init', 'samples_record_timer:', this.samples_record_timer.wait_ms, this.samples_record_timer.last_ms, '(wait_ms last_ms)')
    console.debug('bpm_init', 'systolic_timer:', this.systolic_timer.wait_ms, this.systolic_timer.last_ms, '(wait_ms last_ms)')
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
        console.debug('bpm_systolic',ms,this.bpm_avg,this.systolic_timer.wait_ms,'(ms bpm_avg wait_ms)')
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
        else if (elapsed_ms = this.systolic_timer.isittimeyet(2)) {
            var n_missing  = parseInt(elapsed_ms / this.systolic_timer.wait_ms);
            console.debug(arguments[0],'n_missing', n_missing, elapsed_ms, this.systolic_timer.wait_ms)
            this.samples.concat( Array(n_missing-1)
                                 .fill(this.samples) )
            this.samples.push(value)
        }
        // if one cycle has passed, record a sample
        else if (this.systolic_timer.isittimeyet(this)) {
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
                this.systolic_timer.wait_ms = this.calc_systolic_wait_ms()
                this.systolic_timer.last_ms = now
                // Store in GPM in samples history??

                // first run, always store
                if (this.samples.length == 0) {
                    this.samples_start_time = now
                    this.samples.push([now,this.bpm_avg])
                    this.samples_record_timer.last_ms = now
                }
                // not first but way too much time passed, fill in gap
                else if (elapsed_ms = this.samples_record_timer.isittimeyet(2)) {
                    console.debug('bpm_detect', 'too much time elapsed :', this.samples_record_timer.wait_ms*2 , '(wait_ms*2)')
                    // too long has passed, fill in
                    var n_missing  = parseInt(elapsed_ms / this.samples_record_timer.wait_ms);
                    console.debug('bpm_detect',n_missing,this.samples)
                    if (this.options.null_on_fail) {
                        for (i=n_missing-1;i>0;i--)
                            this.samples.push([now-(this.samples_record_timer.wait_ms*i),0])
                        this.samples.push([now,this.bpm_avg])
                    }
                    else {
                        for (i=n_missing-1;i>=0;i--)
                            this.samples.push([now-(this.samples_record_timer.wait_ms*i),this.bpm_avg])
                    }
                }
                else if (elapsed_ms = this.samples_record_timer.isittimeyet()) {
                    console.debug('bpm_detect','enough time elapsed :', this.samples_record_timer.wait_ms, '(wait_ms)')
                    this.samples.push([now,this.bpm_avg])
                }


                if (typeof this.on_beat_cb === 'function') {
                    this.on_beat_cb({id: this.id, bpm: [now, this.bpm_avg]})
                }
            }
        }
        else if (this._waitingforbeatfloor || this.systolic_timer.isittimeyet() ) {
            if (!this._waitingforbeatfloor)
                console.debug('bpm_detect', 'passed systolic_time, look for floor:', this.systolic_timer.wait_ms, this.options.diastolic_roof_value, '(wait_ms diastolic_roof_value)')
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
        null_on_fail: false
    },
    pulse: {
        null_on_fail: true
    }
}


function Group(name, options) {
    this.name       = name || new Date().toISOString();
    this.options    = Object.assign({}, default_options, options);

    this.timebegin = new Date().getTime();
    this.timeend = null;

    this.on_beat_cb = function(d){console.log('on_beat_cb',d)};

    this.devices    = {};
    this.bpm_avg    = [];

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
        this.bpm_avg    = []
    }
}

// util.inherits(Device, Group);
// util.inherits(BPM, Group);

module.exports = Group;
