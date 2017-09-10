//******************************************************************************
#define FIRMWARE_VERSION 1.4  //MAJOR.MINOR more info on: http://semver.org
#define PROJECT "health_monitor"
#define SERIAL_SPEED 9600       // 9600 for BLE friend
#define HOSTNAME "monitor"
#define UNIT_ID 111             //last octet of IP
//#define PRODUCTION true       //uncoment to turn the serial debuging off
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
#include <OSCBundle.h>
#include <OSCData.h>

WiFiUDP Udp;
OSCErrorCode error;
const IPAddress remoteIP(192,168,188,255);        // remote IP of your computer, 255 to multicast
const unsigned int destPort = 9999;          // remote port to receive OSC
const unsigned int localPort = 8888;        // local port to listen for OSC packets

#define REPORT_INTERVAL 1000 * 5      //OSC report inerval 3 secs
#define MEASURMENT_INTERVAL 50       //AD measurment inerval
unsigned long previousMillisReport = 0;
unsigned long previousMillisMeasurment = 0;
unsigned long currentMillisReport, currentMillisMeasurment, runningTime;

char oscMsgHeader[16];    //OSC message header updated with unit ID

#include <FastLED.h>
#define NUM_LEDS 1
#define DATA_PIN 14 //D5    pin for neopixel
CRGB leds[NUM_LEDS];

#include <Wire.h>
#include <Adafruit_ADS1015.h>
Adafruit_ADS1115 ads;  /* Use this for the 16-bit version */
float ADresolution = 0;

void setup()
{
// generate string based on UNIT_ID
sprintf(oscMsgHeader, "/%i", UNIT_ID);   // for sending OSC messages: /xxx/message value

#ifndef PRODUCTION
  Serial.begin(SERIAL_SPEED);
  // compiling info
  Serial.println("\r\n--------------------------------");
  Serial.print("Project: "); Serial.println(PROJECT);
  Serial.print("Version: "); Serial.print(FIRMWARE_VERSION); Serial.println(" by Grzegorz Zajac");
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

// initialize neopixel
FastLED.addLeds<NEOPIXEL, DATA_PIN>(leds, NUM_LEDS);
leds[0] = CRGB( 0, 10, 0); FastLED.show();

//---------------------------- WiFi --------------------------------------------
WiFi.mode(WIFI_STA);  // https://www.arduino.cc/en/Reference/WiFiConfig
IPAddress ip(192,168,188,UNIT_ID); //ip address of the unit
// ---------------------------------------------------------------------------
IPAddress gateway(192,168,188,1);                                                //TODO move netowrk data to creditential, ip addres?
IPAddress subnet(255,255,255,0);
WiFi.config(ip, gateway, subnet);

#ifndef PRODUCTION // Not in PRODUCTION
  Serial.print("Connecting to ");
  Serial.println(ssid);
#endif
WiFi.begin(ssid, password);

while (WiFi.waitForConnectResult() != WL_CONNECTED) {
#ifndef PRODUCTION // Not in PRODUCTION
  Serial.println("Connection Failed! Rebooting...");
#endif
  delay(5000);
  ESP.restart();
}

// --------------------------- OTA ---------------------------------------------
char buf[30]; buf[0] = {0};                                                     //TODO tidy up
char id[4]; id[0] = {0};
strcat(buf, HOSTNAME);
sprintf(id, "_%i", UNIT_ID);
strcat(buf,id);
ArduinoOTA.setHostname(buf);
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
leds[0] = CRGB(0, 0, 30); FastLED.show();

});
ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
#ifndef PRODUCTION // Not in PRODUCTION
  Serial.printf("Progress: %u%%\r", (progress / (total / 100)));
#endif
leds[0] = CRGB(0, 0, 10); FastLED.show();
delay(1);
leds[0] = CRGB(0, 0, 0); FastLED.show();


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

#ifndef PRODUCTION // Not in PRODUCTION
  Serial.print("IP address: "); Serial.println(WiFi.localIP());
#endif

