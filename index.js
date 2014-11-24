module.exports = {
	StreamClient: require("./lib/stream.js").Client,
	StreamServer: require("./lib/stream.js").Server,
	NamedStreamClient: require("./lib/named-bjson.js").Client,
	NamedStreamServer: require("./lib/named-bjson.js").Server,
};
