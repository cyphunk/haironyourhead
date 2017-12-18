'strict mode';

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

// DEBUG = ['bpm_detect', 'bpm_systolic', 'bpm_add', 'bpm_init']
DEBUG = ['beat', 'classes6']

var default_options = {
    // options you may want to change
    pulse_samples_per_second: 10, // 10=2,160,000 values per hour
    bpm_samples_per_second: 1,    //  1=  216,000
    gsr_samples_per_second: 1,

    // options you probably will not change
    bpm: {
        default_bpm_avg: 60,
        pulse_min: 0,
        pulse_max: 1000,
        systolic_floor: 0.6, // beat if over pulse_max*this
        diastolic_roof: 0.4, // after pulse_max*this start looking again
        systolic_width: 0.3, // after bpm*this time is we will look for new beat
        bpm_min: 40, // ignore when lower
        bpm_max: 220, // ignore when higher
        beat_window_size: 6, // beat window size for calculating avg bpm
        null_on_fail: false
    },
    pulse: {
        null_on_fail: true
    }
}



var util = require('util'); // for inheritance

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






class Group {
    constructor(name, on_beat_cb, options) {
        if (this.name) // be sure when initalize self only once
            return;
        this.name       = name || new Date().toISOString();
        this.options    = Object.assign({}, default_options, options);


        // this parent optional function called on beat detect
        this.on_beat_cb = on_beat_cb || function(d){console.log('on_beat_cb',d)};

        this.timebegin = new Date().getTime();
        this.timeend   = null;

        // structure stores all device children
        this.devices    = {};
        // this.add_device("000")
    }
    add_device(device_id) {
        if (!this.devices.hasOwnProperty[device_id])
            this.devices[device_id] = new Device(device_id);
    }
    end() {
        this.timeend = new Date().getTime();
    }
}


class Device extends Group {
    constructor(id=null) {
        console.debug('classes6','new Device(id):',id)
        super();
        if (this.hasOwnProperty('id'))
            return;
        if (!this.id)
            this.id = id;
        if (!this.bpm)
            this.bpm = new BPM();

        // this.id = id;
        // var id    = id;
        // this.pulse = new Pulse();
        // this.gsr   = new GSR(id, options.gsr_samples_per_second);
    }
    show_all() {
        console.log("device show all",this)
    }
}



