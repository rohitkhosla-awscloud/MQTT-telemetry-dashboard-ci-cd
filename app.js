const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mqtt = require('mqtt');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
// Public static assets
app.use(express.static(path.join(__dirname, 'public')));

// MQTT Broker Configuration (Default: Public HiveMQ TCP Broker)
const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://broker.hivemq.com:1883';
const MQTT_TOPIC = process.env.MQTT_TOPIC || 'factory/telemetry/sensor1';

console.log(`Connecting to MQTT broker at ${MQTT_BROKER}...`);
const mqttClient = mqtt.connect(MQTT_BROKER, {
  reconnectPeriod: 2000,
  connectTimeout: 30 * 1000,
});
mqttClient.on('connect', () => {
  console.log(`Connected to MQTT broker. Subscribing to: ${MQTT_TOPIC}`);
  mqttClient.subscribe(MQTT_TOPIC, (err) => {
    if (err) console.error('Subscription error:', err);
  });
});

mqttClient.on('message', (topic, message) => {
  const payloadString = message.toString();
  let parsedData;

  try {
    parsedData = JSON.parse(payloadString);
  } catch (e) {
    parsedData = { raw: payloadString, timestamp: new Date().toISOString() };
  }

  // Broadcast received MQTT packet to all connected web clients
  io.emit('sensor-update', {
    topic: topic,
    data: parsedData,
    receivedAt: new Date().toLocaleTimeString()
  });
});

mqttClient.on('error', (err) => {
  console.error('MQTT Client Error:', err.message);
});

// WebSocket connection lifecycle
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  socket.emit('status', { broker: MQTT_BROKER, topic: MQTT_TOPIC, status: 'CONNECTED' });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Dashboard server running at http://0.0.0.0:${PORT}`);
});