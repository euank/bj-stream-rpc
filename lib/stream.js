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
			self._call(m)
		} // Ignore if not request
	});
}

util.inherits(Server, EventEmitter);

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

Server.prototype._doCall = function(fn, m) {
	var self = this;
	if(m.isNotification()) {
		fn.apply(self, m.obj.params);
	} else {
		fn.apply(self, m.obj.params.concat([function(err, varargs) {
			var args = Array.prototype.slice.call(arguments, 0);
			var err = null;
			var resp = null;
			if(args.length == 1) {
				resp = args[0];
			} else if(args.length == 2) {
				err = args[0];
				resp = args[1];
			} else if(args.length > 2) {
				err = args[0];
				resp = args.slice(1);
			}
			self._write(m.respond(err, resp));
		}]));
	}
};

Server.prototype._call = function(m) {
	var self = this;
	var fn = self.fns[m.obj.method];
	if(typeof fn !== "function") {
		self._write(m.noSuchMethod());
		return;
	}
	self._doCall(fn, m);
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
			if(typeof callback !== 'function') {
				console.error("We recieved a callback for a message id we don't recognize; ignoring. ID: " + m.obj.id);
				return;
			}
			delete self._responsequeue[m.obj.id];
			if(m.isError()) {
				return callback.apply(self, [m.obj.error.message].concat(m.obj.error.data));
			}
			return callback.apply(self, [null].concat(m.obj.result));
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

Client.prototype.notify = function(name, args) {
	this._write({jsonrpc: "2.0", method: name, params: args});
};

module.exports.Client = Client;
module.exports.Server = Server;
