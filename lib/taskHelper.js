"use strict";

var lib = require("requirefrom")("lib");
var Mesos = require("./mesos")().getMesos();
var Builder = lib("builder");

/**
 * Represents a TaskHelper object
 * @constructor
 * @param {object} scheduler - The scheduler object.
 */
function TaskHelper(scheduler) {
    if (!(this instanceof TaskHelper)) {
        return new TaskHelper(scheduler);
    }
    var self = this;
    self.zkClient = scheduler.zkClient;
    self.scheduler = scheduler;
    self.logger = scheduler.logger;
    self.zkServicePath = self.scheduler.zkServicePath;
}

/**
 * Load the task nodes belonging to the framework from ZooKeeper.
 */
TaskHelper.prototype.loadTasks = function() {
    var self = this;
    self.zkClient.getChildren(self.zkServicePath + "/tasks", function (error, children, stat) {
        if (error) {
            self.logger.error("Could not load task information.");
            // We're ready to subscribe
            self.scheduler.emit("ready");
        } else if (children && children.length) {
            var childStates = {};
            children.forEach(function (child) {
                self.zkClient.getData(self.zkServicePath + "/tasks/" + child, function (error, data, stat) {
                    if (error || !data) {
                        self.logger.error("Could not load task information for " + child);
                        if (!error) {
                            self.deleteTask(child);
                        }
                        childStates[child] = {'loaded': false};
                        self.logger.debug("childStates length " + Object.keys(childStates).length.toString() + " children.length " + children.length.toString());
                        if (Object.keys(childStates).length === children.length) {
                            // We're ready to subscribe
                            self.scheduler.emit("ready");
                        }
                        return;
                    }
                    var pending = self.scheduler.pendingTasks;
                    self.scheduler.pendingTasks = [];
                    var task = JSON.parse(data.toString());
                    self.logger.debug("Loading task: " + JSON.stringify(task));
                    var found = false;
                    var i = 0;
                    var pendingTask;
                    function addVars(variable) {
                        // Check if variable name is either HOST or PORT# -> Set by this framework when starting a task - copy it to the loaded task
                        if (variable.name.match(/^HOST$/) !== null || variable.name.match(/^PORT[0-9]+/) !== null) {
                            // Add all matching (non-user-defined) environment variables
                            pendingTask.commandInfo.environment.variables.push(variable);
                        }
                    }
                    for (i = 0; i < pending.length; i += 1) {
                        pendingTask = pending[i];
                        self.logger.debug("Pending task: \"" + JSON.stringify(pendingTask) + "\"");
                        if (pendingTask.name === task.name) {
                            if (task.runtimeInfo && task.runtimeInfo.agentId && (task.runtimeInfo.state === "TASK_RUNNING" || task.runtimeInfo.state === "TASK_STAGING")) {
                                pendingTask.runtimeInfo = task.runtimeInfo;
                                pendingTask.taskId = task.taskId;
                                if (task.commandInfo && task.commandInfo.environment && task.commandInfo.environment.variables && task.commandInfo.environment.variables.length > 0) {
                                    if (!pendingTask.commandInfo) {
                                        pendingTask.commandInfo = new Builder("mesos.CommandInfo")
                                            .setEnvironment(new Mesos.Environment([]))
                                            .setShell(false);
                                    }
                                    if (!pendingTask.commandInfo.environment) {
                                        pendingTask.commandInfo.environment = new Mesos.Environment([]);
                                    }
                                    // Iterate over all environment variables
                                    task.commandInfo.environment.variables.forEach(addVars);
                                }
                                self.scheduler.launchedTasks.push(pendingTask);
                                pending.splice(i, 1);
                                self.scheduler.reconcileTasks.push(pendingTask);
                            } else {
                                self.deleteTask(task.taskId);
                            }
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        self.logger.info("Setting task ID " + task.taskId + " to be killed");
                        self.scheduler.killTasks.push(task);
                    }
                    self.scheduler.pendingTasks = pending;
                    childStates[child] = {'loaded': true};
                    self.logger.debug("childStates length " + Object.keys(childStates).length.toString() + " children.length " + children.length.toString());
                    if (Object.keys(childStates).length === children.length) {
                        // We're ready to subscribe
                        self.scheduler.emit("ready");
                    }
                });
            });
        } else {
            // We're ready to subscribe - no tasks
            self.scheduler.emit("ready");
        }
    });
};

/**
 * Save task nodes from ZooKeeper.
 * @param {object} task - The task object which should be persisted to ZooKeeper.
 */
TaskHelper.prototype.saveTask = function (task) {
    var self = this;
    var data = new Buffer(JSON.stringify(task));
    // Seperating path creation from data save due to various client bugs.
    self.zkClient.mkdirp(self.zkServicePath+"/tasks/" + task.taskId, function (error, stat){
        if (error) {
            self.logger.error("Got error when creating task node in ZK " + task.name + " ID " + task.taskId + " data: " + error);
            return;
        }
        self.zkClient.setData(self.zkServicePath+"/tasks/" + task.taskId, data, function (error, stat) {
            if (error) {
                self.logger.error("Got error when saving task " + task.name + " ID " + task.taskId + " data: " + error);
                return;
            }
            self.logger.debug("Saved task " + task.name + " ID " + task.taskId);
        });
    });
};

/**
 * Delete task nodes from ZooKeeper.
 * @param {string} taskId - The id of the task which should be deleted from ZooKeeper.
 */
TaskHelper.prototype.deleteTask = function (taskId) {
    var self = this;
    self.zkClient.remove(self.zkServicePath + "/tasks/" + taskId, function (error) {
        if (error) {
            self.logger.error("Error deleting task ID " + taskId + " from zookeeper");
        } else {
            self.logger.debug("Deleted task " + taskId + " from zookeeper");
        }
    });
};

module.exports = TaskHelper;
