var StreamServer = require("../").StreamServer;
var StreamClient = require("../").StreamClient;
var Duplex = require("duplex");
var chai = require('chai');
var expect = require('chai').expect;
var net = require('net');
var fs = require('fs');

chai.config.includeStack = true


// Utility function that takes two duplex streams and makes them feed into each other; this makes
// them behave like e.g. independenct tcp socket connections, though with no delay of course.
function connectPair(stream1, stream2) {
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

describe("StreamServer", function() {
	it("should respond to a request", function(done) {
		var stream = new Duplex();
		var server = new StreamServer(stream, {
			test: function(cb) {
				cb(null, "test response")
			}
		});

		stream.once('_data', function(chunk) {
			var res = JSON.parse(chunk);
			expect(res.id).to.equal('1');
			expect(res.result).to.equal('test response');
			done();
		});

		stream._data(JSON.stringify({jsonrpc: "2.0", method: "test", params: [], id: '1'}) + "\n");
	});

	it("should not respond to a notification", function(done) {
		var stream = new Duplex();
		var server = new StreamServer(stream, {
			testNotification: function(arg1, arg2, nocallback) {
				expect(arguments.length).to.equal(2);
				setTimeout(function() { 
					done(); // Give the other end time to make sure it doesn't get anything back
				}, 10);
			}
		});

		stream.once('_data', function(chunk) {
			throw new Error("We shouldn't get a response: " + chunk.toString());
		});

		stream._data(JSON.stringify({jsonrpc: "2.0", method: "testNotification", params: [1,2]}) + "\n");
	});
});

describe("StreamClient", function() {
	it("should write a request", function(done) {
		var stream = new Duplex();
		var client = new StreamClient(stream);

		stream.once('_data', function(data) {
			var request = JSON.parse(data);
			expect(request.id).to.exist;
			expect(request.method).to.equal("test");
			expect(request.params).to.eql(["param"]);
			done();
		});

		client.request("test", ['param'], function(err, response) {});
	});

	it("should write a notification", function(done) {
		var stream = new Duplex();
		var client = new StreamClient(stream);

		stream.once('_data', function(data) {
			var request = JSON.parse(data);
			expect(request.id).not.to.exist;
			expect(request.method).to.equal("test");
			expect(request.params).to.eql(["param"]);
			done();
		});

		client.notify("test", ['param']);
	});
});

describe("StreamClient and StreamServer", function() {
	it("Should communicate bidirectionally", function(done) {
		var clientstream = new Duplex();
		var serverstream = new Duplex();

		connectPair(clientstream, serverstream)

		var clientc = new StreamClient(clientstream);
		var clients = new StreamServer(clientstream, {
			clientsfn: function(cb) {
				cb(null, "clients response");
			}
		});

		var serverc = new StreamClient(serverstream);
		var servers = new StreamServer(serverstream, {
			serversfn: function(cb) {
				cb(null, "servers response");
			}
		});

		serverc.request("clientsfn", [], function(err, resp) {
			expect(err).to.not.be.ok;
			expect(resp).to.equal("clients response");

			clientc.request("serversfn", [], function(err, resp) {
				expect(err).to.not.exist;
				expect(resp).to.equal("servers response");

				serverc.request("serversfn", [], function(err, resp) {
					expect(err).to.exist;

					done();
				});
			});
		});
	});
});

describe("Streamclient/server over a unix socket", function() {
	it("Should work :)", function(done) {

		net.createServer(function(conn) {
			var server = new StreamServer(conn, {
				test: function(cb) { cb(null, "test response"); }
			});
		}).listen("./NODEJS_TEST_SOCKET.TEST_SOCKET", function() {
			var conn2 = net.connect({path: "./NODEJS_TEST_SOCKET.TEST_SOCKET"}, function() {
				var client = new StreamClient(conn2);
				client.request("test", [], function(err, res) {
					expect(err).to.not.be.ok;
					expect(res).to.equal("test response");
					done();
				});
			});
		});
	});
	after(function(done) {
		fs.unlink('./NODEJS_TEST_SOCKET.TEST_SOCKET', done);
	});
});
