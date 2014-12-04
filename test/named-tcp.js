describe("NamedTcpServer/Client", function() {

	it("should work with many clients and 1 server", function(done) {
		var notify1Calls = 0;
		var server = new NamedTcpServer('127.0.0.1', 8688, {
			test1: function(arg1, arg2, cb) {
				cb(null, "resparg1", "test1 called with " + arg1 + " and " + arg2);
			},
			notify1: function(arg1, arg2) {
				notify1Calls++;
			}
		});

		async.map([1,2,3,4,5], function(num, callback) {
			var client = new NamedTcpClient('127.0.0.1', 8688, "client"+num, "v1", {
				clienttest1: function(arg1, arg2, cb) {
					cb(null, "resparg1", "test1 called with " + arg1 + " and " + arg2);
				},
				clientnotify1: function(arg1, arg2) {
					clientNotify1Calls++;
				}
			}, function() {
				client.addFn("clienttest"+num, function(cb) { cb("I am number " + num); });
				callback(null, client)
			});
		}, function(err, results) {
			expect(err).not.to.be.ok;
			async.map(results, function(client, callback) {
				async.parallel([function(pcb) {
					client.request('test1', ['alpha', 'beta'], function(err, respArr) {
						expect(err).not.to.be.ok;
						expect(respArr[0]).to.equal("resparg1");
						expect(respArr[1]).to.equal('test1 called with alpha and beta');
						pcb(null);
					});
				}, function(pcb) {
					client.notify('notify1', [1, 2]);
					pcb(null);
				}], function(err, results) {
					callback(null);
				});
			}, function(err, results) {
					expect(err).not.to.be.ok;
					setTimeout(function() {
						expect(notify1Calls).to.equal(5);
						server.close();
						setTimeout(function() {
							done();
						}, 100);
					}, 10);
			});
		});
	});

	it("should allow the server to behave as a client", function(done) {
		var server = new NamedTcpServer('127.0.0.1', 8688, {}, {}, function() {
			async.map([1,2], function(num, callback) {
				var client = new NamedTcpClient('127.0.0.1', 8688, "client"+num, "v1", {
					clienttest: function(arg1, arg2, cb) {
						cb(null,"client"+num, "test1 called with " + arg1 + " and " + arg2);
					}
				}, function() {
					callback(null, client)
				});
			}, function(err, results) {
				expect(err).not.to.be.ok;
				server.map('clienttest', 1, 2, function(ign, results) {
					expect(results.client1.error).not.to.be.ok;
					expect(results.client1.result).to.eql(["client1", "test1 called with 1 and 2"]);
					expect(results.client2.error).not.to.be.ok;
					expect(results.client2.result).to.eql(["client2", "test1 called with 1 and 2"]);
					server.close();
					setTimeout(function() {
						done();
					}, 100);
				});
			});
		});
	});
});
