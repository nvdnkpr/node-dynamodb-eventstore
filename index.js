/*

index.js - "dynamodb-eventstore": Store events in AWS DynamoDB

The MIT License (MIT)

Copyright (c) 2013 Tristan Slominski

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

*/
"use strict";

var assert = require('assert'),
    AWS = require('aws-sdk'),
    dateformat = require('dateformat'),
    events = require('events'),
    util = require('util');

/*
  * `options`:
    * `AWS`: _Object_ _(Default: `require('aws-sdk');`)_ An instance of `aws-sdk`.
    * `accessKeyId`: _String_ AWS access key ID.
    * `region`: _String_ The region to send service requests to.
    * `dynamoDbTable`: _String_ The name of DynamoDB table to use for event store.
    * `secretAccessKey`: _String_ AWS secret access key.
    * `sslEnabled`: _Boolean_ _(Default: true)_ Whether to enable SSL for requests.
*/
var DynamoDbEventStore = module.exports = function DynamoDbEventStore (options) {
    var self = this;
    options = options || {};

    self.aws = options.AWS || AWS;
    self.aws.config.update({
        accessKeyId: options.accessKeyId, 
        region: options.region,
        secretAccessKey: options.secretAccessKey,
        sslEnabled: (options.sslEnabled === undefined) ? true : options.sslEnabled
    });

    self.dynamoDbTable = options.dynamoDbTable;
    self.dynamoDb = new self.aws.DynamoDB();
};

util.inherits(DynamoDbEventStore, events.EventEmitter);

/*
  * `event`: _Object_ JavaScript object representing the event to store.
  * `callback`: _Function_ _(Default: undefined)_ An optional callback to call
          on success or failure.
*/
DynamoDbEventStore.prototype.put = function put (event, callback) {
    var self = this;

    var writeParams = {RequestItems: {}};
    writeParams.RequestItems[self.dynamoDbTable] = [];

    var now = new Date();
    var nowHr = process.hrtime()[1];

    var year = dateformat(now, "UTC:yyyy");
    var month = dateformat(now, "UTC:mm");
    var day = dateformat(now, "UTC:dd");
    var hours = dateformat(now, "UTC:HH");
    var minutes = dateformat(now, "UTC:MM");
    var seconds = dateformat(now, "UTC:ss");
    var unique = dateformat(now, "UTC:l" + nowHr);

    var key = year + month + day + 'T' + hours + minutes + seconds + unique;
    var body = JSON.stringify(event);

    writeParams.RequestItems[self.dynamoDbTable].push({
        PutRequest: {
            Item: {
                key: {"S": key}, 
                body: {"S": body}
            }
        }
    });

    self.emit('~trace', 'put ' + key + ' ' + body);

    var writeBatchCallback;

    if (callback) {
        writeBatchCallback = function (error, response) {
            if (error) {
                self.emit('~trace', 'error ' + key);
                return callback(true);
            } else {
                self.emit('~trace', 'ok ' + key);
                return callback();
            }
        };
    } else {
        writeBatchCallback = function (){};
    }

    self.dynamoDb.batchWriteItem(writeParams, writeBatchCallback);
};