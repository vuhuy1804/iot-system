#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <DHT.h>
#include <BH1750.h>

const char *ssid = "huy";
const char *password = "89898989";
const char *mqtt_server = "172.19.70.24";
const int mqtt_port = 1880;
const char *mqtt_user = "vuhuy";
const char *mqtt_pass = "12345";

#define DHTPIN 4
#define DHTTYPE DHT11
#define LED1_PIN 5
#define LED2_PIN 18
#define LED3_PIN 19 // LED 3 cảnh báo tốc độ gió (cắm chân D19)

DHT dht(DHTPIN, DHTTYPE);
BH1750 lightMeter;
WiFiClient espClient;
PubSubClient client(espClient);

unsigned long lastMsg = 0;
unsigned long lastBlink = 0;
bool led3State = false;
float currentWindSpeed = 0.0;

void setup_wifi()
{
    delay(10);
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED)
    {
        delay(500);
    }
}

void callback(char *topic, byte *payload, unsigned int length)
{
    String message;
    for (int i = 0; i < length; i++)
    {
        message += (char)payload[i];
    }

    if (message.equalsIgnoreCase("led1:on"))
    {
        digitalWrite(LED1_PIN, HIGH);
        client.publish("device/status", "LED1: ON");
    }
    else if (message.equalsIgnoreCase("led1:off"))
    {
        digitalWrite(LED1_PIN, LOW);
        client.publish("device/status", "LED1: OFF");
    }
    else if (message.equalsIgnoreCase("led2:on"))
    {
        digitalWrite(LED2_PIN, HIGH);
        client.publish("device/status", "LED2: ON");
    }
    else if (message.equalsIgnoreCase("led2:off"))
    {
        digitalWrite(LED2_PIN, LOW);
        client.publish("device/status", "LED2: OFF");
    }
}

void reconnect()
{
    while (!client.connected())
    {
        String clientId = "ESP32Client-";
        clientId += String(random(0xffff), HEX);
        if (client.connect(clientId.c_str(), mqtt_user, mqtt_pass))
        {
            client.subscribe("device/control");
        }
        else
        {
            delay(5000);
        }
    }
}

void setup()
{
    Serial.begin(115200);
    pinMode(LED1_PIN, OUTPUT);
    pinMode(LED2_PIN, OUTPUT);
    pinMode(LED3_PIN, OUTPUT);

    digitalWrite(LED1_PIN, LOW);
    digitalWrite(LED2_PIN, LOW);
    digitalWrite(LED3_PIN, LOW);

    pinMode(26, OUTPUT);
    digitalWrite(26, LOW);
    Wire.begin(27, 14);

    lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE);
    dht.begin();

    setup_wifi();
    client.setServer(mqtt_server, mqtt_port);
    client.setCallback(callback);
    randomSeed(analogRead(0));
}

void loop()
{
    if (!client.connected())
        reconnect();
    client.loop();

    unsigned long now = millis();

    // XỬ LÝ NHẤP NHÁY LED 3 NẾU WIND_SPEED > 300 m/s
    if (currentWindSpeed > 300.0)
    {
        if (now - lastBlink > 250)
        { // Đổi trạng thái mỗi 250ms
            lastBlink = now;
            led3State = !led3State;
            digitalWrite(LED3_PIN, led3State ? HIGH : LOW);
        }
    }
    else
    {
        digitalWrite(LED3_PIN, LOW);
    }

    // GỬI DỮ LIỆU CẢM BIẾN MỖI 2 GIÂY
    if (now - lastMsg > 2000)
    {
        lastMsg = now;

        float temp = dht.readTemperature();
        float hum = dht.readHumidity();
        float lux = lightMeter.readLightLevel();

        // Sinh giá trị giả lập wind_speed ngẫu nhiên từ 0.0 đến 500.0 m/s
        currentWindSpeed = random(0, 5000) / 10.0;

        if (!isnan(temp) && !isnan(hum))
        {
            char payload[160];
            snprintf(payload, sizeof(payload),
                     "{\"temp\":%.1f, \"hum\":%.1f, \"lux\":%.1f, \"wind_speed\":%.1f}",
                     temp, hum, lux, currentWindSpeed);

            client.publish("sensor/data", payload);
        }
    }
}