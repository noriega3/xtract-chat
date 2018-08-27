const debug 	= require('debug') //https://github.com/visionmedia/debug
debug.log = console.info.bind(console) //one all send all to console.
const _log		= debug('wsServer')
const _error	= debug('wsServer:err')

//npm/node modules
const express 	= require('express')
const http 		= require('http')
const WebSocket	= require('ws')
const _ 		= require('lodash')


//Client Types
const WebSocketClient 	= require('../client/WebSocketClient')
const WebSocketProxyClient 	= require('../client/WebSocketProxyClient')
const WebSocketDashboardClient 	= require('../client/WebSocketDashboardClient')

const store 	= require('../store')

const _identifier = 'WebSocketServer'

_log('[Init] %s - WsServer', process.env.SERVER_NAME)

const WebSocketServer = ({port = 8444, path = '/webclient'}) => {
	const _app = express()
	const _httpServer = http.createServer(_app)
	const _wsServer = new WebSocket.Server({ server: _httpServer, path })
	let interval

	_wsServer.on('connection', (wsClient, request) => {
		if(_.isEqual(path, '/webclient')) return WebSocketProxyClient(wsClient, request)
		else if(_.isEqual(path, '/ws')) return WebSocketDashboardClient(wsClient, request)
		else return WebSocketClient(wsClient,request)
	})

	_httpServer.on('close', (wss) => {
		clearInterval(interval)
		if(store.servers.hasServer(_identifier)) store.servers.removeServerById(_identifier)
		if(wss){
			wss.clients.forEach((ws) => {
				if (_.isEqual(ws.readyState, WebSocket.OPEN)){
					ws.terminate()
				}
			})
		}
	})

	_wsServer.on('error', (err) => {
		_error(err)
	})

	_httpServer.on('listening', (properties) => {
		_log("[WS Server] Listening", properties, process.env.SERVER_NAME)
		interval = setInterval(() => {
			_wsServer.clients.forEach((ws) => {
				if(_.isEqual(ws.readyState, WebSocket.OPEN)) {
					ws.terminate()
				} else {
					ws.isAlive = false
					ws.ping()
				}
			});
		}, 30000)
	})

	return store.servers.addServer({
		_identifier,
		getServer: () => _wsServer,
		start: () => _httpServer.listen(port),
		close: () => {
			_wsServer.clients.forEach((ws) => {
				if(_.isEqual(ws.readyState, WebSocket.OPEN)){
					ws.send(JSON.stringify({event: 'statusChange', id: 'connected', status: false}))
					ws.terminate()
				}
			});
			return _httpServer.close()
		}
	})
}
module.exports = WebSocketServer
