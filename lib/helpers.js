"use strict";

var http = require("http");
var pathReq = require("path");
var _ = require('lodash');
var winston = require('winston');

module.exports = {

    getLogger: function(path, fileName, logLevel) {

        var logger = new (winston.Logger)({
            transports: [
                new (winston.transports.Console)({ level: logLevel || "info" }),
                new (require("winston-daily-rotate-file"))({
                    filename: pathReq.join(__dirname, "../", (path && fileName ? path + "/" + fileName : "logs/mesos-framework.log")),
                    level: logLevel || "info",
                    prepend: true,
                    json: false
                })
            ]
        });

        return logger;

    },

    cloneDeep: function(obj) {
        return _.cloneDeep(obj);
    },

    sortTasksByPriority: function (tasks) {

        function prioSort(a,b) {
            if (a.priority < b.priority) {
                return -1;
            }
            if (a.priority > b.priority) {
                return 1;
            }
            if (a.name < b.name) {
                return -1;
            }
            return 1;
        }

        var tasksArray = [];

        Object.getOwnPropertyNames(tasks).forEach(function (task) {

            var instances = tasks[task].instances || 1;

            if (tasks[task].resources && tasks[task].resources.staticPorts) {
                tasks[task].resources.staticPorts.sort();
                if (!tasks[task].resources.ports || tasks[task].resources.staticPorts.length > tasks[task].resources.ports) {
                    throw new Error("Static ports must be included in the general port count for the task.");
                }
            }

            // Add to tasks array
            for (var i = 1; i <= instances; i++) {
                // Set defaults
                tasks[task].isSubmitted = false;
                tasks[task].name = task + "-" + i.toString();
                if (!tasks[task].hasOwnProperty("allowScaling")) {
                    tasks[task].allowScaling = false;
                }
                tasksArray.push(_.cloneDeep(tasks[task])); // Important!
            }

        });

        return tasksArray.sort(prioSort);

    },

    doRequest: function (payload, callback) {

        var self = this;

        // Add mesos-stream-id to header
        if (self.mesosStreamId) {
            self.requestTemplate.headers["mesos-stream-id"] = self.mesosStreamId;
        }

        var req = http.request(self.requestTemplate, function (res) {

            // Set encoding
            res.setEncoding('utf8');

            // Buffer for the response body
            var body = "";

            res.on('data', function (chunk) {
                body += chunk;
            });

            // Watch for errors of the response
            res.on('error', function (e) {
                callback({ message: "There was a problem with the response: " + e.message }, null);
            });

            res.on('end', function () {
                if (res.statusCode !== 202) {
                    callback({ message: "Request was not accepted properly. Reponse status code was '" + res.statusCode + "'. Body was '" + body + "'." }, null);
                } else {
                    callback(null, { statusCode: res.statusCode, body: body });
                }
            });

        });

        // Watch for errors of the request
        req.on('error', function (e) {
            callback({ message: "There was a problem with the request: " + e.message }, null);
        });

        // Write data to request body
        req.write(JSON.stringify(payload));

        // End request
        req.end();

    },

    stringifyEnums: function (message) {
        message = _.clone(message); // We should not modify the source message in place, it causes issues with repeating calls
        _.forEach(message.$type.children, function(child) {
            var type = _.get(child, 'element.resolvedType', null);
            if (type && type.className === 'Enum' && type.children) {
                var metaValue = _.find(type.children, {
                    id: message[child.name]
                });
                if (metaValue && metaValue.name)
                // Alternatively you can do something like:
                // message[child.name + '_string'] = metaValue.name;
                // To get access to both the raw value and the string.
                    message[child.name] = metaValue.name;
            }
        });
        return message;
    },

    fixEnums: function (message) {
        var self = this;
        var newMessage = self.stringifyEnums(message);
        _.forEach(message, function(subMessage, key) {
            if (_.isObject(subMessage) && subMessage.$type) {
                newMessage[key] = self.fixEnums(message[key]);
            } else if (_.isArray(subMessage) && subMessage.length > 0) {
                var arrayItems = [];
                var index;
                for (index = 0; index < subMessage.length; index += 1) {
                    if (_.isObject(subMessage[index]) && subMessage[index].$type) {
                        arrayItems.push(self.fixEnums(subMessage[index]));
                    } else {
                        arrayItems.push(subMessage[index]);
                    }
                }
                newMessage[key] = arrayItems;
            }
        });
        return newMessage;
    },

    isFunction: function(obj) {
        return !!(obj && obj.constructor && obj.call && obj.apply);
    }

};