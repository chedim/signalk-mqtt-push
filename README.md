# Signal K - MQTT Push

Signal K Node server plugin that pushes configured path values onto an MQTT broker.
This fork was created after desperate attempts to connect SignalK to homeassistant via mosquitto using existing plugins which all failed because those plugins either:
- send all deltas onto a single topic
- require requesting deltas by pushing a message onto a special topic before they start sending them
- or use outdated mosca to create local mqtt server that doesn't work with mosquitto bridges
