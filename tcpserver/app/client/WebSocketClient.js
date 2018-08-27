const WebSocket		= require('ws')
const uuid5         = require('uuid/v5')    //https://github.com/kelektiv/node-uuid
const debug         = require('debug')      //https://github.com/visionmedia/debug
const _log          = debug('wsClient')
const _error        = debug('wsClient:err')
const {getUuid, getMaxBufferSize, clients:{addClient}} = require('../store')
const {
	_handleSocketData,
	_handleSocketError,
	_handleSocketClose,
	_handleSocketTimeout
} = require('./clientUtil')

const _get			= require('lodash/get')
const _isEqual		= require('lodash/isEqual')

const WebSocketClient = (wsSocket, req) => {
	const serverUuid = getUuid()
	const maxBufferSize = getMaxBufferSize()
	const _type = 'ws'
	const _address = `${_get(req, 'headers.x-forwarded-for', _get(req, 'connection.remoteAddress', 'invalid'))}:${_get(wsSocket, '_socket.remotePort', Date.now())}`
	const _identifier = uuid5(_address,serverUuid) //use this via server to target
	const _buffer = Buffer.allocUnsafe(maxBufferSize).fill(0)

	_log('[Open Socket ws]: %s | %s', _address, _identifier)

	wsSocket.on('message', (data) => _handleSocketData(_identifier, wsSocket, data))
	wsSocket.on('error', (...args) => {
		wsSocket.terminate()
		_handleSocketError(_identifier, wsSocket,args)
	})
	wsSocket.on('close', (...args) => _handleSocketClose(_identifier, wsSocket, args))
	wsSocket.on('timeout', (...args) => _handleSocketTimeout(_identifier, wsSocket, args))

	return addClient({
		_identifier,
		_type,
		getClientType() {return _type},
		getAddress(){ return _address},
		getSessionId(){ return _identifier},
		getBuffer(){ return _buffer},
		send: (message, cb) => {
			if (!_isEqual(wsSocket.readyState, WebSocket.OPEN)) return _error('[Socket] not open, skipping.')

			if (!wsSocket.send(message))
				wsSocket.once('drain', cb)
			else
				process.nextTick(cb)
		}
	})
}
module.exports = WebSocketClient
