//Inits, not used on this file
require('./utils/helpers')

//npm/node modules
const cluster   = require('cluster')
const net       = require('net')      //https://nodejs.org/api/net.html
const debug     = require('debug') //https://github.com/visionmedia/debug
debug.log = console.info.bind(console) //one all send all to console.

//Classes
const Promise 				= require('bluebird') //http://bluebirdjs.com/docs/api-reference.html
const EventEmitter 			= require('events')
const redisManager  		= require('./scripts/redis_manager')

//Redis Queues
redisManager.newQueue('sessionQueue')		//handles all session related events (TODO: separate like room queue below)

redisManager.newQueue('tickerQueue')		//handles a tick of the server

redisManager.newQueue('roomSubQueue') 		//handles sub/unsubs
redisManager.newQueue('roomChatQueue') 		//handles chat messages
redisManager.newQueue('roomGameEventQueue') //handles all general game events) sent to a room
redisManager.newQueue('roomUpdateQueue')	//handles room updates (like a constant message to  sent to a room
redisManager.newQueue('roomQueue')			//handles all general room events
redisManager.newQueue('botsQueue')		//handles all bot events


//These connect redis and the socket together
const ClientBridge      	= require('./_client/node_pubsub_bridge') //extracts the message from the tcp socket, and directs to whereever.
require('./_client/redis_pubsub_bridge') //listens for pubsub messages sent to redis

const ServerActions  		= require('./scripts/server/server-scripts') //server side getters/setters for server settings
const RoomActions			= require('./scripts/room/shared') //getters and setters for rooms

//Our stuff
const globals           = require('./globals')
const util 				= require("./utils/helpers")
const Sockets           = globals.sockets
const SERVER_NAME       = globals.getVariable("SERVER_NAME")
const TCP_PORT          = globals.getVariable("TCP_PORT")

//Debug
let _logserver, _log

if(cluster.isWorker){
	_log 		= debug(SERVER_NAME+":"+cluster.worker.id)
	_logserver	= debug('node_server:'+cluster.worker.id)
	_logserver('[WORKER ID]:', cluster.worker.id)
} else {
	_log 		= debug(SERVER_NAME)
	_logserver	= debug('node_server')
}
_logserver("[Starting] %s", SERVER_NAME)

/**
 * Migration Guide
 * - sync any server times automatically = https://help.ubuntu.com/lts/serverguide/NTP.html
 * currently applied to pubsub prod server/node prod, users prod, dashboard/bots/testing servers,
 *
 * **
 * PubSub Server - 90%
 *  (X) requires node 8.1.x with --harmony flag to enable es2017/es6/es2015 features
 *  (X) test suite to ensure bugs that are fixed are double checked to ensure all use cases are covered down the line.
 *  (X) redsmin - able to see it a bit better by using rooms| prefix for rooms.
 *  (X) system reserved rooms separated from normal rooms
 *  (X) reservation server is now part of the pubsub (node) server as with it's own port and therefore scales with.  each node server has its reservation server attached to it
 *  (X) backwards compatible to v1
 *  (-) turn based multiplayer
 *  (-) turn based multiplayer observers
 *  (X) more reliable realtime multiplayer w/ retries and confirmation of messages (also used in turn based)
 *  (X) scalable out of the box
 *  (X) no longer should need a separate listener
 *  (X) auto add/remove static bots to be be controlled
 *  (X) streamlined to redis properly without thousands of watches (using lua scripts - recommended way)
 *  (-) removed reliance on users/hooks server to reserve room
 *     (though we should still use it for others checking other people's rooms for example that aren't connected)
 * Reservation Server - 85%
 *  (X) /reserve
 * 	(X) /reconnect
 * 	(-) /invite
 * 	(-) /invite/confirm
 * 	(-) /info
 * Dashboard API (the web interface) - 10%
 * (-) Bot controller
 * (-) Remove Bots from a room
 * (-) Disable Bots completely
 */

util.setLoadPercent(0)
const node_server = net.createServer({ pauseOnConnect: true })

/**
 * Cleanup when server closes
 */
const _onNodeClose = (exitCode) => {

	_logserver('[On Node Close] Code: %s', exitCode)

	const closeQueue = () => redisManager.destroyQueues()
	const closeNode = () => node_server.close((err) => { return err ? new Error('failed to close node server '+err.toString()) : true})
	const sendMessage = () => Sockets.writeToAllSockets(JSON.stringify({
			"phase": "disconnected",
			"room": "Server",
			"message": "Server shutting down.",
			"response": {"sessionId": "server"}
		}))

	return Promise.all([sendMessage, closeQueue, closeNode])
		.then((results) => {
			process.stdout.write('\033c')
			process.exit(0)
		})
		.catch((err) => {
			_logserver("[Error]: On Node Close\n%s", err.toString())
			exitCode = null
			process.exit(1)
		})
}

/**
 * Server closed
 * Note: that if connections exist, this event is not emitted until all connections are ended.
 */
node_server.on('close', () => {
    _logserver("[Server] Closed on port: %s %s", TCP_PORT, SERVER_NAME)
    _onNodeClose()
})

/**
 * Server error
 */
node_server.on('error', (e) => {

    if (e.code === 'EADDRINUSE') {
		_logserver('[Error]: Address in use, retrying...')
        setTimeout(() => {
			node_server.close((err) => {
				node_server.listen(TCP_PORT, '::')
			})
        }, 1000);
    } else {
        _logserver("[Error]: General\n%s",e.message)
        _onNodeClose()
    }
})

/**
 * When server can accept connections
 */
node_server.on('listening', () => {
	const properties = node_server.address()
	util.setLoadPercent(100)
	if(process.send){
		process.send('ready')
	}

	_logserver("[Server] Listening on port: %s %s %s %s", properties.address, properties.port, properties.family, SERVER_NAME)
})

//Load the latest server configs before starting server
_logserver('[Server Configs]: Start Update')
ServerActions.updateServerConfig()
	.then((serverConfig) => {
		_logserver('[Server Configs]: Update Finished \n%O', serverConfig)
		util.setLoadPercent(10)
		node_server.listen(TCP_PORT, '::') //Set server to listen on specified port
	})
	.catch((err) => {
		_logserver("[Error]: On Config\n%s", err.toString())
		process.exit(1)
	})


/**
 * Server is receiving a new client connection send to pubsub_sessions
 * @see pubsub_sessions
 */
node_server.on('connection', (socket) => new ClientBridge(socket))

process.stdin.resume()

//If the process is exiting
process.on('exit', _onNodeClose)

//Listen for exit events
//Catch SIGINT and close server gracefully
process.on('SIGINT', _onNodeClose)

//Catch SIGTERM and close server gracefully
process.on('SIGTERM', _onNodeClose)

/**
 * Process any uncaught exceptions
 */
process.on('uncaughtException', (err) => {
    _log('[Process Error] Uncaught Exception\n%s', err.toString())
	console.log(err, err.stack.split("\n"))
	process.exit(1)
})




