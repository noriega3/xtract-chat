const WebSocket		= require('ws')
const uuid5         = require('uuid/v5')    //https://github.com/kelektiv/node-uuid
const debug         = require('debug')      //https://github.com/visionmedia/debug
const _log          = debug('wsClient')
const _error        = debug('wsClient:err')
const store			= require('../store')
const clientUtil	= require('./clientUtil')
const get			= require('lodash/get')

const WebSocketClient = (wsSocket, req) => {
	const serverUuid = store.getUuid()
	const maxBufferSize = store.getMaxBufferSize()
	const _type = 'ws'
	const _address = `${get(req, 'headers.x-forwarded-for', get(req, 'connection.remoteAddress', 'invalid'))}:${get(wsSocket, '_socket.remotePort', Date.now())}`
	const _identifier = uuid5(_address,serverUuid) //use this via server to target
	const _buffer = Buffer.allocUnsafe(maxBufferSize).fill(0)

	_log('[Open Socket ws]: %s | %s', _address, _identifier)
	const actions = setupSocket(_identifier, wsSocket)

	return store.clients.addClient({
		_identifier,
		_type,
		...actions, //add additional actions client can perform
		getClientType: () => _type,
		getAddress: () => _address,
		getSessionId: () => _identifier,
		getBuffer: () => _buffer,
	})
}

const setupSocket = (identifier, ws) => {
	ws.on('message', (data) => clientUtil._handleSocketData(identifier, ws, data))
	ws.on('error', (...args) => {
		ws.terminate()
		clientUtil._handleSocketError(identifier, ws,args)
	})
	ws.on('close', (...args) => clientUtil._handleSocketClose(identifier, ws, args))
	ws.on('timeout', (...args) => clientUtil._handleSocketTimeout(identifier, ws, args))

	return {
		send: (message, cb) => {
			if (!_.isEqual(ws.readyState, WebSocket.OPEN)) return _error('[Socket] not open, skipping.')

			if (!ws.send(message))
				ws.once('drain', cb)
			else
				process.nextTick(cb)
		}
	}
}
module.exports = WebSocketClient
