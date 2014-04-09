'use strict';

var zookeeper = require('node-zookeeper-client')
    , util = require('util')
    , EventEmiter = require('events').EventEmitter;

/**
 * Provides kafka specific helpers for talking with zookeeper
 *
 * @param {String} [connectionString='localhost:2181/kafka0.8'] A list of host:port for each zookeeper node and
 *      optionally a chroot path
 *
 * @constructor
 */
var Zookeeper = function (connectionString, options) {
    this.client = zookeeper.createClient(connectionString,options);

    var that = this;
    this.client.on('connected', function () {
        that.listBrokers();
    });
    this.client.connect();
};

util.inherits(Zookeeper, EventEmiter);

Zookeeper.prototype.getBrokerDetail = function (brokerId, cb) {
    var path = '/brokers/ids/' + brokerId;
    this.client.getData(
        path,
        function (error, data) {
            if (error) {
                console.log('Error occurred when getting data: %s.', error);
            }

            cb && cb(data);
        }
    );
};

Zookeeper.prototype.listBrokers = function () {
    var that = this,
        path = '/brokers/ids'

    this.client.getChildren(
        path,
        function () {
            that.listBrokers()
        },
        function (error, children) {
            if (error) {
                //TODO: turn into an error
                return console.log('Failed to list children of node: %s due to: %s.', path, error);
            }

            if (children.length) {
                var count = 0,
                    brokers = {}

                children.forEach(function (brokerId) {
                    that.getBrokerDetail(brokerId, function (data) {
                        brokers[brokerId] = JSON.parse(data.toString())
                        if (++count == children.length) {
                            that.emit('brokersChanged', brokers)
                        }
                    })
                })

            } else {
                return that.emit('brokersChanged', {})
            }
        }
    );
};

Zookeeper.prototype.topicExists = function (topic, cb, watch) {
    var path = '/brokers/topics/' + topic,
        self = this;
    this.client.exists(
        path,
        function (event) {
            console.log('Got event: %s.', event);
            if (watch) self.topicExists(topic, cb);
        },
        function (error, stat) {
            if (error) return;
            cb(!!stat, topic);
        }
    );
}

module.exports = Zookeeper;
