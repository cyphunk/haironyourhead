//******************************************************************************
#define FIRMWARE_VERSION 1.8    //MAJOR.MINOR more info on: http://semver.org
#define PROJECT "health_monitor"
#define SERIAL_SPEED 9600       // 9600 for BLE friend
#define HOSTNAME "monitor"
//#define EXTERNAL_ADC         // uncomment for version with external ADc
//#define PRODUCTION true       //uncoment to turn the serial debuging off
//#define NEOPIXEL              //if not defined, build in LED will be used
//******************************************************************************

extern "C"{
 #include "user_interface.h"    //NOTE needed for esp_system_info Since the include file from SDK is a plain C not a C++
}

#include <ESP8266WiFi.h>
#include "credentials.h"  //ignored by git to keep the network details private, add lines below into the file
// const char* ssid = "your-network-name";
// const char* password = "password";

#include <WiFiUdp.h>
#include <ESP8266mDNS.h>
#include <ArduinoOTA.h>
//   |--------------|-------|---------------|--|--|--|--|--|
//   ^              ^       ^               ^     ^
//   Sketch    OTA update   File system   EEPROM  WiFi config (SDK)

// -------------------- OSC libraries ------------------------------------------
#include <OSCMessage.h>       // https://github.com/CNMAT/OSC.git
// #include <OSCBundle.h>
#include <OSCData.h>

WiFiUDP Udp;
OSCErrorCode error;
// OSC IP and port settings in credentials.h

#define REPORT_INTERVAL 1000 * 3      //OSC report inerval 3 secs
#define MEASURMENT_INTERVAL 10       //AD measurment inerval
unsigned long previousMillisReport = 0;
unsigned long previousMillisMeasurment = 0;
unsigned long currentMillisReport, currentMillisMeasurment, runningTime;

char oscMsgHeader[8];    //OSC message header updated with unit ID

#ifdef NEOPIXEL
  #include <FastLED.h>
  #define NUM_LEDS 1
  #define DATA_PIN 14 //D5    pin for neopixel
  CRGB leds[NUM_LEDS];
#endif
#ifndef NEOPIXEL
  #define BUILD_IN_LED 02
#endif

#ifdef EXTERNAL_ADC
  #include <Wire.h>
  #include <Adafruit_ADS1015.h>
  Adafruit_ADS1115 ads;  /* Use this for the 16-bit version */
  float ADresolution = 0;
#endif

// normalize function variables
long sliding_min = -1;
long sliding_max = -1;
unsigned int step = 1;

int unit_id;

