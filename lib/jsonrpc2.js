function Message(jsonObj) {
	this.obj = jsonObj;
}

Message.prototype.isRequest = function() {
	return typeof this.obj.method  === "string"
};
Message.prototype.isNotification = function() {
	return this.isRequest() && typeof this.obj.id === "undefined"
};
Message.prototype.isResponse = function() {
	return typeof this.obj.error !== "undefined" || typeof this.obj.result !== "undefined"
}
Message.prototype.isError = function() {
	return this.isResponse() && typeof this.obj.error !== "undefined"
}
Message.prototype.respond = function(err, resp) {
	if(err) {
		return {
			jsonrpc: "2.0",
			error: {
				code: -32000,
				message: err.toString(),
				data: resp
			},
			id: this.obj.id
		}
	}
	return {
		jsonrpc: "2.0",
		result: resp,
		id: this.obj.id
	}
}
Message.prototype.noSuchMethod = function() {
	return {
		jsonrpc: "2.0",
		error: {
			code: -32601, 
			message: "The method " + this.obj.method + " was not found on the server", 
		},
		id: this.obj.id
	}
}

module.exports.Message = Message;
