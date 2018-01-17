

# server

tested with node v9.2.0 npm v5.5.1 node-gyp v3.6.2

### setup

    sudo apt-get install npm
    sudo npm cache clean -f
    sudo npm install -g n
    sudo n 9.2.0

    git clone https://github.com/cyphunk/haironyourhead.git

    cd haironyourhead/server
    npm install

    sudo apt-get install python-liblo python3-liblo

    sudo ufw allow 9999
    sudo ufw allow 8081

### run

    cd haironyourhead/server

    node server.js --runtestserver \
      --interface <network_interface> \
      --showname <show_name>

replace <network_interface> with the linux/unix name of the network interface
that has been assigned an IP that is facing the glove device "dev" network.

replace <show_name> with any string. will be used as prefix for auto-saved log
files

e.g. ``node server.js --runtestserver --interface enp3s0 --showname rehearsal``
