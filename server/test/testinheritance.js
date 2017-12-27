var util = require('util')

    class Group {
        constructor() {
            if (this.hasOwnProperty('name')) return; // stop recursion?
            this.name = new Date().toISOString();
            console.log('initialize Group, name:', this.name)
            this.devices = {}
        }
        add_device(id) {
            if (!this.devices.hasOwnProperty(id))
                this.devices[id] = new Device(id)
                this.devices[id].component = new Component()
        }
    }
    class Device extends Group {
        constructor(id=null) {
            super()
            if (this.hasOwnProperty('id')) return; // stop recursion?

            console.log('initialize Device, id:', id)
            this.id = id
            console.log('Access parent name from device init:', this.name)
            // this.component = new Component()
        }
    }
    class Component extends Device {
        constructor() {
            super()
            console.log('initialize component for device')
            // console.log(this.id)
        }
    }

    var g = new Group()
    g.add_device("1")
console.log(util.inspect(g))

class Polygon {
  constructor(height, width) {
    this.height = height;
    this.width = width;
  }
}

class Square extends Polygon {
  constructor(sideLength) {
    super(sideLength, sideLength);
  }
  get area() {
    return this.height * this.width;
  }
  set sideLength(newLength) {
    this.height = newLength;
    this.width = newLength;
  }
}
class Pattern extends Square {
  constructor(len) {
    super(len);
    this.square = new Square(len)
  }
}
class Wallpaper extends Pattern {
  constructor() {
    super(10);
    this.pattern = new Pattern(10)
  }
}
var square = new Square(2);
console.log(util.inspect(square))
var pattern = new Pattern(10)
console.log(util.inspect(pattern))
var wall = new Wallpaper()
console.log(util.inspect(wall))
