// A TCP server that takes connections from many named clients and tries to do a lot of smart things. It's fully bidirectional :)

var net = require('net');
var util = require('util');
var NamedStreamServer = require('./named-bjson.js').Server;
var NamedStreamClient = require('./named-bjson.js').Client;
var StreamServer = require('./stream.js').Server;
var StreamClient = require('./stream.js').Client;

// Options format:
// {
//	buffer: true, // Whether to buffer data for clients of the same name. Defaults to true
//}
function Server(host, port, fns, options) {
	var self = this;
	options = options || {};
	// Map of name:NamedStreamClient for clients. Only one of a given name may exist at a time.
	self.clients = {};
	self.servers = {};
	self.fns = fns;
	self.buffer = typeof options.buffer !== 'undefined' ? options.buffer : true;

	self.server = net.createServer(function(conn) {
		// Wait for it to actually name itself
		var server = new NamedStreamServer(conn, self.fns);
		server.on('named', function() {
			// Awesome, let's client back at it. Interestingly, it's expected to *not* be a named server so we don't identify ourselves
			var client = new StreamClient(conn);
			self.clients[server.name] = client;
			self.servers[server.name] = server;
		});
	}).listen(port, host);
}

Server.prototype.addFns = function(obj) {
	var self = this;
	Object.keys(obj).forEach(function(name) {
		self.addFn(name, obj[name]);
	});
}

Server.prototype.addFn = function(name, fn) {
	var self = this;
	self.fns[name] = fn;
	Object.keys(self.servers).forEach(function(name) {
		self.servers[name].addFn(name);
	});
}

Server.prototype.removeFn = function(name) {
	var self = this;
	delete this.fns[name];
	Object.keys(self.servers).forEach(function(name) {
		self.servers[name].removeFn(name);
	});
}

// Broadcast on all clients.
Server.prototype.map = function(args) {
	var args = Array.prototype.slice.call(arguments);
	var self = this;
	Object.keys(self.clients).forEach(function(name) {
		self.clients[name].request.apply(self.clients[name], args);
	});
}

// Notify on all clients
Server.prototype.broadcast = function(args) {
	var args = Array.prototype.slice.call(arguments);
	var self = this;
	Object.keys(self.clients).forEach(function(name) {
		self.clients[name].notify.apply(self, args);
	});
}

// Tcp client/server combo
function Client(host, port, name, version, fns, callback) {
	var self = this;
	if(typeof fns === 'function') {
		callback = fns;
		fns = version;
		verson = null;
	}
	// create connection
	self.clientStream = net.connect(port, host, function() {
		// connected
		NamedStreamClient.apply(self, [self.clientStream, name, version, callback]);
		self.server = new StreamServer(self.clientStream, fns);
	});
}

util.inherits(Client, NamedStreamClient);

module.exports.Server = Server;
module.exports.Client = Client;
