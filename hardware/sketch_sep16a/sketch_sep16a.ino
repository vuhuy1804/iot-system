#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <DHT.h>
#include <BH1750.h>

// 1. CHỈNH SỬA THÔNG TIN WI-FI VÀ MQTT BROKER TẠI ĐÂY
const char* ssid        = "huy";
const char* password    = "89898989";
const char* mqtt_server = "172.19.70.24"; // Thay bằng IP máy tính
const int   mqtt_port   = 1880;
const char* mqtt_user   = "vuhuy";
const char* mqtt_pass   = "12345";

// 2. CẤU HÌNH CHÂN LINH KIỆN
#define DHTPIN 4          // DHT11 cắm chân D4
#define DHTTYPE DHT11
#define LED1_PIN 5        // LED 1 cắm chân D5
#define LED2_PIN 18       // LED 2 cắm chân D18

DHT dht(DHTPIN, DHTTYPE);
BH1750 lightMeter;
WiFiClient espClient;
PubSubClient client(espClient);

unsigned long lastMsg = 0;

void setup_wifi() {
  delay(10);
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected! IP address: ");
  Serial.println(WiFi.localIP());
}

// Hàm nhận dữ liệu (Subscribed) từ Mosquitto Broker gửi về ESP32
void callback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.print("[MQTT RECEIVED] Topic: ");
  Serial.print(topic);
  Serial.print(" | Message: ");
  Serial.println(message);

  // 1. XỬ LÝ LỆNH ĐIỀU KHIỂN LED 1 (D5)
  if (message.equalsIgnoreCase("led1:on")) {
    digitalWrite(LED1_PIN, HIGH);
    
    if (digitalRead(LED1_PIN) == HIGH) {
      Serial.println("-> Kich hoat D5 thanh cong: LED1: ON");
      client.publish("device/status", "LED1: ON");
    } else {
      Serial.println("-> KICH HOAT D5 THAT BAI: LED1: OFF");
      client.publish("device/status", "LED1: OFF");
    }
  } 
  else if (message.equalsIgnoreCase("led1:off")) {
    digitalWrite(LED1_PIN, LOW);
    
    if (digitalRead(LED1_PIN) == LOW) {
      Serial.println("-> Tat D5 thanh cong: LED1: OFF");
      client.publish("device/status", "LED1: OFF");
    } else {
      Serial.println("-> TAT D5 THAT BAI: LED1: ON");
      client.publish("device/status", "LED1: ON");
    }
  }
  
  // 2. XỬ LÝ LỆNH ĐIỀU KHIỂN LED 2 (D18)
  else if (message.equalsIgnoreCase("led2:on")) {
    digitalWrite(LED2_PIN, HIGH);
    
    if (digitalRead(LED2_PIN) == HIGH) {
      Serial.println("-> Kich hoat D18 thanh cong: LED2: ON");
      client.publish("device/status", "LED2: ON");
    } else {
      Serial.println("-> KICH HOAT D18 THAT BAI: LED2: OFF");
      client.publish("device/status", "LED2: OFF");
    }
  } 
  else if (message.equalsIgnoreCase("led2:off")) {
    digitalWrite(LED2_PIN, LOW);
    
    if (digitalRead(LED2_PIN) == LOW) {
      Serial.println("-> Tat D18 thanh cong: LED2: OFF");
      client.publish("device/status", "LED2: OFF");
    } else {
      Serial.println("-> TAT D18 THAT BAI: LED2: ON");
      client.publish("device/status", "LED2: ON");
    }
  }

  // 3. XỬ LÝ LỆNH ĐIỀU KHIỂN ĐỒNG THỜI CẢ 2 LED (LED ALL)
  else if (message.equalsIgnoreCase("ledall:on")) {
    digitalWrite(LED1_PIN, HIGH);
    digitalWrite(LED2_PIN, HIGH);
    
    bool led1_status = (digitalRead(LED1_PIN) == HIGH);
    bool led2_status = (digitalRead(LED2_PIN) == HIGH);

    if (led1_status && led2_status) {
      Serial.println("-> Kich hoat D5 va D18 thanh cong: LED_ALL: ON");
      client.publish("device/status", "LED_ALL: ON");
    } else {
      Serial.println("-> KICH HOAT LED_ALL THAT BAI!");
      client.publish("device/status", "LED_ALL: ERROR");
    }
  }
  else if (message.equalsIgnoreCase("ledall:off")) {
    digitalWrite(LED1_PIN, LOW);
    digitalWrite(LED2_PIN, LOW);
    
    bool led1_status = (digitalRead(LED1_PIN) == LOW);
    bool led2_status = (digitalRead(LED2_PIN) == LOW);

    if (led1_status && led2_status) {
      Serial.println("-> Tat D5 va D18 thanh cong: LED_ALL: OFF");
      client.publish("device/status", "LED_ALL: OFF");
    } else {
      Serial.println("-> TAT LED_ALL THAT BAI!");
      client.publish("device/status", "LED_ALL: ERROR");
    }
  }
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    // Khởi tạo kết nối với ClientID ngẫu nhiên
    String clientId = "ESP32Client-";
    clientId += String(random(0xffff), HEX);

    if (client.connect(clientId.c_str(), mqtt_user, mqtt_pass)) {
      Serial.println("CONNECTED!");
      // Lắng nghe lệnh trên Topic "device/control"
      client.subscribe("device/control");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  
  pinMode(LED1_PIN, OUTPUT);
  pinMode(LED2_PIN, OUTPUT);
  digitalWrite(LED1_PIN, LOW);
  digitalWrite(LED2_PIN, LOW);

  // Cấu hình I2C cho BH1750
  pinMode(26, OUTPUT);
  digitalWrite(26, LOW); // ADDR cắm D26 -> LOW
  Wire.begin(27, 14);     // SDA = D27, SCL = D14
  
  lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE);
  dht.begin();

  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  // Đọc và bắn (Publish) dữ liệu cảm biến lên Topic "sensor/data" mỗi 2 giây
  unsigned long now = millis();
  if (now - lastMsg > 2000) {
    lastMsg = now;

    float temp = dht.readTemperature();
    float hum = dht.readHumidity();
    float lux = lightMeter.readLightLevel();

    if (!isnan(temp) && !isnan(hum)) {
      char payload[128];
      snprintf(payload, sizeof(payload), "{\"temp\":%.1f, \"hum\":%.1f, \"lux\":%.1f}", temp, hum, lux);

      Serial.print("[MQTT PUBLISH] ");
      Serial.println(payload);
      
      // Gửi chuỗi JSON dữ liệu lên Topic "sensor/data"
      client.publish("sensor/data", payload);
    }
  }
}