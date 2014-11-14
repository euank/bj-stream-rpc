var StreamServer = require("../").StreamServer;
var StreamClient = require("../").StreamClient;
var Duplex = require("duplex");
var chai = require('chai');
var expect = require('chai').expect;
var net = require('net');
var fs = require('fs');

chai.config.includeStack = true

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
});

describe("StreamClient", function() {
	it("should write a request", function(done) {
		var stream = new Duplex();
		var client = new StreamClient(stream);

		stream.once('_data', function(data) {
			var request = JSON.parse(data);
			expect(request.method).to.equal("test");
			expect(request.params).to.eql(["param"]);
			done();
		});

		client.request("test", ['param'], function(err, response) {});
	});
});

describe("StreamClient and StreamServer", function() {
	it("Should communicate bidirectionally", function(done) {
		var clientstream = new Duplex();
		var serverstream = new Duplex();

		// Mock up the behavior of two sides of a bidirectional socket
		serverstream.on('_data', function(chunk){
			clientstream._data(chunk);
		});
		serverstream.on('_write', function(chunk){
			clientstream.write(chunk);
		});
		clientstream.on('_data', function(chunk){
			serverstream._data(chunk);
		});
		clientstream.on('_write', function(chunk){
			serverstream.write(chunk);
		});

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