//------------------------------ ADc -------------------------------------------
#ifndef PRODUCTION // Not in PRODUCTION
  Serial.println("Getting single-ended readings from AIN0..3");
  Serial.println("ADC Range: +/- 6.144V (1 bit = 3mV/ADS1015, 0.1875mV/ADS1115)");
#endif
//                                                                ADS1015  ADS1115
//                                                                -------  -------
ads.setGain(GAIN_TWOTHIRDS);      // 2/3x gain +/- 6.144V  1 bit = 3mV      0.1875mV (default)
ADresolution = 0.1875;
// ads.setGain(GAIN_ONE);        // 1x gain   +/- 4.096V  1 bit = 2mV      0.125mV
// ads.setGain(GAIN_TWO);        // 2x gain   +/- 2.048V  1 bit = 1mV      0.0625mV
// ads.setGain(GAIN_FOUR);       // 4x gain   +/- 1.024V  1 bit = 0.5mV    0.03125mV
// ads.setGain(GAIN_EIGHT);      // 8x gain   +/- 0.512V  1 bit = 0.25mV   0.015625mV
// ads.setGain(GAIN_SIXTEEN);    // 16x gain  +/- 0.256V  1 bit = 0.125mV  0.0078125mV
ads.begin();



leds[0] = CRGB(10, 0, 0); FastLED.show();
delay(500);
leds[0] = CRGB(0, 0, 0); FastLED.show();
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
    sendReport();
  }
}

void AD2OSC(){
  float adc0, adc1, adc2, adc3;
  adc0 = ((ads.readADC_SingleEnded(0) * ADresolution)/1000);  //get results in V
  adc1 = ((ads.readADC_SingleEnded(1) * ADresolution)/1000);
  adc2 = ((ads.readADC_SingleEnded(2) * ADresolution)/1000);
  adc3 = ((ads.readADC_SingleEnded(3) * ADresolution)/1000);
  // #ifndef PRODUCTION // Not in PRODUCTION
  //   Serial.print("AIN0: "); Serial.println(adc0);
  //   Serial.print("AIN1: "); Serial.println(adc1);
  //   Serial.print("AIN2: "); Serial.println(adc2);
  //   Serial.print("AIN3: "); Serial.println(adc3);
  //   Serial.println(" ");
  // #endif
  char volt_ch1[8];
  volt_ch1[0] = {0}; //reset buffor
  strcat(volt_ch1, oscMsgHeader);
  strcat(volt_ch1, "/voltage1"); //build OSC message with unit ID
  OSCMessage voltage1(volt_ch1);
  voltage1.add(adc0);
  Udp.beginPacket(remoteIP, destPort);
  voltage1.send(Udp);
  Udp.endPacket();
  voltage1.empty();

  char volt_ch2[8];
  volt_ch2[0] = {0}; //reset buffor
  strcat(volt_ch2, oscMsgHeader);
  strcat(volt_ch2, "/voltage2"); //build OSC message with unit ID
  OSCMessage voltage2(volt_ch2);
  voltage2.add(adc1);
  Udp.beginPacket(remoteIP, destPort);
  voltage2.send(Udp);
  Udp.endPacket();
  voltage2.empty();
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

void led(OSCMessage &msg, int addrOffset) {
  int R = msg.getInt(0);
  int G = msg.getInt(1);
  int B = msg.getInt(2);

  #ifndef PRODUCTION
    Serial.print("RGB received:");
    Serial.print(" "); Serial.print(R);
    Serial.print(" "); Serial.print(G);
    Serial.print(" "); Serial.println(B);
  #endif

  leds[0] = CRGB(R, G, B);//CRGB::Red;
  FastLED.show();
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

  //time
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
  rssi.send(Udp);
  Udp.endPacket();
  rssi.empty();

  Udp.beginPacket(remoteIP, destPort);
  rtime.send(Udp);
  Udp.endPacket();
  rtime.empty();

  Udp.beginPacket(remoteIP, destPort);
  ver.send(Udp);
  Udp.endPacket();
  ver.empty();

  Udp.beginPacket(remoteIP, destPort);
  channel.send(Udp);
  Udp.endPacket();
  channel.empty();

  #ifndef PRODUCTION
    Serial.println("--- end of OSC ---");
  #endif
}