void setup()
{
#ifndef PRODUCTION
  Serial.begin(SERIAL_SPEED);
  // compiling info
  Serial.println("\r\n--------------------------------");
  Serial.print("Project: "); Serial.println(PROJECT);
  Serial.print("Version: "); Serial.print(FIRMWARE_VERSION); Serial.println(" by Grzegorz Zajac and Nathan Andrew Fain");
  Serial.println("Compiled: " __DATE__ ", " __TIME__ ", " __VERSION__);
  Serial.println("---------------------------------");
  Serial.println("ESP Info: ");
  Serial.print( F("Heap: ") ); Serial.println(system_get_free_heap_size());
  Serial.print( F("Boot Vers: ") ); Serial.println(system_get_boot_version());
  Serial.print( F("CPU: ") ); Serial.println(system_get_cpu_freq());
  Serial.print( F("SDK: ") ); Serial.println(system_get_sdk_version());
  Serial.print( F("Chip ID: ") ); Serial.println(system_get_chip_id());
  Serial.print( F("Flash ID: ") ); Serial.println(spi_flash_get_id());
  Serial.print( F("Flash Size: ") ); Serial.println(ESP.getFlashChipRealSize());
  Serial.printf("Sketch size: %u\n", ESP.getSketchSize());
  Serial.printf("Free size: %u\n", ESP.getFreeSketchSpace());
  Serial.print( F("Vcc: ") ); Serial.println(ESP.getVcc());
  Serial.println();
#endif

#ifdef NEOPIXEL     // initialize neopixel
  FastLED.addLeds<WS2812, DATA_PIN, GRB>(leds, NUM_LEDS);
  FastLED.showColor(CHSV(HUE_GREEN, 255, 100));
#endif

#ifndef NEOPIXEL   // if not neopixel use build in led
  pinMode(BUILD_IN_LED, OUTPUT);
  digitalWrite(BUILD_IN_LED,HIGH); //off by default
#endif

//---------------------------- WiFi --------------------------------------------
WiFi.mode(WIFI_STA);  // https://www.arduino.cc/en/Reference/WiFiConfig
// WiFi.config(ip, gateway, subnet);  //uncomment for fixed ip address, defined in credentials.h file

#ifndef PRODUCTION // Not in PRODUCTION
  Serial.print("unit MAC address: "); Serial.println(WiFi.macAddress());
  Serial.print("Connecting to ");
  Serial.print(ssid); Serial.println(" with DHCP");
#endif
WiFi.begin(ssid, password);

while (WiFi.waitForConnectResult() != WL_CONNECTED) {
#ifndef PRODUCTION // Not in PRODUCTION
  Serial.println("Connection Failed! Rebooting...");
#endif
  delay(5000);
  ESP.restart();
}
delay(500);
#ifndef PRODUCTION // Not in PRODUCTION
  Serial.print("IP address: "); Serial.println(WiFi.localIP());
#endif

unit_id = WiFi.localIP()[3];
Serial.print("Unit ID (last octet): "); Serial.println(unit_id);

// generate OSC header /xxx based on unit_id
sprintf(oscMsgHeader, "/%i", unit_id);   // for sending OSC messages: /xxx/message value

// --------------------------- OTA ---------------------------------------------
char buf[30]; buf[0] = {0};                                                     //TODO tidy up
char id[4]; id[0] = {0};
strcat(buf, HOSTNAME);
sprintf(id, "%i", unit_id);
strcat(buf,id);
ArduinoOTA.setHostname(buf);    // something like: monitor211, to ping or program use monitor211.local

#ifndef PRODUCTION // Not in PRODUCTION
  Serial.print("Hostname: "); Serial.println(buf);
#endif

ArduinoOTA.onStart([]() {
  #ifndef PRODUCTION // Not in PRODUCTION
    Serial.println("Start updating ");
  #endif
});

ArduinoOTA.onEnd([]() {
#ifndef PRODUCTION // Not in PRODUCTION
  Serial.println("\nEnd");
#endif
#ifdef NEOPIXEL
  FastLED.showColor(CHSV(HUE_ORANGE, 255, 200));
#endif

});
ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
#ifndef PRODUCTION // Not in PRODUCTION
  Serial.printf("Progress: %u%%\r", (progress / (total / 100)));
#endif
#ifdef NEOPIXEL   //ota uploading indicator
  FastLED.showColor(CHSV(HUE_BLUE, 255, 100));
  delay(1);
  FastLED.showColor(CHSV(HUE_BLUE, 255, 0));
#endif
#ifndef NEOPIXEL
  digitalWrite(BUILD_IN_LED, LOW); delay(1); digitalWrite(BUILD_IN_LED, HIGH);                                                                  //TODO add build in LED feedback
#endif
});
ArduinoOTA.onError([](ota_error_t error) {
#ifndef PRODUCTION // Not in PRODUCTION
  Serial.printf("Error[%u]: ", error);
  if (error == OTA_AUTH_ERROR) Serial.println("Auth Failed");                   //TODO add red led feedback
  else if (error == OTA_BEGIN_ERROR) Serial.println("Begin Failed");
  else if (error == OTA_CONNECT_ERROR) Serial.println("Connect Failed");
  else if (error == OTA_RECEIVE_ERROR) Serial.println("Receive Failed");
  else if (error == OTA_END_ERROR) Serial.println("End Failed");
#endif
});
ArduinoOTA.begin();
Udp.begin(localPort);

