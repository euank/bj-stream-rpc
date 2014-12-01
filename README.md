# BJ Stream RPC

BJ Stream RPC is an almost json-rpc-2.0 compatible client/server implementation which strives to enable bidirectional-communication easily and painlessly.

The library will also work for uni-directional workloads.

## Usage

Install it with `npm install bj-stream-rpc`.

You may choose between multiple types of clients and servers. They are described below in order of most primitive to most complicated.

### Stream client/server

The stream client and server each take a [Duplex stream](http://nodejs.org/api/stream.html#stream_class_stream_duplex).

Please note that a callback should take exactly two arguments (error and result).

**Server**

```javascript
var bjrpc = require('bj-stream-rpc');

var functionObject = {
	test: function(arg1, arg2, callback) {
		callback(errorArg, resultArg);
	}
}

// functionObject is an optional argument
var streamServer = new bjrpc.StreamServer(duplexStream, functionObject);

streamServer.addFns(anotherFunctionObject);
streamServer.addFn("test2", function(arg1, arg2, callback){callback(err, res);});
streamServer.removeFn("test2")
// Calls '.end()' on the underlying stream. You can also manually end it yourself.
streamServer.close(); // streamServer.end() does the same thing
```

**Client**
```javascript
var streamClient = new bjrpc.StreamClient(duplexStream);
streamClient.request("serverFunctionName", [arg1, arg2], function(error, result) {
	console.log("Server responded with:", error, result);
});
streamClient.on("end", function() {
	console.log("Server closed our connection");
});
```

Naturally, you can make this bidirectional by passing the same duplexStream to StreamClient and StreamServer on both ends. For example, the following is valid.

```javascript
// Assume you have tcpServerConn and tcpClientConn gotten from createServer and connect respectively

var serverStreamServer = new bjrpc.StreamServer(tcpServerConn, {serverFn: function(cb){cb(null, "Server response");});
var serverStreamClient = new bjrpc.StreamClient(tcpServerConn);

var clientStreamServer = new bjrpc.StreamServer(tcpClientConn, {clientFn: function(cb){cb(null, "Client response");});
var clientStreamClient = new bjrpc.StreamClient(tcpClientConn);

serverStreamClient.request("clientFn", function(err, res) {
	// res == "Server response"
})
clientStreamClient.request("serverFn", function(err, res) {
	// res == "Client response"
});
```
## NamedStreamServer/Client

The named stream server/client pair implement a meta-protocol on top of JSON-RPC-2 which mandates that the client, on connecting, call the function "identify" with a name before calling any other server functions. This can be useful for being able to differentiate clients and thus communicate with a single one.

Their usage is very similar to the StreamClient / StreamServer usage except that the Server has a `name` property and the Client's initialization function has an argument of name and version and takes a callback to be called once it is identifed.

**Server**
```javascript
var serverFunctions = {
	whoami: function(callback) {
		callback(null, streamServer.name);
	}
};
var streamServer = new bjrpc.NamedStreamServer(duplexStream, serverFunctions);
```

**Client**
```javascript
var streamClient = new bjrpc.NamedStreamClient(duplexStream, "John", "optional-v1.0", function(err) {
	// Identified
	streamClient.request("whoami", [], function(err, name) {
		console.log("My name is " + name);
	});
});
```

## Wire protocol

The data is sent on the wire as a set of newline-delimited lines of JSON.

This is meant to be a simple enough wire protocol that implementing clients and servers in other languages which are cross-compatible should be trivial.

Any conferment client/server MUST accept both requests and responses and then ignore any item that does not apply to it; e.g. the server must accept responses in addition to requests, and simply ignore them. This is because it is intended that clients and servers share the same wire.

## Specifications

This library does not strictly conform to the json-rpc 2.0 specifications. Namely, it does not support arrays of functions. Pull requests are welcome and I might implement that at some point, but right now it's not up there on my priorities.

## Contributions

Contributions are very welcome!

## License

This library is multi-licensed under the GPLv3 or later, the ISC, or the Apache 2.0.

You may pick any of these licenses and treat the code as if it is entirely under that license unless you with to contribute changes back, in which case you agree your changes are available under all three of the above licenses.
