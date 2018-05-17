"use strict"
let apm = require('elastic-apm-node').start({
	serviceName: 'httpServer'
})
const debug     = require('debug') //https://github.com/visionmedia/debug
debug.log = console.info.bind(console) //one all send all to console.
const _log = debug('httpServer')
const _error = debug('httpServer:err')

process.title = 'node_http_server'

//npm/node modules
const Promise 	= require('bluebird') //http://bluebirdjs.com/docs/api-reference.html

const store       = require('./store')
store.createStore()
const database = store.database

//queues
const ApiEventQueue = require('./eventQueue/ApiEventQueue')()
const ApiServer = require('./server/ApiServer')()
const serverScripts = Promise.promisifyAll(require('./scripts/server'))

//process.stdin.resume()

const _startServers = (cb) => {
	return serverScripts.syncSettings()
		.tap((serverConfig) => _log('[Server Configs]:', serverConfig))
		.tap(() => {

			_log(ApiServer)
		})
		.then((serverConfig) => {
			_log('c2fg', store.setConfig(serverConfig))
			return ApiServer.start()
		})
		.tap(() => cb && cb(true))
		.then(() => {
			if (process.send) process.send('ready')
			return 'OK'
		})
		.tapCatch((err) => cb && cb(false))
		.catch((err) => {
			_error('[Error]: On Launching', err)
			return _closeServers(err)
		})
}
//***************************************************************************//

const _closeServers = (processExit = true) => {

	return Promise.all([
			ApiServer.close(),
			ApiEventQueue.close(),
			database.close()
		])
		.timeout(10000)
		.then((result) => _log('[Server] Gracefully shut down http servers.', result))
		.return('OK')
		.catch((err) => {
			_error('[Server] Abruptly shutdown servers.\n', err)
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
	_log('[Process Error] unhandledRejection:\n%s', err.toString())
	console.log(err, err.stack.split('\n'))
	process.exitCode = 1
	return _closeServers()
}

//***************************************************************************//

//process.on('exit', () => {_closeServers('exit')}) //If the process is exiting
process.once('SIGINT', ()=>_closeServers('SIGINT')) //Listen for exit events; Catch SIGINT and close server gracefully
process.once('SIGTERM', ()=>_closeServers('SIGTERM')) //Catch SIGTERM and close server gracefully
process.once('uncaughtException', _onUnhandledError) //Process any uncaught exceptions
process.once('unhandledRejection', _onUnhandledRejection)

//***************************************************************************//

const used = Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100;
_log(`[Memory Usage]: ${used} MB`)


module.exports = {
	init(cb){ return _startServers(cb) },
	destroy(cb) { return cb(_closeServers()) }
}

if(!process.env.MOCHA) 	setImmediate(() => _startServers())
process.stdin.resume()