#ifndef NEOPIXEL    //turn led on if connected
digitalWrite(BUILD_IN_LED, LOW);
#endif

//-------------------------- External ADc --------------------------------------
#ifdef EXTERNAL_ADC
  #ifndef PRODUCTION // Not in PRODUCTION
    Serial.println("Getting single-ended readings from AIN0..3");
    Serial.println("ADC Range: +/- 6.144V (1 bit = 0.1875mV/ADS1115)");
  #endif
  ads.setGain(GAIN_TWOTHIRDS);      // 2/3x gain +/- 6.144V       0.1875mV (default)
  ADresolution = 0.1875;
  ads.begin();
#endif

#ifdef NEOPIXEL
FastLED.showColor(CHSV(HUE_GREEN, 255, 100));
delay(500);
FastLED.showColor(CHSV(HUE_GREEN, 255, 0));
#endif
}

void loop() {
  ArduinoOTA.handle();
  OSCMsgReceive();

  currentMillisMeasurment = millis();
  if (currentMillisMeasurment - previousMillisMeasurment >= (MEASURMENT_INTERVAL)) {
    previousMillisMeasurment = currentMillisMeasurment;
    AD2OSC();
  }

  currentMillisReport = millis();
  if (currentMillisReport - previousMillisReport >= (REPORT_INTERVAL)) {
    previousMillisReport = currentMillisReport;
    sendReport();                                                               //TODO send report to diffrent port or IP, separate from Isadora
  }
}

void AD2OSC(){
  #ifdef EXTERNAL_ADC
    int adc0, adc1;
    adc0 = normalize(0, 16384, ads.readADC_SingleEnded(0));
    adc1 = normalize(0, 16384, ads.readADC_SingleEnded(1));
  #endif

  #ifndef EXTERNAL_ADC
    int adc0;
    adc0 = normalize(0, 1024, analogRead(A0));
    // adc0 = analogRead(A0);
  #endif

  char volt_ch1[8];
  volt_ch1[0] = {0}; //reset buffor
  strcat(volt_ch1, oscMsgHeader);
  OSCMessage voltage1(volt_ch1);
  #ifdef EXTERNAL_ADC
    voltage1.add(adc1);
  #endif
  voltage1.add(adc0);
  Udp.beginPacket(remoteIP, destPort);
  voltage1.send(Udp);
  Udp.endPacket();
  voltage1.empty();
}

unsigned long normalize(unsigned long value_min, unsigned long value_max, unsigned long value) {
    // ghetto callibration
    // think of the sliding_min and sliding_max as two walls that are always closing in creating
    // and more and more narrow hallway for the incoming value to fit in. when the value breaches
    // those walls they are expanded by `step`. when the value is below those walls they are
    // further enclosed by step

    if (sliding_min < 0) sliding_min = value_min;
    else if (value < sliding_min) sliding_min = value;
    else if (value > sliding_min && sliding_min+step < sliding_max) sliding_min += step;

    if (sliding_max < 0) sliding_max = value_max;
    else if (value > sliding_max) sliding_max = value;
    else if (value < sliding_max && sliding_max-step > sliding_min) sliding_max -= step;

    unsigned long output;
    // this calculation assumes we want a return value between 0 and 1000. We scale using value so as to avoid any need for float point
    output = (value-sliding_min)*1000/(sliding_max-sliding_min);

    // if you do not want to use the sliding window calibration method then uncomment the following
    //output = (value*1000)/(value_max-value_min);

    return output;
}

void led(OSCMessage &msg, int addrOffset) {
  int R = roundf(msg.getFloat(0) * 255);
  int G = roundf(msg.getFloat(1) * 255);
  int B = roundf(msg.getFloat(2) * 255);

  #ifndef PRODUCTION
    Serial.print("RGB received:");
    Serial.print(" "); Serial.print(R);
    Serial.print(" "); Serial.print(G);
    Serial.print(" "); Serial.println(B);
  #endif

  #ifdef NEOPIXEL
    leds[0] = CRGB(R, G, B);
    FastLED.show();
  #endif

  #ifndef NEOPIXEL
    if (R > 0) digitalWrite(BUILD_IN_LED, LOW);
    else digitalWrite(BUILD_IN_LED, HIGH);
  #endif
}

