"use strict"
//npm/node modules
const Promise 	= require('bluebird') //http://bluebirdjs.com/docs/api-reference.html
const cluster	= require('cluster')
const debug 	= require('debug') //https://github.com/visionmedia/debug
debug.log = console.info.bind(console) //one all send all to console.

//globals
const SERVER_NAME   = process.env.SERVER_NAME
const store			= require('./store')
store.createStore()

//create node server
const Wss = require('./server/WebSocketServer')
const WebSocketDashboard = Wss({port: process.env.WS_SERVER_CONNECTOR_PATH, path: process.env.WS_CLIENT_CONNECTOR_PATH})
const WebSocketProxyServer = Wss({port: process.env.WS_CLIENT_SIMULATOR_PATH, path: process.env.WS_CLIENT_CONNECTOR_PATH})
store.servers.addServer(WebSocketDashboard)
store.servers.addServer(WebSocketProxyServer)

let _logserver, _log, _error
if(cluster.isWorker) {
	_log 		= debug(SERVER_NAME + ':' + cluster.worker.id)
	_logserver	= debug('wsServer:' + cluster.worker.id)
	_error	= debug('wsServer:' + cluster.worker.id)
	_logserver('[WORKER ID]:', cluster.worker.id)
	_logserver('[WORKER ID]:', cluster.worker.id)
} else {
	_log 		= debug(SERVER_NAME)
	_logserver	= debug('wsServer')
	_error	= debug(SERVER_NAME)
}

const _closeServers = (err, processExit = true) => {
	return Promise.all([WebSocketProxyServer.close(err), WebSocketDashboard.close(err)])
		.timeout(5000)
		.then(() => _logserver('[Server] Gracefully shut down ws servers.'))
		.then(() =>	process.stdout.write("\\033c"))
		.finally(() => processExit ? process.exit(1) : 'OK')
		.catch((err) => _logserver('[Server] Abruptly shutdown servers.\n', err))
}

const _onUnhandledError = (err) => {
	_log('[Process Error] Uncaught Exception\n%s', err.toString())
	console.log(err, err.stack.split('\n'))
	return _closeServers(err, true)
}
const _onUnhandledRejection = (err) => {
	_log('[Process Error] unhandledRejection: ', err.toString())
	console.log(err, err.stack.split("\n"))
	process.exit(1)
	throw err
}
//***************************************************************************//

process.on('exit', () => _closeServers('exit')) //If the process is exiting
process.on('SIGINT', () => _closeServers('SIGINT')) //Listen for exit events; Catch SIGINT and close server gracefully
process.on('SIGTERM', () => _closeServers('SIGTERM')) //Catch SIGTERM and close server gracefully
process.on('uncaughtException', _onUnhandledError) //Process any uncaught exceptions
process.on('unhandledRejection', _onUnhandledRejection)

//***************************************************************************//
process.stdin.resume()

Promise.all([WebSocketDashboard.start(), WebSocketProxyServer.start()])
	.then(() => {
		_logserver('[Server]:  WS Servers Launched')
		process.stdin.resume()
	})
	.catch((err) => {
		_error('[Error]: On Config\n%s', err.toString())
		process.exit(1)
	})

