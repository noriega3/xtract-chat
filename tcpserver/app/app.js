"use strict"
require('dotenv').config()

//Register _moduleAliases in package.json
const moduleAlias = require('module-alias')

process.env.NODE_PATH = __dirname

// Or multiple aliases
moduleAlias.addAliases({
    '@root'  : __dirname,
    '@storage': __dirname + '/store',
    '@store': __dirname + '/store',
    '@jobs': __dirname + '/scripts/jobs',
    '@redis': __dirname + '/scripts/redis2',
    '@room': __dirname + '/scripts/room'
})


const debug     = require('debug') //https://github.com/visionmedia/debug
debug.log = console.info.bind(console) //one all send all to console.
const _log = debug('pubSub')
const _error = debug('pubSub:err')

process.title = 'node_pubsub_server'

const printMemoryUsage = require('./util/printMemoryUsage')
//optimizing:
//log types, move to use util
//redis/sessions have their own message queue

//TODO: v3 will use redis modules written in C to eliminate repeated lua scripting and actually reference other scripts
//https://redislabs.com/blog/writing-redis-modules/

// Borrowing from Unix,
// Node.js encourages composing the complex and powerful out of smaller, simpler pieces.
// This idea trickles down from entire applications (using the best tool for the job vs. a full suite) to how the tools themselves are built.

// http://thenodeway.io/introduction/#dont-get-carried-away
// Only build modules as needed. If there is a tangible benefit to splitting code off into a new module
// (ex: someone else might like to use it, this will make my code cleaner, etc) then by all means go ahead. Just remember: the end-goal is always simpler code, and not just a greater number of smaller files.


//TODO: instead of eventIds, implement checksum logic like blockchain/file verifications
//TODO: normalize '' and "" places (use '') as the default

//npm/node modules
const Promise 	= require('bluebird') //http://bluebirdjs.com/docs/api-reference.html
const fs 		= Promise.promisifyAll(require('fs'))

const store	= require('./store')
store.createStore()

const queues = store.queues
const database = store.database
const withDatabase = database.withDatabase

//queues
require('./eventQueue/BotEventQueue')()
require('./eventQueue/RoomEventQueue')()
require('./eventQueue/SessionEventQueue')()
const tickerQueue = require('./eventQueue/TickEventQueue')()
require('./eventQueue/RequestEventQueue')()
require('./eventQueue/ApiEventQueue')()

//servers
const TcpServer = require('./server/TcpServer')()
const ApiServer = require('./server/ApiServer')()
//const WebSocketProxyServer 	= require('./server/WebSocketServer')({port: process.env.WS_PORT, path: process.env.WS_PATH})

require('./adapters/RedisMessageBridge') //transports redis published messages to appropriate tcp socket(s)
require('./scripts/room/shared') //getters and setters for rooms
const serverScripts = Promise.promisifyAll(require('./scripts/server'))

/**
 * Optimizations Needed
 * ALL Servers
 * - change redis to connect via unix socket vs tcp (14% faster and relies less on tcp checks causing lag)
 * - [Breaking change] babel on node js to break out lodash and other stuff (https://github.com/babel/example-node-server)
 * - compression over send/receive  (https://github.com/expressjs/compression) - or something similar
 * - ensure parallel#1 - (http://www.monitis.com/blog/top-7-node-js-performance-tips-you-can-adopt-today/)
 * ===
 * Migration Guide
 * - sync any server times automatically = https://help.ubuntu.com/lts/serverguide/NTP.html
 * currently applied to pubsub prod server/node prod, users prod, dashboard/bots/testing servers,
 * **
 * PubSub Server - 90%
 *  (X) requires node 8.1.x with --harmony flag to enable es2017/es6/es2015 features
 *  (X) test suite to ensure bugs that are fixed are double checked to ensure all use cases are covered down the line.
 *  (X) redsmin - able to see it a bit better by using rooms| prefix for rooms.
 *  (X) system reserved rooms separated from normal rooms
 *  (X) reservation server is now part of the pubsub (node) server as with it's own port and therefore scales with.  each node server has its reservation server attached to it
 *  (X) backwards compatible to v1
 *  (90) turn based multiplayer
 *  (-) turn based multiplayer observers
 *  (X) more reliable realtime multiplayer w/ retries and confirmation of messages (also used in turn based)
 *  (X) scalable out of the box
 *  (X) no longer should need a separate listener
 *  (X) auto add/remove static bots to be be controlled
 *  (X) add WebSocket clients
 *  (X) streamlined to redis properly without thousands of watches (using lua scripts - recommended way)
 *  (80) removed reliance on users/hooks server to reserve room
 *     (though we should still use it for others checking other people's rooms for example that aren't connected)
 * Http Server - 85%
 *  (X) /reserve
 * 	(X) /reconnect
 * 	(-) /invite
 * 	(-) /invite/confirm
 * 	(-) /info
 * Dashboard  (the web interface) - 50%
 * (-) Bot controller
 * (-) Remove Bots from a room
 * (-) Disable Bots completely
 * (X) WebSocket simulator (remove reliance on constantly running corona)
 * () Stress tester
 * (X) Statuses of all servers
 * (X) Ability to restart all servers
 * (X) See server logs without ssh
 * () Edit configuration into text file
 */
