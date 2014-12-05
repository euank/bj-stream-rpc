describe("NamedStreamServer/Client", function() {
	it("Should allow naming", function(done) {
		var stream = new Duplex();
		var server = new NamedStreamServer(stream, {
			test: function(cb) {
				cb(null, "test response");
			}
		});

		setTimeout(function() {
			// his name is my name too
			expect(server.name).to.equal("John Jacob Jingleheimer Schmidt");
			done()
		}, 2);

		stream._data(JSON.stringify({jsonrpc: "2.0", method: "identify", params: ["John Jacob Jingleheimer Schmidt"], id: "testid"}) + "\n");
	});

	it("should error out if not named yet", function(done) {
		var stream = new Duplex();
		var server = new NamedStreamServer(stream, {
			test: function(cb) {
				cb(null, "test response");
			}
		});

		stream.once('_data', function(data) {
			var res = JSON.parse(data);
			expect(res.error).to.be.ok;
			done();
		});

		stream._data(JSON.stringify({jsonrpc: "2.0", method: "test", params: ["John Jacob Jingleheimer Schmidt"], id: "testid"}) + "\n");
	});

	it("Should work via NamedStreamClient", function(done) {
		var sserver = new Duplex(),
		    sclient = new Duplex();
		connectDuplexPair(sserver, sclient);

		var server = new NamedStreamServer(sserver, {
			test: function(cb) {
				cb(null, "test response");
			}
		});

		var client = new NamedStreamClient(sclient, "John Jacob Jingleheimer Schmidt", function() {
			// Connected
			expect(server.name).to.equal("John Jacob Jingleheimer Schmidt");
			client.request("test", [], function(err, resp) {
				expect(resp).to.equal("test response");
				done();
			});
		});
	});
});
