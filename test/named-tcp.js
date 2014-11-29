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
					client.request('test1', ['alpha', 'beta'], function(err, res1, res2) {
						expect(err).not.to.be.ok;
						expect(res1).to.equal("resparg1");
						expect(res2).to.equal('test1 called with alpha and beta');
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
						done();
					}, 10);
			});
		});
	});
	it("should allow the server to behave as a client", function(done) {
		done();
	});
});