//In Node/io.js most APIs follow a convention of 'error-first, single-parameter' as such:

//process.stdin.resume()
const _resetDatabaseStore = () => {
	return withDatabase((connection) => {
		return connection.pipeline()
			.flushdb()
			.set('serverTime', Date.now())
			.set('bots|nextId', 50000)
			.sadd('bots|usernames', "Not You", "Player202020", "player 50", "Android Guy", "Guy", "You")
			.exec()
			.return('OK')
			.catchReturn('FAIL')
	}).return('OK')
}

const _startServers = (cb) => {
	return serverScripts.syncSettings()
		.tap((serverConfig) => _log('[Server Configs]:', serverConfig))
		.then(_resetDatabaseStore)
		.then(TcpServer.start)
		.then(ApiServer.start)
		.tap(() => cb && cb(true))
		//.then(() => tickerQueue.add('matchUpdates', { timeStart: Date.now() }, {repeat: { cron: '*/1 * * * * *'}})) 		//5 sec tick rate
		//.then(() => tickerQueue.add('roomUpdates', { timeStart: Date.now() }, {repeat: { cron: '*/10 * * * * *'}})) //10 sec tick rate
		.then(() => tickerQueue.removeRepeatable('idle', { cron: '*/1 * * * * *'})) 		//idle ticker
		//.then(() => tickerQueue.add('idle', { timeStart: Date.now() }, {repeat: { cron: '*/1 * * * * *'}, removeOnFail: true, removeOnComplete: true})) 		//idle ticker
		.then((response) => {
			printMemoryUsage('SVROPEN')
			if (process.send) process.send('ready')

/*			setTimeout(() => {setInterval(function(){
				global.gc()
				const used = process.memoryUsage()/!*Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100*!/
				console.log(`[Memory Usage]: MB`, used)

			}, 1000)}, 6000)*/

			return 'OK'
		})
		.then(() => fs.writeFileAsync('/online.txt', Date.now()))
		.return('OK')
		.tapCatch(() => cb && cb(false))
		.catch((err) => {
			_error('[Error]: On Launching', err)
			process.exitCode = 1
			return _closeServers()
		})
}

const _closeServers = (processExit = true) => {

	return Promise.all([
			TcpServer.close(),
			queues.destroyAllQueues(),
			database.close()
		])
		.timeout(10000)
		.tap((result) => {
			_log('[Server] Gracefully shut down servers.', result)
			printMemoryUsage('SVRCLOSE')
		})
		.then(() => fs.writeFileAsync('/online.txt', -1))
		.return('OK')
		.catch((err) => {
			_log('[Server] Abruptly shutdown servers.\n', err)
			process.exitCode = 1
		})
		.finally(() => {processExit && process.exit()})

}

const _onUnhandledError = (err) => {
	_log('[Process Error] Uncaught Exception\n%s', err.toString())
	console.log(err, err.stack.split('\n'))
	process.exitCode = 1
	return _closeServers()
}

const _onUnhandledRejection = (err) => {
	_log('[Process Error] unhandledRejection\n%s', err.toString())
	console.log(err, err.stack.split('\n'))
	process.exitCode = 1
	return _closeServers()
}
//***************************************************************************//

//process.on('exit', () => _closeServers('exit')) //If the process is exiting
process.once('SIGINT', ()=>_closeServers('SIGINT')) //Listen for exit events; Catch SIGINT and close server gracefully
process.once('SIGTERM', ()=>_closeServers('SIGTERM')) //Catch SIGTERM and close server gracefully
process.once('uncaughtException', _onUnhandledError) //Process any uncaught exceptions
process.once('unhandledRejection', _onUnhandledRejection)

//***************************************************************************//

module.exports = {
	init(cb) {
		return _startServers(cb)
	},
	destroy(cb) {
		return cb(_closeServers())
	}}

if(!process.env.MOCHA) {
	console.log('start servers')
	setImmediate(() => _startServers())
}

