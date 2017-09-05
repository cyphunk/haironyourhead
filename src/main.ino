//******************************************************************************
#define FIRMWARE_VERSION 1.1  //MAJOR.MINOR more info on: http://semver.org
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

void setup()
{
#ifndef PRODUCTION
  Serial.begin(SERIAL_SPEED);
  // compiling info
  Serial.println("\r\n--------------------------------"); //NOTE \r\n - new line, return
  Serial.print("Project: "); Serial.println(PROJECT);
  Serial.print("Version: "); Serial.print(FIRMWARE_VERSION); Serial.println(" by Grzegorz Zajac");
  Serial.println("Compiled: " __DATE__ ", " __TIME__ ", " __VERSION__);
  Serial.println("---------------------------------");
  Serial.println("ESP Info: ");
  Serial.print( F("Heap: ") ); Serial.println(system_get_free_heap_size()); //IDEA add code size and free ram info
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

//---------------------------- WiFi --------------------------------------------
WiFi.mode(WIFI_STA);  // https://www.arduino.cc/en/Reference/WiFiConfig
IPAddress ip(192,168,188,UNIT_ID); //ip address of the unit
// ---------------------------------------------------------------------------
IPAddress gateway(192,168,188,1);
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
char buf[30]; buf[0] = {0};
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
});
ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
#ifndef PRODUCTION // Not in PRODUCTION
  Serial.printf("Progress: %u%%\r", (progress / (total / 100)));
#endif
});
ArduinoOTA.onError([](ota_error_t error) {
#ifndef PRODUCTION // Not in PRODUCTION
  Serial.printf("Error[%u]: ", error);
  if (error == OTA_AUTH_ERROR) Serial.println("Auth Failed");
  else if (error == OTA_BEGIN_ERROR) Serial.println("Begin Failed");
  else if (error == OTA_CONNECT_ERROR) Serial.println("Connect Failed");
  else if (error == OTA_RECEIVE_ERROR) Serial.println("Receive Failed");
  else if (error == OTA_END_ERROR) Serial.println("End Failed");
#endif
});
ArduinoOTA.begin();
#ifndef PRODUCTION // Not in PRODUCTION
  Serial.print("IP address: "); Serial.println(WiFi.localIP());
#endif
}

void loop() {
  ArduinoOTA.handle();
}
