//******************************************************************************
#define FIRMWARE_VERSION 1.97   //MAJOR.MINOR more info on: http://semver.org
#define SERIAL_SPEED 9600       // 9600 for BLE friend
#define SERIAL_DEBUG true       //coment to turn the serial debuging off
#define SERIAL_PLOTTER true     // for isolating Arduino IDE serial ploter
#define HOSTNAME "monitor"      // something like: monitor211, to ping or upload firmware over OTA use monitor211.local
//#define GSR                   // uncomment for version with additional GSR (HR stays on ESPs ADC)
//#define NEOPIXEL
#define ONBOARDLED              //ESP build in blue led
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
// OSC IP and port settings in credentials.h
WiFiUDP Udp;
OSCErrorCode error;

int report_interval = 3000;      //OSC report inerval 3 secs
int measurment_interval = 10;       //AD measurment inerval
unsigned long previousMillisReport = 0;
unsigned long previousMillisMeasurment = 0;
unsigned long currentMillisReport, currentMillisMeasurment, runningTime;

#ifdef NEOPIXEL
  #include <FastLED.h>
  #define NUM_LEDS 1
  #define DATA_PIN D1 //   pin for neopixel
  CRGB leds[NUM_LEDS];
#endif
#ifdef ONBOARDLED
  #define BUILD_IN_LED 02
#endif

#ifdef GSR
  #include <Wire.h>
  #include <Adafruit_ADS1015.h>
  Adafruit_ADS1115 ads;  /* Use this for the 16-bit version */
  float ADresolution = 0;
#endif

// normalize function variables
long sliding_min = -1;
long sliding_max = -1;
unsigned int step = 1;

//OSC message headers
char osc_header_report[8];
char osc_header_hr[8];
#ifdef GSR
  char osc_header_gsr[8];
#endif

