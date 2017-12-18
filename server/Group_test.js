Group=require('./Group.js')
group = new Group('test')

console.log(group)

group.add_device(1)
group.add_device(2)

dev1=group.devices[1]
dev2=group.devices[2]

// dev1.bpm.detect(100)
// console.log(dev1.bpm.samples)
// try {
// dev1.bpm.detect(200)
// } catch(e) {console.trace(e)}
// console.log(dev1.bpm.samples)
// dev1.bpm.detect(999)
// console.log(dev1.bpm.samples)
// dev1.bpm.detect(999)
// console.log(dev1.bpm.samples)


var i = 10000;
var max = 1000;
var val = 0

inth = setInterval(function() {
        if (i++<=0)
            clearTimeout(inth)
        // console.log("val", val)
        dev1.bpm.detect(val)
        // console.log('dev', dev1.bpm.samples)

        val+=20;
        if (val > max)
            val=0

        i=i-1

},10)
