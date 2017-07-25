var mode = "live";

var creds = {
    "live": {
        verbose: true,
        api: {
            debug_mode: true,
            host: "",
            password: "",
            retry_strategy: function(options){
                if (options.error === 'ECONNREFUSED') {
                    // End reconnecting on a specific error and flush all commands with a individual error
                    return new Error('The server refused the connection');
                }
                if (options.total_retry_time > 1000 * 60 * 60) {
                    // End reconnecting after a specific timeout and flush all commands with a individual error
                    return new Error('Retry time exhausted');
                }
                if (options.times_connected > 10) {
                    // End reconnecting with built in error
                    return undefined;
                }
                // reconnect after 10 times
                return Math.max(10 * 100, 3000);
            }
        },
        pubsub: {
            debug_mode: true,
            host: "",
            password: "",
            socket_keepalive: false,
            retry_strategy: function(options){
                if (options.error === 'ECONNREFUSED') {
                    // End reconnecting on a specific error and flush all commands with a individual error
                    return new Error('The server refused the connection');
                }
                if (options.total_retry_time > 1000 * 60 * 60) {
                    // End reconnecting after a specific timeout and flush all commands with a individual error
                    return new Error('Retry time exhausted');
                }
                if (options.times_connected > 10) {
                    // End reconnecting with built in error
                    return undefined;
                }
                // reconnect after 10 times
                return Math.max(10 * 100, 3000);
            }
        },
        net: {
            clientTimeout: 400,
            port: 7777,
            buffer_size: 1024*16 // buffer allocated per each socket socket
        },
        clients: {
        }
    }
};

module.exports = creds[mode];