class BPM extends Device {
    constructor() {
        // console.log('super', console.dir(super))
        super();
        if (this.hasbeeninited) return;

        this.hasbeeninited=true;
        console.log('bpm accces parent:', this.id)
    }
    init(){
        // super.show_all();
        var ourthis = this;
        var samples_ps = ourthis.options.bpm_samples_per_second

        var now = new Date().getTime();

        // store history of BPM's (every `samples_ps`) here:
        ourthis.samples_start_time = now; // when our log started, because we dont store timestamps
        ourthis.samples = [];     // we will assume each sample is in sync with `samples_ps`

        // last recorded BPM average
        ourthis.bpm_avg      = 0; // DYNAMIC

        // `beat_window` window stores N number of beats that we use to calculate BPM
        ourthis.beat_window   = []; //Array(ourthis.options.bpm.beat_window_size).fill(now);

        // timer used to know when we should record current BPM (`ourthis.bpm_avg`)
        // into `ourthis.samples`
        ourthis.samples_record_timer = new Timer();
        ourthis.samples_record_timer.wait_ms = 1000 / ourthis.options.bpm_samples_per_second;

        // Toggle for beat peak detection
        // true to look for beat, false to wait for systolic peak to pass:
        ourthis._waitingforbeatpeak = true;

        // EFFICIENCY IDEA: could move to global Group object initialization?

        // over this value is when the Beat is detected
        ourthis.systolic_floor_value = options.pulse_max*options.systolic_floor

        // some calculates to know how long the systolic peak / Beat could last
        ourthis.systolic_max_ms      = ((60/ourthis.options.bpm.bpm_min)*1000)*ourthis.options.bpm.systolic_width
        ourthis.systolic_min_ms      = ((60/ourthis.options.bpm.bpm_max)*1000)*ourthis.options.bpm.systolic_width

        // this timer is used to wait for systolic time to pass
        ourthis.systolic_timer = new Timer();
        //                              vv beat width in ms vv  will change when `bpm_avg`
        ourthis.systolic_timer.wait_ms = ((60/ourthis.options.bpm.bpm_min)*1000) * options.systolic_width;
        ourthis.systolic_timer.last_ms = 0

        // toggle for no beat / beat floor detection
        // true set after systolic peak passed so we know now to wait for low pulse
        ourthis._waitingforbeatfloor = false;

        // after peak we wait for a pulse benieth this floor before knowing the
        // full heart beat stages have passed and we can start looking for a new
        // beat by setting `_waitingforbeatpeak = true`
        ourthis.diastolic_roof_value = ourthis.options.bpm.pulse_max*ourthis.options.bpm.diastolic_roof

        console.debug('bpm_init', 'samples_record_timer:', ourthis.samples_record_timer.wait_ms, ourthis.samples_record_timer.last_ms, '(wait_ms last_ms)')
        console.debug('bpm_init', 'systolic_timer:', ourthis.systolic_timer.wait_ms, ourthis.systolic_timer.last_ms, '(wait_ms last_ms)')
        console.debug('bpm_init', 'systolic:', ourthis.options.systolic_min_ms, ourthis.options.systolic_max_ms, '(systolic_min_ms systolic_max_ms)')
    }
    _bpm_valid(bpm) {
                   return bpm >= ourthis.options.bpm.bpm_min &&
                          bpm <= ourthis.options.bpm.bpm_max;
    }
    _calc_bpm_avg() {
        if (ourthis.beat_window.length < 2)
            return -1
        var avg_beat_length_ms = (ourthis.beat_window[ourthis.beat_window.length-1]-ourthis.beat_window[0]) / ourthis.beat_window.length
        var avg = (60*1000) / avg_beat_length_ms
        if (!ourthis._bpm_valid(avg))
            return 0; //ourthis.options.default_bpm_avg;
        return parseInt(avg);
    }
    _beat_window_add(timestamp) {
        if (ourthis.beat_window.length >= ourthis.options.bpm.beat_window_size)
            ourthis.beat_window.shift()
        ourthis.beat_window.push(timestamp)
        console.debug('bpm_add', ourthis.beat_window, '(beat_window)')
    }
    _systolic_wait_ms_valid(ms) {
                                return ms >= ourthis.options.systolic_min_ms &&
                                       ms <= ourthis.options.systolic_max_ms;
    }
    _calc_systolic_wait_ms() {
        var ms = ((60/ourthis.bpm_avg)*1000) * ourthis.options.systolic_width;
        console.debug('bpm_systolic',ms,ourthis.bpm_avg,ourthis.systolic_timer.wait_ms,'(ms bpm_avg wait_ms)')
        if (!ourthis._systolic_wait_ms_valid(ms))
            return ourthis.options.systolic_min_ms;
        console.debug('bpm_systolic', 'valid')
        return ms;
    }
    /*
    append: function(value){
        // first sample
        if (ourthis.samples.length === 0) {
            console.debug(arguments[0], 'first')
            var now = new Date().getTime();
            ourthis.samples.push(value)
            ourthis._last_ms = now;
            return;
        }
        // If more than two cycles have passed it indicates a large gap to fill
        else if (elapsed_ms = ourthis.systolic_timer.isittimeyet(2)) {
            var n_missing  = parseInt(elapsed_ms / ourthis.systolic_timer.wait_ms);
            console.debug(arguments[0],'n_missing', n_missing, elapsed_ms, ourthis.systolic_timer.wait_ms)
            ourthis.samples.concat( Array(n_missing-1)
                                 .fill(ourthis.samples) )
            ourthis.samples.push(value)
        }
        // if one cycle has passed, record a sample
        else if (ourthis.systolic_timer.isittimeyet(this)) {
            console.debug(arguments[0], '')
            ourthis.samples.push(value)
        }
        // assume data is coming in live and never store time stamps
        // rather than keep timestamps for every value
        // we just make sure to fill up the array for missing values
        // and keep the start time
    },
    */
    detect(pulse_value) {
        console.debug('bpm_detect','detect begin', pulse_value)
        if (ourthis._waitingforbeatpeak) {
            if (pulse_value >= ourthis.options.systolic_floor_value) {
                console.debug('bpm_detect','pulse_value > systolic_floor_value:',pulse_value,ourthis.options.systolic_floor_value)
                console.debug('beat')

                ourthis._waitingforbeatpeak = false;

                var now = new Date().getTime()
                // store beat in sliding average window
                ourthis._beat_window_add(now)
                // calculate the bpm avg
                ourthis.bpm_avg = ourthis._calc_bpm_avg()

                // update the systolic wait time for the new avg
                ourthis.systolic_timer.wait_ms = ourthis._calc_systolic_wait_ms()
                ourthis.systolic_timer.last_ms = now
                // Store in GPM in samples history??

                // first run, always store
                if (ourthis.samples.length == 0) {
                    ourthis.samples_start_time = now
                    ourthis.samples.push(ourthis.bpm_avg)
                    ourthis.samples_record_timer.last_ms = now
                }
                // not first but way too much time passed, fill in gap
                else if (elapsed_ms = ourthis.samples_record_timer.isittimeyet(2)) {
                    console.debug('bpm_detect', 'too much time elapsed :', ourthis.samples_record_timer.wait_ms*2 , '(wait_ms*2)')
                    // too long has passed, fill in
                    var n_missing  = parseInt(elapsed_ms / ourthis.samples_record_timer.wait_ms);
                    console.debug('bpm_detect',n_missing,ourthis.samples)
                    if (ourthis.options.null_on_fail) {
                        ourthis.samples = ourthis.samples.concat( Array(n_missing-1).fill(0) )
                        ourthis.samples.push(ourthis.bpm_avg)
                    }
                    else {
                        ourthis.samples.concat( Array(n_missing).fill(ourthis.bpm_avg) )
                    }
                }
                else if (elapsed_ms = ourthis.samples_record_timer.isittimeyet()) {
                    console.debug('bpm_detect','enough time elapsed :', ourthis.samples_record_timer.wait_ms, '(wait_ms)')
                    ourthis.samples.push(ourthis.bpm_avg)
                }

                if (typeof ourthis.on_beat_cb === 'function') {
                    debugger;
                    ourthis.on_beat_cb({id: ourthis.id, bpm: ourthis.bpm_avg})
                }
            }
        }
        else if (ourthis._waitingforbeatfloor || ourthis.systolic_timer.isittimeyet() ) {
            if (!ourthis._waitingforbeatfloor)
                console.debug('bpm_detect', 'passed systolic_time, look for floor:', ourthis.systolic_timer.wait_ms, ourthis.options.diastolic_roof_value, '(wait_ms diastolic_roof_value)')
            else
                console.debug('bpm_detect','look for floor:',  ourthis.options.diastolic_roof_value, '(diastolic_roof_value)')

            ourthis._waitingforbeatfloor = true
            // systolic waiting period has passed
            if (pulse_value <= ourthis.options.diastolic_roof_value) {
                console.debug('bpm_detect','found floor', '(pulse_value)')
                ourthis._waitingforbeatpeak = true
                ourthis._waitingforbeatfloor = false

            }
        }
    }
}



// util.inherits(Device, Group);
// util.inherits(BPM, Group);

module.exports = Group;
