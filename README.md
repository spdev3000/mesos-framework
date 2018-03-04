# mesos-framework

[![Package version](https://img.shields.io/npm/v/mesos-framework.svg)](https://www.npmjs.com/package/mesos-framework) [![Package downloads](https://img.shields.io/npm/dt/mesos-framework.svg)](https://www.npmjs.com/package/mesos-framework) [![Package license](https://img.shields.io/npm/l/mesos-framework.svg)](https://www.npmjs.com/package/mesos-framework) [![Build Status](https://travis-ci.org/tobilg/mesos-framework.svg?branch=master)](https://travis-ci.org/tobilg/mesos-framework)

This project provides a high-level wrapper around the Mesos HTTP APIs for [schedulers](http://mesos.apache.org/documentation/latest/scheduler-http-api/) and [executors](http://mesos.apache.org/documentation/latest/executor-http-api/).
It can be used to write Mesos frameworks in pure JavaScript. The currently supported Mesos version is `1.5.0`.

## Installation

You can use `mesos-framework` in your own projects by running

    npm i mesos-framework --save
    
## Local test environment

`docker-compose` can be used for setting up a local test environment. Just run 

```bash
$ docker-compose up -d
```

in the base directory of this project.

## Documentation

The `mesos-framework` project is not a Mesos framework itself, but can be imagined as a "framework-framework" (or meta framework), meaning that it provides a certain abstraction around the HTTP APIs for schedulers and executors, together with some convenience methods.
 
It implements all existing `Calls` as methods for both the `Scheduler` and `Executor` classes, meaning that they can be used without having to write the HTTP communication yourself. Additionally, it exposes all `Events` for both classes, as definied in the Mesos docs. It also adds some custom events for the `Scheduler` class for better task handling.   

There are some basic event handler methods provided for the `Scheduler` class, which for example take care of the checking and accepting the offers received from the Mesos master, as well as keeping track of tasks. Please have a look at the class documentation in the `docs` folder of this project.

For both the `Scheduler` and `Executor` classes, the belonging event handler methods can be overwritten with custom logic. To do that, you can supply a `options.handlers` property map object (where the property name is the uppercase `Event` name) when instantiating a class:

```javascript
var scheduler = new Scheduler({
    ...
    "handlers": {
        "HEARTBEAT": function (timestamp) {
            console.log("CUSTOM HEARTBEAT!");
            this.lastHeartbeat = timestamp;
        }
    }
});
```

Basically this is the mechanism to create custom framework logic. Please have a look at the `examples` folder to see examples for command-based and Docker-based schedulers.

#### API docs

The API docs can be accessed via [API docs](http://tobilg.github.io/mesos-framework/) hosted on GitHub pages.

#### Coverage reports

The [Coverage Reports](http://tobilg.github.io/mesos-framework/coverage/) are hosted on GitHub pages as well.

### Scheduler

The `Scheduler` is the "heart" of a Mesos framework. It is very well possible to create a Mesos framework only by implementing the `Scheduler` with the standard [CommandInfo](https://github.com/apache/mesos/blob/1.5.x/include/mesos/v1/mesos.proto#L647) and [ContainerInfo](https://github.com/apache/mesos/blob/1.5.x/include/mesos/v1/mesos.proto#L1744) objects.

The option properties you can specify to create a `Scheduler` are the following:

* `masterUrl`: The URL of the leading Mesos master (**mandatory**).
* `port`: The port of the leading Mesos master (**mandatory**).
* `useZk`: Should be set to `true` if you want to use ZooKeeper to persist the task information. Default is `false`.
* `zkUrl`: The ZooKeeper connection url. Default is `master.mesos:2181`.
* `zkPrefix`: The prefix of the ZooKeeper node where the data for this framework shall be stored. Default is `/dcos-service-`.
* `user`: The system user name to use (must exist on the agents!). Default is `root`.
* `role`: The Mesos role to use when subscribing to the master. Default is `*`.
* `frameworkName`: The desired framework name (will choose a standard name if not specified). Default is `mesos-framework.` concatented with a unique UUID.
* `restartStates`: An array of [TaskState](https://github.com/apache/mesos/blob/1.5.x/include/mesos/v1/mesos.proto#L1671) objects which should trigger a restart of a task. For example, regularly finished tasks (in state `TASK_FINISHED`) are not restarted by default.
* `masterConnectionTimeout`: The number of seconds to wait before a connection to the leading Mesos master is considered as timed out (default: `10`).
* `frameworkFailoverTimeout`: The number of seconds to wait before a framework is considered as `failed` by the leading Mesos master, which will then terminate the existing tasks/executors (default: `604800`).
* `exponentialBackoffFactor`: The factor in which to increase (multiply) the backoff timer upon re-subscription (default `1.5`).
* `exponentialBackoffMinimum`: The minimal backoff time for re-subscription in seconds (default: `1`).
* `exponentialBackoffMaximum`: The maximum backoff time for re-subscription in seconds (default: `15`).
* `tasks`: An object (map) with the task info (see below). It's possible to create different (prioritized) tasks, e.g. launching different containers with different instance counts. See the [Docker Scheduler example](https://github.com/tobilg/mesos-framework/blob/master/examples/dockerSchedulerBridgeNetworking.js).
* `handlers`: An object containing custom handler functions for the `Scheduler` events, where the property name is the uppercase `Event` name.
* `staticPorts`: A boolean to indicate whether to use fixed ports in the framework or not. Default is `false`.
* `serialNumberedTasks`: A boolean to indicate whether to add a task serial number to the task name launched in mesos (from the framework's prespective there are always serial numbers in use, they are also part of the task IDs), disabling this is useful for service access with a single mesos DNS name. Defaults to `true`.

A `tasks` sub-object can contain objects with task information:

* `instances`: The number of instances (tasks) you want to launch (will be 1 if you don't specify this property).
* `priority`: The priority of which the different tasks shall be launched (lower is better). If none is specified, tasks will be launched based on the task naming.
* `allowScaling`: A boolean value which indicates whether this task permits scaling operations (default: `false`).
* `commandInfo`: A [Mesos.CommandInfo](https://github.com/apache/mesos/blob/1.5.x/include/mesos/v1/mesos.proto#L647) definition (**mandatory**).
* `containerInfo`: A [Mesos.ContainerInfo](https://github.com/apache/mesos/blob/1.5.x/include/mesos/v1/mesos.proto#L3093) definition.
* `executorInfo`: A [Mesos.ExecutorInfo](https://github.com/apache/mesos/blob/1.5.x/include/mesos/v1/mesos.proto#L709) definition.
* `resources`: The object of [Mesos.Resource](https://github.com/apache/mesos/blob/1.5.x/include/mesos/v1/mesos.proto#L1163) types, such as `cpu`, `mem`, `ports` and `disk` (**mandatory**) with an optional fixedPorts number array (included in the general port count).
* `portMappings`: The array of portMapping objects, each containing a numeric `port` value (for container ports), and a `protocol` string (either `tcp` or `udp`). 
* `healthChecks`: A [Mesos.HealthCheck](https://github.com/apache/mesos/blob/1.5.x/include/mesos/v1/mesos.proto#L504) definition.
* `labels`: A [Mesos.Labels](https://github.com/apache/mesos/blob/1.5.x/include/mesos/v1/mesos.proto#L3273) definition.

#### High availability

Currently, `mesos-framework` doesn't support HA setups for the scheduler instances, meaning that you can only run one instance at once. If you run the scheduler application via Marathon, you should be able to make use of the health checks to let them restart the scheduler application once it fails.

You can use ZooKeeper though to be able to recover from scheduler restarts. This is done by setting `useZk` to `true` and specifying a `zkUrl` connection string (optionally, if you don't want to use the default `master.mesos:2181`, which should work inside clusters using Mesos DNS).

`mesos-framework` has support for the detection of the leading master via Mesos DNS. You can use `leader.mesos` as the `masterUrl`, enabling that upon re-registration of the scheduler, the correct master address will be used (Mesos DNS lookup). If you just provided an IP address or a hostname, `mesos-framework` will try to establish a new connection to the given address and look for redirection information (the "leader change" case). If this request times out, there is no way to automatically determine the current leader, so the scheduler stops itsef (the "failed Master" case).

#### Sample framework implementation

See also the example implementation of a framework at [mesos-framework-boilerplate](https://github.com/tobilg/mesos-framework-boilerplate).

#### Events

**Events from Master**  
The following events from the leading Mesos master are exposed:

* `subscribed`: The first event sent by the master when the scheduler sends a `SUBSCRIBE` request on the persistent connection (i.e. the framework was started). Emits an object containing the `frameworkId` and the `mesosStreamId`, this may be emitted multiple times in the lifetime of a framework, as reconnections emit it as well. 
* `offers`: Sent by the master whenever there are new resources that can be offered to the framework. Emits the base object from the Master for this event.
* `inverse_offers`: Sent by the master whenever there are resources requested back from the scheduler. Emits the base object from the Master for this event.
* `rescind`: Sent by the master when a particular offer is no longer valid. Emits the base object from the Master for this event.
* `rescind_inverse_offer`: Sent by the master when a particular inverse offer is no longer valid (e.g., the agent corresponding to the offer has been removed) and hence needs to be rescinded. Emits the base object from the Master for this event.
* `update`: Sent by the master whenever there is a status update that is generated by the executor, agent or master. Emits the base object from the Master for this event.
* `message`: A custom message generated by the executor that is forwarded to the scheduler by the master. Emits an object containing the `agentId`, the `executorId` and the ASCII-encoded `data`. 
* `heartbeat`: This event is periodically sent by the master to inform the scheduler that a connection is alive. Emits the timestamp of the last heartbeat event.
* `failure`: Sent by the master when an agent is removed from the cluster (e.g., failed health checks) or when an executor is terminated. Emits the base object from the Master for this event. 
* `error`: Sent by the master when an asynchronous error event is generated (e.g., a framework is not authorized to subscribe with the given role), or if another error occurred. 

**Events from Scheduler**  
The following events from the Scheduler calls are exposed:

* `ready`: Is emitted when the scheduler is instantiated and ready to subscribe to the Mesos master. Every `scheduler.subscribe()` call should be wrapped by an event handle reacting to this event. See the examples.
* `sent_subscribe`: Is emitted when the scheduler has sent the `SUBSCRIBE` call.
* `sent_accept`: Is emitted when the scheduler has sent an `ACCEPT` call to accept an offer from the Master.
* `sent_decline`: Is emitted when the scheduler has sent a `DECLINE` call to decline an offer from the Master.
* `sent_teardown`: Is emitted when the scheduler has sent the `TEARDOWN` call to stop the framework to the Master.
* `sent_revive`: Is emitted when the scheduler has sent a `REVIVE` call to the Master to remove any/all filters that it has previously set via `ACCEPT` or `DECLINE` calls.
* `sent_kill`: Is emitted when the scheduler has sent a `KILL` call to the Master to kill a specific task.
* `sent_acknowledge`: Is emitted when the scheduler has sent an `ACKNOWLEDGE` call to the Master to acknowledge a status update.
* `sent_shutdown`: Is emitted when the scheduler has sent a `SHUTDOWN` call to the Master to shutdown a specific custom executor.
* `sent_reconcile`: Is emitted when the scheduler has sent a `RECONCILE` call to the Master to query the status of non-terminal tasks.
* `sent_message`: Is emitted when the scheduler has sent a `MESSAGE` call to the Master to send arbitrary binary data to the executor.
* `sent_request`: Is emitted when the scheduler has sent a `REQUEST` call to the Master to call new resources.
* `sent_supress`: Is emitted when the scheduler has sent a `SUPPRESS` call to the Master to suppress new resource offers.
* `sent_accept_inverse_offers`: Is emitted when the scheduler has sent a `ACCEPT_INVERSE_OFFERS` call to the Master to accept inverse offers.
* `sent_decline_inverse_offers`: Is emitted when the scheduler has sent a `DECLINE_INVERSE_OFFERS` call to the Master to decline inverse offers.
* `sent_acknowledge_operation_status`: Is emitted when the scheduler has sent the `ACKNOWLEDGE_OPERATION_STATUS` call.
* `sent_reconcile_operations`: Is emitted when the scheduler has sent the `RECONCILE_OPERATIONS` call.
* `updated_task`: Is emitted when a task was updated. Contains an object with `taskId`, `executorId` and `state`.  
* `removed_task`: Is emitted when a task was removed. Contains the `taskId`.
* `task_launched`: Is emitted when a task moves to the running state, to handle initialization. Contains the task structure.

#### Example

Also, you can have a look at the `examples` folder to see examples for command-based and Docker-based schedulers.

```javascript
"use strict";
  
var Scheduler = require("mesos-framework").Scheduler;
var Mesos = require("mesos-framework").Mesos.getMesos();
  
var scheduler = new Scheduler({
    "masterUrl": "172.17.11.102", // If Mesos DNS is used this would be "leader.mesos", otherwise use the actual IP address of the leading master
    "port": 5050,
    "frameworkName": "My first Command framework",
    "logging": {
        "level": "debug"
    },
    "restartStates": ["TASK_FAILED", "TASK_KILLED", "TASK_LOST", "TASK_ERROR", "TASK_FINISHED"],
    "tasks": {
        "sleepProcesses": {
            "priority": 1,
            "instances": 3,
            "commandInfo": new Builder("mesos.CommandInfo").setValue("env && sleep 100").setShell(true),
            "resources": {
                "cpus": 0.2,
                "mem": 128,
                "ports": 1,
                "disk": 0
            }
        }
    },
    "handlers": {
        "HEARTBEAT": function (timestamp) {
            this.logger.info("CUSTOM HEARTBEAT!");
            this.lastHeartbeat = timestamp;
        }
    }
});
  
// Start the main logic once the framework scheduler has received the "SUBSCRIBED" event from the leading Mesos master
scheduler.on("subscribed", function (obj) {
  
    // Display the Mesos-Stream-Id
    scheduler.logger.info("Mesos Stream Id is " + obj.mesosStreamId);
  
    // Display the framework id
    scheduler.logger.info("Framework Id is " + obj.frameworkId);
  
    // Trigger shutdown after one minute
    setTimeout(function() {
        // Send "TEARDOWN" request
        scheduler.teardown();
        // Shutdown process
        process.exit(0);
    }, 60000);
  
});
  
// Capture "offers" events
scheduler.on("offers", function (offers) {
    scheduler.logger.info("Got offers: " + JSON.stringify(offers));
});
  
// Capture "heartbeat" events
scheduler.on("heartbeat", function (heartbeatTimestamp) {
    scheduler.logger.info("Heartbeat on " + heartbeatTimestamp);
});
  
// Capture "error" events
scheduler.on("error", function (error) {
    scheduler.logger.info("ERROR: " + JSON.stringify(error));
    scheduler.logger.info(error.stack);
});
  
scheduler.on("ready", function () {
    // Start framework scheduler
    scheduler.subscribe();
});
```

### Executor

You should consider writing your own executors if your framework has special requirements. For example, you may not want a 1:1 relationship between tasks and processes.

How can the custom executors be used? Taken from the [Mesos framework development guide](http://mesos.apache.org/documentation/latest/app-framework-development-guide/):

> One way to distribute your framework executor is to let the Mesos fetcher download it on-demand when your scheduler launches tasks on that slave.
> [ExecutorInfo](https://github.com/apache/mesos/blob/1.5.x/include/mesos/v1/mesos.proto#L709) is a Protocol Buffer Message class, and it contains a field of type [CommandInfo](https://github.com/apache/mesos/blob/1.5.x/include/mesos/v1/mesos.proto#L647).
> [CommandInfo](https://github.com/apache/mesos/blob/1.5.x/include/mesos/v1/mesos.proto#L647) allows schedulers to specify, among other things, a number of resources as URIs.
> These resources are fetched to a sandbox directory on the slave before attempting to execute the [ExecutorInfo](https://github.com/apache/mesos/blob/1.5.x/include/mesos/v1/mesos.proto#L709) command.
> Several URI schemes are supported, including HTTP, FTP, HDFS, and S3.

> Alternatively, you can pass the `frameworks_home` configuration option (defaults to: `MESOS_HOME/frameworks`) to your mesos-slave daemons
> when you launch them to specify where your framework executors are stored (e.g. on an NFS mount that is available to all slaves),
> then use a relative path in `CommandInfo.uris`, and the slave will prepend the value of frameworks_home to the relative path provided.

#### Events

**Events from Scheduler**  
The following events from the Scheduler are exposed:

* `subscribed`: The first event sent by the agent when the executor sends a `SUBSCRIBE` request on the persistent connection.
* `launch`: Sent by the agent whenever it needs to assign a new task to the executor. The executor is required to send an `UPDATE` message back to the agent indicating the success or failure of the task initialization.
* `kill`: Is sent whenever the scheduler needs to stop execution of a specific task. The executor is required to send a terminal update (e.g., `TASK_FINISHED`, `TASK_KILLED` or `TASK_FAILED`) back to the agent once it has stopped/killed the task. Mesos will mark the task resources as freed once the terminal update is received.
* `acknowledged`: Sent to signal the executor that a status update was received as part of the reliable message passing mechanism. Acknowledged updates must not be retried.
* `message`: Sent a custom message generated by the scheduler and forwarded all the way to the executor. These messages are delivered “as-is” by Mesos and have no delivery guarantees. It is up to the scheduler to retry if a message is dropped for any reason.
* `shutdown`: Sent by the agent in order to shutdown the executor. Once an executor gets a `SHUTDOWN` event it is required to kill all its tasks, send `TASK_KILLED` updates and gracefully exit. 
* `error`: Sent by the agent when an asynchronous error event is generated. It is recommended that the executor abort when it receives an error event and retry subscription.

**Events from Executor**  
The following events from the Executor calls are exposed:

* `sent_subscribe`: Is emitted when the executor has sent the `SUBSCRIBE` request.
* `sent_update`: Is emitted when the scheduler has sent the `UPDATE` request to the agent.
* `sent_message`: Is emitted when the scheduler has sent the `MESSAGE` request to send arbitrary binary data to the agent.

### Mesos

#### Creating objects ("natively" via protobufjs)

The module also exposes the Mesos protocol buffer object, which is loaded via [protobuf.js](https://github.com/dcodeIO/ProtoBuf.js/). It can be used to create the objects which can be then passed to the scheduler/executor methods.

**Example:**
```javascript
var Mesos = require("mesos-framework").Mesos.getMesos();
  
var TaskID = new Mesos.TaskID("my-task-id");
```

You can also instantiate Mesos protocol buffer objects from plain JSON. Be sure to follow the structure defined in the `mesos.proto` protobuf though, otherwise this will raise an error...

**Example:**
```javascript
var Builder = require("mesos-framework").Mesos.getBuilder();
  
var taskId = {
    "value": "my-task-id"
};
  
var TaskID = new (Builder.build("mesos.TaskID"))(taskId);
```

#### Creating objects (via builder pattern)

You can also create Mesos objects via the builder pattern like this:

**Example:**
```javascript
var Builder = require("mesos-framework").Builder;
  
var commandInfo = new Builder("mesos.CommandInfo")
                    .setValue("env && sleep 100")
                    .setShell(true);
```

### taskHealthHelper

This module allows for testing of task health (or any metric available via HTTP, for example cluster state, leader, etc...) and emit a scheduler event so the issue will be handled in code.  

The option properties you can specify to create a `taskHealthHelper` are the following:

* `interval`: The time interval between checks, in seconds, can be partial seconds (but not recommended), defaults to 30 seconds.
* `graceCount`: The amount of failed checks until a task is marked as unhealthy, defaults to 4.
* `portIndex`: The port index to check, defaults to 0.
* `propertyPrefix`: A optional prefix for the health property, mainly to be used when having multiple health checks per framework (normal health and leader status, for instance), defaults to an empty string.
* `errorEvent`: The name of the event to emit when a task fails the health check (after the grace count), defaults to propertyPrefix + "task_unhealthy".
* `additionalProperties`: An array of additional properties to be set, these properties do not have the prefix added to them, information below.
* `taskNameFilter`: An optional regular expression to filter tasks to be checked by the health check.
* `statusCodes`: An array of acceptable HTTP status codes, defaults to [200].
* `checkBodyFunction`: An optional function to check the body of the HTTP response (only after it passed the status check), parameters are the task object and the response body, needs to retrun a boolean.

The additional properties array is an array of objects with the following members:

* `name`: The name of the property to set, for example: "leader" (mandatory).
* `setUnhealthy`: Should the property be set when the check fails (optional, when unset it only sets the property when healthy).
* `inverse`: Whether the health status and the property are inversed or not (optional).
