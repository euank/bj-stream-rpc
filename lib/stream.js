var Message = require('./jsonrpc2.js').Message;
var JSONStream = require('json-stream');
var util = require('util');
var EventEmitter = require('events').EventEmitter;


function Server(stream, fns) {
	var self = this;

	self.fns = fns || {};
	self.stream = stream;

	self._jsonstream = new JSONStream();
	self.stream.pipe(self._jsonstream);


	self._jsonstream.on('data', function(message) {
		var m = new Message(message);
		if(m.isRequest()) {
			if(m.isNotification()) {
				self._call(m.obj.method, m.obj.params, noop);
			} else {
				if(typeof self.fns[m.obj.method] !== "function") {
					return self._write(m.noSuchMethod());
				}

				self._call(m.obj.method, m.obj.params, function(err, resp) {
					self._write(m.respond(err, resp));
				});
			}
		} // Ignore if not request
	});
}

Server.prototype.addFns = function(obj) {
	var self = this;
	Object.keys(obj).forEach(function(name) {
		self.addFn(name, obj[name]);
	});
}

Server.prototype.addFn = function(name, fn) {
	this.fns[name] = fn;
}

Server.prototype.removeFn = function(name) {
	delete this.fns[name];
}

Server.prototype._call = function(name, args, callback) {
	var fn = this.fns[name];
	if(typeof fn !== "function") return callback("No such function " + name);
	fn.apply(this, args.concat([callback]));
}

Server.prototype._write = function(obj) {
	this.stream.write(new Buffer(JSON.stringify(obj) + "\n"));
}

Server.prototype.end = function(obj) {
	if(obj) this._write(obj);
	this.stream.end()
}

Server.prototype.close = function(obj) {
	this.end(obj);
}


function Client(stream) {
	var self = this;

	self.stream = stream;
	self._jsonstream = new JSONStream();
	self._stream = stream;
	self._stream.pipe(self._jsonstream);
	self._responsequeue = {};
	self._id = 1;

	self._stream.on('end', function() {
		self.emit('end');
	});

	self._jsonstream.on('data', function(message) {
		var m = new Message(message);
		if(m.isResponse()) {
				var callback = self._responsequeue[m.obj.id];
				delete self._responsequeue[m.obj.id];
				if(m.isError()) {
					return callback(m.obj.error.message, m.obj.error.data);
				}
				return callback(null, m.obj.result);
			} // Ignore anything that's not a response; someone else might consume it.
	});
}

util.inherits(Client, EventEmitter);

Client.prototype._write = function(obj) {
	this._stream.write(new Buffer(JSON.stringify(obj) + "\n"));
}

Client.prototype.request = function(name, args, callback) {
	this._responsequeue[this._id] = callback;
	this._write({jsonrpc: "2.0", method: name, params: args, id: '' + this._id});
	this._id++;
}

module.exports.Client = Client;
module.exports.Server = Server;
