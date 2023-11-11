/*
 * Copyright 2016 Teppo Kurki <teppo.kurki@iki.fi>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
*/

const id = 'signalk-mqtt-push';
const debug = require('debug')(id);
const mqtt = require('mqtt');
const NeDBStore = require('mqtt-nedb-store');

module.exports = function(app) {
  var plugin = {
    unsubscribes: [],
  };
  var server

  plugin.id = id;
  plugin.name = 'Signal K - MQTT Push';
  plugin.description =
    'plugin that pushes selected paths to mqtt broker';

  plugin.schema = {
    title: 'Signal K - MQTT Push',
    type: 'object',
    required: ['remoteHost'],
    properties: {
      remoteHost: {
        type: 'string',
        title: 'MQTT server Url (starts with mqtt/mqtts)',
        description:
          'MQTT server that the paths listed below should be sent to',
        default: 'mqtt://somehost',
      },
      username: {
        type: "string",
        title: "MQTT server username"
      },
      password: {
        type: "string",
        title: "MQTT server password"
      },
      rejectUnauthorized: {
        type: "boolean",
        default: false,
        title: "Reject self signed and invalid server certificates"
      },
      paths: {
        type: 'array',
        title: 'Signal K self paths to send',
        default: [{ path: 'navigation.position', interval: 60 }],
        items: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              title: 'Path',
            },
            interval: {
              type: 'number',
              title:
                'Minimum interval between updates for this path to be sent to the server',
            },
          },
        },
      },
    },
  };

  var started = false;
  var ad;

  plugin.onStop = [];

  plugin.start = function(options) {
    plugin.onStop = [];

    const manager = NeDBStore(app.getDataDirPath());
    const client = mqtt.connect(options.remoteHost, {
      rejectUnauthorized: options.rejectUnauthorized,
      clientId: app.selfId,
      outgoingStore: manager.outgoing,
      username: options.username,
      password: options.password,
      will: {
        topic: 'signalk/will',
        payload: 'signalk disconnected'
      }
    });
    client.on('error', (err) => console.error(err))
    client.on("connect", () => {
      console.info("Connected to MQTT broker, starting sending messages")
      startSending(options, client, plugin.onStop)
    });
    client.on("disconnect", () => {
      console.warn("Disconnected from MQTT broker, reconnecting")
      plugin.start(options)
    })
    plugin.onStop.push(_ => client.end());
    started = true;
  };

  plugin.stop = function() {
    plugin.onStop.forEach(f => f());
  };

  return plugin;

  function startSending(options, client, onStop) {
    options.paths.forEach(pathInterval => {
      onStop.push(
        app.streambundle
          .getSelfBus(pathInterval.path)
          .debounceImmediate(pathInterval.interval * 1000)
          .onValue(normalizedPathValue =>
            client.publish(
              'signalk/delta/' + pathInterval.path,
              JSON.stringify({
                context: 'vessels.' + app.selfId,
                updates: [
                  {
                    timestamp: normalizedPathValue.timestamp,
                    $source: normalizedPathValue.$source,
                    values: [
                      {
                        path: pathInterval.path,
                        value: normalizedPathValue.value,
                      },
                    ],
                  },
                ],
              }),
              { qos: 1 }
            )
          )
      );
    });
  }
};
