module.exports = {
	// Set required service name (allowed characters: a-z, A-Z, 0-9, -, _, and space)
	serviceName: "node_pubsub_server",

	// Use if APM Server requires a token
	secretToken: '',

	// Set custom APM Server URL (default: http://localhost:8200)
	serverUrl: '',

	//todo: set to only on production env
	active: true,

	frameworkName: "pubsub",
	frameworkVersion: "2"
}