void OSCMsgReceive(){
  OSCMessage msgIN;
  int size;
  if((size = Udp.parsePacket())>0){
    while(size--)
      msgIN.fill(Udp.read());
    if(!msgIN.hasError()){
      msgIN.route(oscMsgHeader, led);
      //msgIN.dispatch(oscMsgHeader, led);      //for ping option
    } else {
      error = msgIN.getError();
      #ifndef PRODUCTION // Not in PRODUCTION
        Serial.print("error: ");
        Serial.println(error);
      #endif

    }
  }
}

void sendReport(){
  #ifndef PRODUCTION
    Serial.println("\n\r--- Sending OSC status ---");
  #endif

  //rssi
  char rssi_ch[32];
  rssi_ch[0] = {0};
  int32_t RSSI = WiFi.RSSI(); //check if rssi is for current network
  strcat(rssi_ch, oscMsgHeader);
  strcat(rssi_ch, "/rssi");
  OSCMessage rssi(rssi_ch);
  rssi.add(RSSI);
  #ifndef PRODUCTION
    Serial.print(rssi_ch); Serial.print(" "); Serial.println(RSSI);
  #endif
  Udp.beginPacket(remoteIP, destPort);
  rssi.send(Udp);
  Udp.endPacket();
  rssi.empty();

  // running time
  char time_ch[32];
  time_ch[0] = {0};
  unsigned int runningTime = millis()/1000;
  strcat(time_ch, oscMsgHeader);
  strcat(time_ch, "/time");
  OSCMessage rtime(time_ch);
  rtime.add(runningTime);
  #ifndef PRODUCTION
    Serial.print(time_ch); Serial.print(" "); Serial.println(runningTime);
  #endif
  Udp.beginPacket(remoteIP, destPort);
  rtime.send(Udp);
  Udp.endPacket();
  rtime.empty();

  //version
  char ver_ch[16];
  ver_ch[0] = {0};
  strcat(ver_ch, oscMsgHeader);
  strcat(ver_ch, "/ver");
  OSCMessage ver(ver_ch);
  float Ver = FIRMWARE_VERSION; //silly conversion, Max MSP not happy with direct FIRMWARE_VERSION send
  ver.add(Ver);
  #ifndef PRODUCTION
    Serial.print(ver_ch); Serial.print(" "); Serial.println(Ver);
  #endif
  Udp.beginPacket(remoteIP, destPort);
  ver.send(Udp);
  Udp.endPacket();
  ver.empty();

  //channel
  char ch_ch[16];
  ch_ch[0] = {0};
  strcat(ch_ch, oscMsgHeader);
  strcat(ch_ch, "/channel");
  OSCMessage channel(ch_ch);
  channel.add(WiFi.channel());
  #ifndef PRODUCTION
    Serial.print(ch_ch); Serial.print(" "); Serial.println(WiFi.channel());
  #endif
  Udp.beginPacket(remoteIP, destPort);
  channel.send(Udp);
  Udp.endPacket();
  channel.empty();

  #ifdef EXTERNAL_ADC
    float adc2;
    adc2 = ((ads.readADC_SingleEnded(2) * ADresolution)/1000);
    char volt_ch3[8];
    volt_ch3[0] = {0}; //reset buffor
    strcat(volt_ch3, oscMsgHeader);
    strcat(volt_ch3, "/lipo"); //build OSC message with unit ID
    OSCMessage voltage3(volt_ch3);
    voltage3.add(adc2);
    Udp.beginPacket(remoteIP, destPort);
    voltage3.send(Udp);
    Udp.endPacket();
    voltage3.empty();
  #endif

  #ifndef PRODUCTION
    Serial.println("--- end of OSC ---");
  #endif
}