void setup()
{
#ifdef SERIAL_DEBUG
  Serial.begin(SERIAL_SPEED);
  Serial.println("\r\n--------------------------------");        // compiling info
  Serial.print("HR&GSR Ver: "); Serial.println(FIRMWARE_VERSION);
  Serial.println("by Grzegorz Zajac and Nathan Andrew Fain");
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

#ifdef ONBOARDLED
  pinMode(BUILD_IN_LED, OUTPUT);
  digitalWrite(BUILD_IN_LED,HIGH); //off by default
#endif

//---------------------------- WiFi --------------------------------------------
WiFi.mode(WIFI_STA);  // https://www.arduino.cc/en/Reference/WiFiConfig
// WiFi.config(ip, gateway, subnet);  //uncomment for fixed ip address, needs to be defined in credentials.h file

#ifdef SERIAL_DEBUG
  Serial.print("unit MAC address: "); Serial.println(WiFi.macAddress());
  Serial.print("Connecting to ");   Serial.print(ssid); Serial.println(" with DHCP");
#endif

WiFi.begin(ssid, password);                                                     //TODO check reconnecting when lost wifi

while (WiFi.waitForConnectResult() != WL_CONNECTED) {
#ifdef SERIAL_DEBUG
  Serial.println("Connection Failed! Rebooting...");
#endif
  delay(8000);
  ESP.restart();
}

#ifdef SERIAL_DEBUG
  Serial.print("assigned IP address: "); Serial.println(WiFi.localIP());
#endif
// ------------------------- OSC headers ---------------------------------------
osc_header_report[0] = {0};  //reset buffor, start with a null string
snprintf(osc_header_report, 8,"/%d", WiFi.localIP()[3]);
osc_header_hr[0] = {0}; //reset buffor, start with a null string
snprintf(osc_header_hr, 8, "/%d/hr", WiFi.localIP()[3]);
#ifdef GSR
  osc_header_gsr[0] = {0}; //reset buffor, start with a null string
  snprintf(osc_header_gsr, 8, "/%d/gsr", WiFi.localIP()[3]);
#endif

#ifdef SERIAL_DEBUG
  Serial.print("osc report header: "); Serial.println(osc_header_report);
  Serial.print("osc hr header: "); Serial.println(osc_header_hr);
  #ifdef GSR
    Serial.print("osc gsr header: "); Serial.println(osc_header_gsr);
  #endif
#endif

// --------------------------- OTA ---------------------------------------------
char buf[30]; buf[0] = {0};
snprintf(buf, 30, "%s%i", HOSTNAME, WiFi.localIP()[3]);
ArduinoOTA.setHostname(buf);
#ifdef SERIAL_DEBUG
  Serial.print("Hostname: "); Serial.println(buf);
#endif

ArduinoOTA.onStart([]() {
  #ifdef SERIAL_DEBUG
    Serial.println("Start updating ");
  #endif
});

ArduinoOTA.onEnd([]() {
#ifdef SERIAL_DEBUG
  Serial.println("\nEnd");
#endif
#ifdef NEOPIXEL
  FastLED.showColor(CHSV(HUE_ORANGE, 255, 200));
#endif

});
ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
#ifdef SERIAL_DEBUG
  Serial.printf("Progress: %u%%\r", (progress / (total / 100)));
#endif
#ifdef NEOPIXEL   //ota uploading indicator
  FastLED.showColor(CHSV(HUE_BLUE, 255, 100));
  delay(1);
  FastLED.showColor(CHSV(HUE_BLUE, 255, 0));
#endif
#ifdef ONBOARDLED
  digitalWrite(BUILD_IN_LED, LOW); delay(1); digitalWrite(BUILD_IN_LED, HIGH);  //flash when uploading
#endif
});
ArduinoOTA.onError([](ota_error_t error) {
#ifdef SERIAL_DEBUG
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

//-------------------------- External ADc --------------------------------------
#ifdef GSR
  #ifdef SERIAL_DEBUG
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

#ifdef ONBOARDLED    //turn led on if connected
digitalWrite(BUILD_IN_LED, LOW);
#endif

}

void loop() {
  ArduinoOTA.handle();
  OSCMsgReceive();

  currentMillisMeasurment = millis();
  if (currentMillisMeasurment - previousMillisMeasurment >= (measurment_interval)) {
    previousMillisMeasurment = currentMillisMeasurment;
    AD2OSC();
  }

  currentMillisReport = millis();
  if (currentMillisReport - previousMillisReport >= (report_interval)) {
    previousMillisReport = currentMillisReport;
    sendReport();                                                               //TODO send report to diffrent port or IP, separate from server
  }
}

void AD2OSC(){
  int adc_int;       //internal ESP ADC
  adc_int = normalize(0, 1024, analogRead(A0));

  #ifdef SERIAL_DEBUG
    #ifdef SERIAL_PLOTTER  //for Arduino IDE serial ploter
    Serial.print(adc_int); Serial.print(",");
    Serial.print(sliding_min); Serial.print(",");
    Serial.println(sliding_max);
    #endif
  #endif

  OSCMessage voltage_hr(osc_header_hr);
  voltage_hr.add(adc_int);
  Udp.beginPacket(remoteIP, destPort);
  voltage_hr.send(Udp);
  Udp.endPacket();
  voltage_hr.empty();

  #ifdef GSR
    int adc_ext;    //external ADC ADS1115
    adc_ext = normalize(0, 16384, ads.readADC_SingleEnded(0));                    //TODO calculate resolution for ADS 1015
    OSCMessage voltage_gsr(osc_header_gsr);
    voltage_gsr.add(adc_ext);
    Udp.beginPacket(remoteIP, destPort);
    voltage_gsr.send(Udp);
    Udp.endPacket();
    voltage_gsr.empty();
  #endif
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

void led(OSCMessage &msg) {
  int led_on_off = msg.getInt(0);

  #ifdef ONBOARDLED
    if (led_on_off == 0) digitalWrite(BUILD_IN_LED, HIGH);
    if (led_on_off == 1) digitalWrite(BUILD_IN_LED, LOW);
  #endif
}

void measurment_interval_fn(OSCMessage &msg){
  measurment_interval = msg.getInt(0);
  #ifdef SERIAL_DEBUG
    Serial.print("updated measurment interval: "); Serial.println(measurment_interval);
  #endif
}

void report_interval_fn(OSCMessage &msg){
  report_interval = msg.getInt(0);
  #ifdef SERIAL_DEBUG
    Serial.print("updated report interval: "); Serial.println(report_interval);
  #endif
}

void osc_destination_fn(OSCMessage &msg){
  int ip = msg.getInt(0);
  remoteIP[3] = ip;
  #ifdef SERIAL_DEBUG
    Serial.print("updated destination: "); Serial.println(ip);
  #endif
}

void OSCMsgReceive(){
  OSCMessage msgIN;
  int size;
  if((size = Udp.parsePacket())>0){
    while(size--)
      msgIN.fill(Udp.read());
    if(!msgIN.hasError()){
      msgIN.dispatch("/led", led);
      msgIN.dispatch("/interval", measurment_interval_fn);
      msgIN.dispatch("/report", report_interval_fn);
      msgIN.dispatch("/destination", osc_destination_fn);
    } else {
      error = msgIN.getError();
      #ifdef SERIAL_DEBUG
        Serial.print("error: ");
        Serial.println(error);
      #endif

    }
  }
}

void sendReport(){
  //rssi
  char rssi_ch[32];
  rssi_ch[0] = {0};
  int32_t RSSI = WiFi.RSSI(); //check if rssi is for current network
  strcat(rssi_ch, osc_header_report);
  strcat(rssi_ch, "/rssi");
  OSCMessage rssi(rssi_ch);
  rssi.add(RSSI);
  Udp.beginPacket(remoteIP, destPort);
  rssi.send(Udp);
  Udp.endPacket();
  rssi.empty();

  // running time
  char time_ch[32];
  time_ch[0] = {0};
  unsigned int runningTime = millis()/1000;
  strcat(time_ch, osc_header_report);
  strcat(time_ch, "/time");
  OSCMessage rtime(time_ch);
  rtime.add(runningTime);
  Udp.beginPacket(remoteIP, destPort);
  rtime.send(Udp);
  Udp.endPacket();
  rtime.empty();

  //version
  char ver_ch[16];
  ver_ch[0] = {0};
  strcat(ver_ch, osc_header_report);
  strcat(ver_ch, "/ver");
  OSCMessage ver(ver_ch);
  float Ver = FIRMWARE_VERSION; //silly conversion, Max MSP not happy with direct FIRMWARE_VERSION send
  ver.add(Ver);
  Udp.beginPacket(remoteIP, destPort);
  ver.send(Udp);
  Udp.endPacket();
  ver.empty();

  //channel
  char ch_ch[16];
  ch_ch[0] = {0};
  strcat(ch_ch, osc_header_report);
  strcat(ch_ch, "/channel");
  OSCMessage channel(ch_ch);
  channel.add(WiFi.channel());
  Udp.beginPacket(remoteIP, destPort);
  channel.send(Udp);
  Udp.endPacket();
  channel.empty();

  #ifdef GSR
    float adc2;
    adc2 = ((ads.readADC_SingleEnded(2) * ADresolution)/1000);
    char volt_ch3[8];
    volt_ch3[0] = {0}; //reset buffor
    strcat(volt_ch3, osc_header_report);
    strcat(volt_ch3, "/lipo"); //build OSC message with unit ID
    OSCMessage voltage3(volt_ch3);
    voltage3.add(adc2);
    Udp.beginPacket(remoteIP, destPort);
    voltage3.send(Udp);
    Udp.endPacket();
    voltage3.empty();
  #endif
}
