"use strict"
const debug         = require('debug')      //https://github.com/visionmedia/debug
const _log          = debug('tcpClient')
const _error        = debug('tcpClient:err')

const Promise		= require('bluebird')
const uuid5         = require('uuid/v5')    //https://github.com/kelektiv/node-uuid

const _isEqual		= require('lodash/isEqual')
const _get			= require('lodash/get')

const store			= require('../store')
const clients		= store.clients
const {
	_handleSocketData,
	_handleSocketError,
	_handleSocketClose,
	_handleSocketTimeout
} = require('./clientUtil')

console.log('new tcp client module file')

//https://stackoverflow.com/questions/12180790/defining-methods-via-prototype-vs-using-this-in-the-constructor-really-a-perfo
//TODO: convert using prototypes on the getters

/**
 * Main function, handles a creation of a socket instance, and bridges the connection with a redis instance
 * @param socket
 */
module.exports = (socket) => {
	const serverUuid = store.getUuid()
	const maxBufferSize = store.getMaxBufferSize()
	const _type = 'tcp'
	const _address = `${_get(socket, 'remoteAddress', Date.now())}:${_get(socket, 'remotePort', Date.now())}`
	const _identifier = uuid5(_address,serverUuid) //use this via server to target
	const _buffer = Buffer.allocUnsafe(maxBufferSize).fill(0)
	let _writeQueue = 0

	_log('[Open Socket tcp]: %s | %s', _address, _identifier)

	//setup tcp socket
	socket.setNoDelay()
	socket.setKeepAlive(true, 300 * 1000)
	socket.setEncoding('utf-8')

	socket.writeAsync = function(message){
		if(!message) throw new Error('INVALID MESSAGE')

		const writeToSocket = Promise.method(() => {
			const isDestroyed = _isEqual(_get(socket, 'destroyed', false), true)
			if(isDestroyed) return Promise.reject(new Error('SOCKET DESTROYED'))
			_writeQueue++

			return Promise.fromCallback(function(callback){
				if(!socket.write(message,() => {
					_writeQueue--
					_log('message queue -1 is ', _writeQueue)
					callback(false, true)
				})){
					callback(new Error('WAIT'))
				}
			})
		})

		return Promise.delay(_writeQueue*500)
			.then(()=> writeToSocket())
			.return('OK')
			.catch((err) => {
				if(_writeQueue > 10) throw new Error('BACKLOG FULL')
				if(_isEqual(err.message, 'WAIT')){
					//going to have to wait..
					_log('[Note]: socket message is backlogged, will write when session msg queue is empty')
					_log('[Note]: message queue is ', _writeQueue)
					return true
				}
				if(_isEqual(err.message, 'SOCKET DESTROYED')){
					_log('SOCKET DESTROYED')
					return true
				}
				throw err
			})
			.tapCatch((err) => {
				_error('after other catch', err.message)
			})

	}

	socket.on('data', (data) => {
		if(!_handleSocketData(_identifier, socket, data)){
			socket.writeAsync({
				error: 'invalid jwt'
			})
		}
	})
	socket.once('error', (err) => {
		_error('[Socket] has an error', err)
		_handleSocketError(_identifier, socket,err)
	})
	socket.once('close', (hasError) => {
		_log('socket close', _identifier)
		_handleSocketClose(_identifier, socket,hasError)
		_writeQueue = null
	})
	socket.once('timeout', () => {
		_log('socket timeout', _identifier)
		_handleSocketTimeout(_identifier, socket)
	})

	//fix stupid pauseOnConnect
	socket.resume()

	return clients.addClient({
		_identifier,
		_type,
		getSocket: () => socket,
		getClientType: () => _type,
		getAddress: () => _address,
		getSessionId: () => _identifier,
		getBuffer: () => _buffer,
		send(message) {	return socket.writeAsync(message) }
	})
}
