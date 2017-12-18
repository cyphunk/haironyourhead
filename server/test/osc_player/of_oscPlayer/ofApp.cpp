#include "ofApp.h"
/*

	GUI should look like this:

	Server:
      Address/IP: localhost
	  Port: 1234

	OSC 1
	  Pulse File:                      nathan.csv change
	  Pulse Path:                      /hoyh      change
	  Beats Per Minute Path:           /hoyh_bpm
	  Enable sending live pulse:       [ ]        change
	  Enable sending beats per minute: [ ]        change
      [label: current line                              ]
	  [bang] BPM#

	OSC 2
	  Pulse File:                      nathan.csv change
	  Pulse Path:                      /hoyh      change
	  Enable sending live pulse:       [ ]        change
	  Beats Per Minute Path:           /hoyh_bpm
	  Enable sending beats per minute: [ ]        change
	  [label: current line                              ]
	  [bang] BPM#

    OSC 3
	  Pulse File:                      nathan.csv change
	  Pulse Path:                      /hoyh      change
	  Enable sending live pulse:       [ ]        change
	  Beats Per Minute Path:           /hoyh_bpm
	  Enable sending beats per minute: [ ]        change
	  [label: current line                              ]
	  [bang] BPM#
*/

ofParameter<bool> useOSC1;
ofParameter<bool> useOSC2;
ofParameter<bool> useOSC3;

ofParameter<int> iterations;
ofParameter<float> tolerance;


file.open(ofToDataPath(filename), ofFile::ReadWrite, false);
ofBuffer buff = file.readToBuffer();
vector<string> tokens = ofSplitString(line, "\t");
srcPoints = vector<ofVec2f>();

ofBuffer::Line it = buff.getLines().begin();
// Discard the header line.
++it;
for (ofBuffer::Line end = buff.getLines().end(); it != end; ++it) {



//--------------------------------------------------------------
void ofApp::setup(){

	ofBackground(40, 100, 40);

	// open an outgoing connection to HOST:PORT
	sender.setup(HOST, PORT);

    imgAsBuffer = ofBufferFromFile("sendImageTest.jpg", true);

}

//--------------------------------------------------------------
void ofApp::update(){

}

//--------------------------------------------------------------
void ofApp::draw(){

    if(img.getWidth() > 0){
        ofDrawBitmapString("Image:", 10, 160);
        img.draw(10, 180);
    }

	// display instructions
	string buf;
	buf = "sending osc messages to" + string(HOST) + ofToString(PORT);
	ofDrawBitmapString(buf, 10, 20);
	ofDrawBitmapString("move the mouse to send osc message [/mouse/position <x> <y>]", 10, 50);
	ofDrawBitmapString("click to send osc message [/mouse/button <button> <\"up\"|\"down\">]", 10, 65);
	ofDrawBitmapString("press A to send osc message [/test 1 3.5 hello <time>]", 10, 80);
	ofDrawBitmapString("press I to send a (small) image as a osc blob to [/image]", 10, 95);

}

//--------------------------------------------------------------
void ofApp::keyPressed(int key){
	if(key == 'a' || key == 'A'){
		ofxOscMessage m;
		m.setAddress("/test");
		m.addIntArg(1);
		m.addFloatArg(3.5f);
		m.addStringArg("hello");
		m.addFloatArg(ofGetElapsedTimef());
		sender.sendMessage(m, false);
	}

    //send an image. (Note: the size of the image depends greatly on your network buffer sizes - if an image is too big the message won't come through )

    if( key == 'i' || key == 'I'){
        img.load(imgAsBuffer);

        ofxOscMessage m;
        m.setAddress("/image");
        m.addBlobArg(imgAsBuffer);
        sender.sendMessage(m);
        cout << "ofApp:: sending image with size: " << imgAsBuffer.size() << endl;
    }
}

//--------------------------------------------------------------
void ofApp::keyReleased(int key){

}

//--------------------------------------------------------------
void ofApp::mouseMoved(int x, int y){
	ofxOscMessage m;
	m.setAddress("/mouse/position");
	m.addIntArg(x);
	m.addIntArg(y);
	sender.sendMessage(m, false);
}

//--------------------------------------------------------------
void ofApp::mouseDragged(int x, int y, int button){

}

//--------------------------------------------------------------
void ofApp::mousePressed(int x, int y, int button){
	ofxOscMessage m;
	m.setAddress("/mouse/button");
	m.addIntArg(button);
	m.addStringArg("down");
	sender.sendMessage(m, false);
}

//--------------------------------------------------------------
void ofApp::mouseReleased(int x, int y, int button){
	ofxOscMessage m;
	m.setAddress("/mouse/button");
	m.addIntArg(button);
	m.addStringArg("up");
	sender.sendMessage(m, false);

}

//--------------------------------------------------------------
void ofApp::mouseEntered(int x, int y){

}

//--------------------------------------------------------------
void ofApp::mouseExited(int x, int y){

}

//--------------------------------------------------------------
void ofApp::windowResized(int w, int h){

}

//--------------------------------------------------------------
void ofApp::gotMessage(ofMessage msg){

}

//--------------------------------------------------------------
void ofApp::dragEvent(ofDragInfo dragInfo){

}
