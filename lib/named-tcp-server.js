// A TCP server that takes connections from many named clients and tries to do a lot of smart things. It's fully bidirectional :)

var net = require('net');
var async = require('async');
var util = require('util');
var NamedStreamServer = require('./named-bjson.js').Server;
var NamedStreamClient = require('./named-bjson.js').Client;
var StreamServer = require('./stream.js').Server;
var StreamClient = require('./stream.js').Client;
var _ = require('underscore');

// Options format:
// {
//	buffer: true, // Whether to buffer data for clients of the same name. Defaults to true
//}
function Server(host, port, fns, options, callback) {
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
			client.on('end', function() {
				delete self.clients[server.name];
				delete self.servers[server.name];
			})
			server.on('end', function() {
				// This probably shouldn't happen
				delete self.clients[server.name];
				delete self.servers[server.name];
			});
		});
	}).listen(port, host, callback);
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
	var fnname = args.shift();
	var callback = args.pop();
	var self = this;
	async.map(Object.keys(self.clients), function(name, cb) {
		self.clients[name].request(fnname, args, function(innerargs) {
			var objRes = {}
			var args = Array.prototype.slice.call(arguments);
			var err = args.shift();
			if(args.length == 1) {
				args = args[0];
			}
			objRes[name] = {error: err, result: args}
			cb(null, objRes);
		});
	}, function(ignore, results) {
		callback(null, results.reduce(function(x,y) { return _.extend(x, y); }, {}));
	});
}

// Notify on all clients
Server.prototype.broadcast = function(args) {
	var args = Array.prototype.slice.call(arguments);
	var self = this;
	Object.keys(self.clients).forEach(function(name) {
		var client = self.clients[name];
		client.notify(args[0], args.slice(1));
	});
}

Server.prototype.end = function(obj) {
	var self = this;
	Object.keys(self.servers).forEach(function(name) {
		self.servers[name].end(obj);
	});
	self.server.close();
}

Server.prototype.close = function(obj) {
	this.end(obj);
};

Server.prototype.listClients = function() {
	return self.clients;
};

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
		StreamServer.apply(self, [self.clientStream, fns]);
	});
}

_.extend(Client.prototype, StreamServer.prototype)
_.extend(Client.prototype, NamedStreamClient.prototype)

module.exports.Server = Server;
module.exports.Client = Client;
