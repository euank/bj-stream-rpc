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
						done();
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
					done();
				});
			});
		});
	});

	it("should allow the server to broadcast", function(done) {
		var promises = [Q.defer(), Q.defer()];
		var server = new NamedTcpServer('127.0.0.1', 8688, {}, {}, function() {
			async.map([0,1], function(num, callback) {
				var client = new NamedTcpClient('127.0.0.1', 8688, "client"+num, "v1", {
					clienttest: function(arg1, arg2) {
						promises[num].resolve("called with " + arg1 + " and " + arg2);
					}
				}, function() {
					callback(null, client)
				});
			}, function(err, results) {
				expect(err).not.to.be.ok;
				server.broadcast('clienttest', 1, 2);
				var proms = promises.map(function(deferred) { return deferred.promise; });
				Q.all(proms).then(function(results) {
					expect(results.length).to.equal(2);
					expect(results[0]).to.eql("called with 1 and 2");
					server.close();
					done()
				});
			});
		});

	});

	it("Should understand client disconnects", function(done) {
		var clientCalls = [0,0];
		var promises = [Q.defer(), Q.defer()];
		var server = new NamedTcpServer('127.0.0.1', 8688, {}, {}, function() {
			async.map([0,1], function(num, callback) {
				var client = new NamedTcpClient('127.0.0.1', 8688, "client"+num, "v1", {
					clienttest: function() {
						clientCalls[num]++;
						promises[num].resolve();
					}
				}, function() {
					callback(null, client)
				});
			}, function(err, clients) {
				// We have a server with two clients, client0,client1 connected
				expect(clients.length).to.equal(2);
				expect(server.clients).to.have.keys(['client0', 'client1']);
				expect(err).not.to.be.ok;

				server.broadcast('clienttest');
				var proms = promises.map(function(deferred) { return deferred.promise; });
				Q.all(proms).then(function(results) {
					expect(results.length).to.equal(2);
					expect(clientCalls).to.eql([1,1]);
					// Each client was called once

					clients[1].close();
					// Reset client0's promise. If client1's promise gets called after
					// not being reset it throws an exception so that's a good way to
					// make sure the test tests it doesn't get called
					promises[0] = Q.defer();
					// Wait for the close
					setTimeout(function() {
						expect(server.clients).to.have.keys(['client0']);
						server.broadcast('clienttest');
						// wait to be sure both were called so our clientCalls counts are accurate
						setTimeout(function() {
							proms = promises.map(function(deferred) { return deferred.promise; });
							Q.all(proms).then(function(results) {
								// Callback hell; that's how you know it's a good test.
								expect(clientCalls).to.eql([2,1]);
								expect(server.clients).to.have.keys(['client0']);
								server.close();
								done();
							});
						}, 5);
					}, 5);
				});
			});
		});
	});
});

