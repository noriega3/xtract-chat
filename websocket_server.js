'use strict'
const express 	= require('express')
const http 		= require('http')
const WebSocket	= require('ws')
const helmet 	= require('helmet')
const debug     = require('debug') //https://github.com/visionmedia/debug

const SERVER_NAME   		= require('./globals').getVariable("SERVER_NAME")
const DashboardClientBridge	= require('./_client/ws_pubsub_bridge') //extracts the message from the ws socket.

const _log = debug('ws')
const _logserver = debug('ws_server')

const app = express()
let server = http.Server(app)
let wsServer = new WebSocket.Server({ server: server, path: '/dashboard'})

app.use(helmet())
app.disable('x-powered-by')

/**
 * Cleanup when server closes
 */
const _onNodeClose = (exitCode) => {

	if(wsServer){
		for(let client of wsServer.clients) {
			if (client.readyState === WebSocket.OPEN) {
				client.send(JSON.stringify({response: 'CLOSED'}))
				client.terminate()
				client = null
			}
		}
		wsServer = null
	}


	if(server){
		server.close((err) => {
			process.stdout.write("\\033c")
			process.exit(err ? 1 : 0)
			server = null
		})
	} else {
		process.exit(0)
	}


	_logserver('[On WS Close] Code: %s', exitCode)
}

wsServer.on('connection', socket => new DashboardClientBridge(socket))
wsServer.on('error', err => console.error(err))
wsServer.on('close', () => {
	_logserver("[WS Server] Closed %s", SERVER_NAME)
	_onNodeClose()
})

server.listen(8080, (properties) => {
	if(process.send){
		_log('Websocket Server online')
		process.send('ready')
	}
	_logserver("[WS Server] Listening", properties, SERVER_NAME)
})

_log('Websocket Server is starting up')

process.stdin.resume()

//Listen for exit events
//Catch SIGINT and close server gracefully
process.on('SIGINT', _onNodeClose)

//Catch SIGTERM and close server gracefully
process.on('SIGTERM', _onNodeClose)

/**
 * Process any uncaught exceptions
 */
process.on('uncaughtException', (err) => {
	_log('[Process Error] Uncaught Exception: ', err.toString())
	console.log(err, err.stack.split("\n"))

	process.exit(1)
})

process.on('unhandledRejection', function (err) {
	_log('[Process Error] unhandledRejection: ', err.toString())
	console.log(err, err.stack.split("\n"))

	process.exit(1)
	throw err;
});
