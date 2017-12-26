/*
A simple class to check when it is time to do something

examples:

var timer = new Timer(5000)   // bang every 5 seconds that passed
var timer.set_wait_for(3000)  // change to be every 3 seconds instead

// by default the counting starts from now. To change:
// start counting 10 seconds from now:
timer.start_at(new Date().getTime()+10000)

// or reset to start counting now:
timer.start_now()

// In a loop this function returns false until wait_for_ms has passed.
// once the time has passed it returned the actual elapsed amount of time:
var elapsed_ms = timer.is_it_time_yet()

*/

function Timer(initial_wait_for_ms=0, initial_last_ms) {
    this.wait_for_ms = initial_wait_for_ms;
    this.last_ms = initial_last_ms || new Date().getTime();
}
Timer.prototype = {
    is_it_time_yet: function(multiplier=1) {
        // Use multiplier
        var now = new Date().getTime();
        if (now >= this.last_ms+(this.wait_for_ms*multiplier)) {
            var elapsed_ms = now - this.last_ms;
            // console.debug('isittimeyet', now, this.last_ms, this.wait_for_ms, multiplier)
            // console.debug('now >= this.last_ms+(this.wait_for_ms*multiplier)')
            // console.debug(now,'>=',this.last_ms,'+(',this.wait_for_ms,'*',multiplier,')',)
            // console.debug('elapsed_ms = now - this.last_ms');
            // console.debug(elapsed_ms,' = ',now,' - ',this.last_ms)
            this.last_ms = now;
            return elapsed_ms;
        }
        else {
            return false;
        }
    },
    start_now:    function() {    this.last_ms  = new Date().getTime() },
    start_at:     function(ms) {  this.last_ms  = ms },
    set_wait_for: function(ms) {  this.wait_for = ms }
}
module.exports = Timer;
