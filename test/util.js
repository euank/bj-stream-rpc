// This file is required before every test. We provide a few utility functions.
//
// They're dumped into the global scope, which doesn't seem like such a big deal for testing at least

// Common includes
global.net = require('net');
global.fs = require('fs');


var chai = require('chai');
chai.config.includeStack = true
global.expect = require('chai').expect;
global.async = require('async');

global.Duplex = require('duplex');

// Utility function that takes two duplex streams and makes them feed into each other; this makes
// them behave like e.g. independenct tcp socket connections, though with no delay of course.
global.connectDuplexPair = function(stream1, stream2) {
	stream1.on('_data', function(chunk){
		stream2._data(chunk);
	});
	stream1.on('_write', function(chunk){
		stream2.write(chunk);
	});
	stream2.on('_data', function(chunk){
		stream1._data(chunk);
	});
	stream2.on('_write', function(chunk){
		stream1.write(chunk);
	});
}

// Add everything from index.js into the global scope; it's what we're testing afterall

var bjrpc = require('../index.js');
Object.keys(bjrpc).forEach(function(key) {
	global[key] = bjrpc[key];
});
