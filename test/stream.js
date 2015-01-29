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

		connectDuplexPair(clientstream, serverstream)

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

	it("Should understand a client disconnect", function(done) {
		// Do this one over TCP since Duplex() doesn't handle end/fin the same way
		// and realistically people want this over tcp for the most part
		net.createServer(function(conn) {
			var server = new StreamServer(conn, {test: function(cb) { cb(null, "Hello world"); }});
		}).listen(38112, function(err) {
			expect(err).not.to.be.ok;

			var clientstream = net.connect({port: 38112}, function() {
				var client = new StreamClient(clientstream);
				client.request('test', [], function(err, resp) {
					expect(err).not.to.be.ok;
					expect(resp).to.equal("Hello world");
					// Now disconnect and we shouldn't crash
					clientstream.end();

					var gotEnd = false;

					client.on('end', function() {
						client.request('test', [], function(err, resp){
							expect(err).to.be.ok;
							done();
						});
					});
				});
			});

		});
	});

	it('should support promises', function(done) {
		var clientstream = new Duplex();
		var serverstream = new Duplex();

		connectDuplexPair(clientstream, serverstream)

		var clientc = new StreamClient(clientstream);
		var clients = new StreamServer(clientstream, {
			clientsfn: function(arg) {
				var deferred = Q.defer();
				setTimeout(function(){
					deferred.resolve("clientsfn called with " + arg);
				}, 5);
				return deferred.promise;
			}
		});

		var serverc = new StreamClient(serverstream);
		var servers = new StreamServer(serverstream, {
			serversfn: function(arg) {
				var deferred = Q.defer();
				setTimeout(function(){
					deferred.resolve("serversfn called with " + arg);
				}, 5);
				return deferred.promise;
			},
			serverserr: function(arg) {
				var deferred = Q.defer();
				setTimeout(function(){
					deferred.reject("ERROR: " + arg);
				}, 5);
				return deferred.promise;
			}
		});

		serverc.request("clientsfn", ['param'])
		.then(function(value) {
			expect(value).to.equal("clientsfn called with param");
		}).then(function() {
			return serverc.request('clientsfn', ['param2']);
		}).then(function(value) {
			expect(value).to.equal('clientsfn called with param2');
		}).then(function() {
			return clientc.request('serversfn', ['cparam']);
		}).then(function(value) {
			expect(value).to.equal("serversfn called with cparam");
		}).then(function() {
			return clientc.request('serverserr', ['errarg']);
		}).fail(function(err) {
			expect(err.error).to.equal("ERROR: errarg");
			done();
		})
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
