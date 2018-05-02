"use strict"
const debug         = require('debug')      //https://github.com/visionmedia/debug
const _log          = debug('wsProxyClient')
const _error        = debug('wsProxyClient:err')

const net         	= require('net')
const WebSocket		= require('ws')
const uuid5         = require('uuid/v5')    //https://github.com/kelektiv/node-uuid
const TCP_PORT	 	= process.env.TCP_SERVER_PORT

const store			= require('../store')
const clients		= store.clients

//lodash
const _get			= require('lodash/get')
const _isEqual		= require('lodash/isEqual')

const WebSocketProxyClient = (wsSocket, req) => {
	const serverUuid = store.getUuid()
	const maxBufferSize = store.getMaxBufferSize()
	const _address = `${_get(req, 'headers.x-forwarded-for', _get(req, 'connection.remoteAddress', 'invalid'))}:${_get(wsSocket, '_socket.remotePort', Date.now())}`
	const _identifier = uuid5(_address,serverUuid) //use this via server to target
	const _buffer = Buffer.allocUnsafe(maxBufferSize).fill(0)
	const _type = 'proxy'
	_log('[Open Socket proxy]: %s | %s', _address, _identifier)

	const proxySocket = net.createConnection(TCP_PORT)
	const actions = setupSocket(_identifier, wsSocket, proxySocket)

	return clients.addClient({
		_identifier,
		_type,
		...actions, //add additional actions client can perform
		getSocket: () => wsSocket,
		getClientType: () => _type,
		getAddress: () => _address,
		getSessionId: () => _identifier,
		getBuffer: () => _buffer
	})
}

const setupSocket = (identifier, ws, proxySocket) => {
	const heartbeat = () => { ws.isAlive = true}
	const isSocketOpen = () => _isEqual(proxySocket.writable, true)
	const isDestroyed = () => _isEqual(proxySocket.destroyed, true)
	const isWsOpen = () => _isEqual(ws.readyState, WebSocket.OPEN)
	let nodeErr = {}


	//forward to socket
	ws.on('message', (data) => {
		if(!isSocketOpen())  return _error('[Socket] destroyed but has a message')
		else return	proxySocket.write(data)
	})
	ws.on('pong', () => {
		if(isSocketOpen()) return proxySocket.end('[Socket] Error at ping')
		if(isDestroyed()) return _error('[Socket] destroyed but has a ping') //TODO: remove if not needed
		return heartbeat()
	})
	ws.on('close', (code,reason) => {
		_error('[Ws Proxy] close %d: %s',code, reason)
		clients.removeClientById(identifier)
		if(isSocketOpen()) return proxySocket.end()
		if(isDestroyed()) return _error('[Socket] destroyed - ws is closed') //TODO: remove if not needed
	})
	ws.on('error', (err) => {
		_error('[Ws Proxy] error',err)
		clients.removeClientById(identifier)
		if(isSocketOpen()) return proxySocket.end()
		if(isDestroyed()) return _error('[Socket] destroyed - ws has a err') //TODO: remove if not needed
	})

	//socket proxy | Note: This is different than setupTcpSocket (server's view of the socket)
	//this socket are the event listeners for the client's view
	proxySocket.setNoDelay(true)
	proxySocket.setKeepAlive(true, 300 * 1000)
	proxySocket.setEncoding('utf-8')
	proxySocket.on('data', (data) => {
		if(!isWsOpen()) return (isSocketOpen()) ? proxySocket.end() : _log('WebSocket is already closed')
		ws.send(data)
	})
	proxySocket.on('close', (hasError) => {
		_log('[Proxy Socket] has closed', hasError)
		if(isWsOpen()){
			_log('[Proxy Socket] sending terminate to parent ws')
			ws.send(JSON.stringify({event: 'statusChange', id: 'connected', status: false}))
			ws.close(nodeErr.code, nodeErr.message)
		}
	})
	proxySocket.on('error', (err) => {
		_log('[Proxy Socket] has error', err)
		nodeErr = {code: 99, message: err.message.toString()}
		if(isWsOpen()) {
			_log('[Proxy Socket] sending close w/ err to parent ws')
			ws.close(nodeErr.code, nodeErr.message)
		}
		proxySocket.end()
	})
	proxySocket.on('timeout', () => {
		_log('[Proxy Socket] has timed out')
		if(isWsOpen()){
			_log('[Proxy Socket] sending terminate to parent ws')
			ws.send('timeout',{},() => ws.close(nodeErr.code, nodeErr.message))
		}
		proxySocket.end()
	})

	//Event 'emitters'
	return {
		send: (message) => {
			if(isDestroyed()) return _error('[Socket] is destroyed, skipping')
			if(!isWsOpen()) return _error('[Socket ws] not open, skipping.')
			if(!isSocketOpen()) return _error('[Socket tcp] not open, skipping.')
			return ws.send(message)/*
			return retry(() => settleAll([ws.send(message)]), 5)
				.then((err, result) => {
					_error(err)
					_log(result)
				});*/
		}
	}
}
module.exports = WebSocketProxyClient
