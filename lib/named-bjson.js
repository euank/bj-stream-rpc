// named-bjson is a client/server pair that implements a meta-json-rpc protocol that requires each client to identify itself by a (presumably) unique name before regular communication is started.
// The server saves the name and makes it accessible via Server.name so that the user of the server may know what client they are dealing with.

// Build on top of stream

var Stream = require('./stream');
var util = require('util');
var _ = require('underscore');

function Server(stream, fns) {
	var self = this;
	Stream.Server.apply(this, arguments);

	self.name = null;
}

util.inherits(Server, Stream.Server);

Server.prototype.identify = function(name, version, callback) {
	if(typeof version == "function") {
		callback = version;
		version = 0;
	}

	this.name = name;
	this.version = version;

	this.emit('named');
	callback(null);
}

// We override call to only allow identification until it's identified, and then behave as normal
Server.prototype._call = function(m) {
	var self = this;
	if(self.name === null) {
		// Override, we need to be named
		if(m.obj.method !== "identify") {
			self._write(m.noSuchMethod());
			return;
		}
		self._doCall(self.identify, m);
	} else {
		return Stream.Server.prototype._call.apply(this, arguments);
	}
}

function Client(stream, name, version, callback) {
	var self = this;
	Stream.Client.apply(this, [stream]);
	self.name = name;

	if(typeof version === 'function') {
		callback = version;
	} else {
		self.version = version;
	}

	if(typeof callback !== 'function') {
		callback = function(err){ if(err) { console.error(err); } }
	}

	self.request("identify", [name, version], callback);
}

_.extend(Client.prototype, Stream.Client.prototype)

module.exports = {
	Server: Server,
	Client: Client,
}
