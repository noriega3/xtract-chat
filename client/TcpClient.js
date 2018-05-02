const Promise		= require('bluebird')
const uuid5         = require('uuid/v5')    //https://github.com/kelektiv/node-uuid
const debug         = require('debug')      //https://github.com/visionmedia/debug
const _log          = debug('tcpClient')
const _error        = debug('tcpClient:err')
const store			= require('../store')
const clients		= store.clients
const _				= require('lodash')
const clientUtil	= require('./clientUtil')
const get			= require('lodash/get')
const _isEqual		= require('lodash/isEqual')

/**
 * Main function, handles a creation of a socket instance, and bridges the connection with a redis instance
 * @param socket
 */
const TcpClient = (socket) => {
	const serverUuid = store.getUuid()
	const maxBufferSize = store.getMaxBufferSize()
	const _type = 'tcp'
	const _address = `${get(socket, 'remoteAddress', Date.now())}:${get(socket, 'remotePort', Date.now())}`
	const _identifier = uuid5(_address,serverUuid) //use this via server to target
	const _buffer = Buffer.allocUnsafe(maxBufferSize).fill(0)
	_log('[Open Socket tcp]: %s | %s', _address, _identifier)

	const actions = setupSocket(_identifier, socket)
	return clients.addClient({
		_identifier,
		_type,
		...actions, //add additional actions client can perform
		getSocket: () => socket,
		getClientType: () => _type,
		getAddress: () => _address,
		getSessionId: () => _identifier,
		getBuffer: () => _buffer
	})
}
const isDestroyed = (socket) => _isEqual(socket.destroyed, true)
const setupSocket = (identifier, socket) => {

	//setup tcp socket
	socket.setNoDelay()
	socket.setKeepAlive(true, 300 * 1000)
	socket.setEncoding('utf-8')

	socket.on('data', (data) => {
		clientUtil._handleSocketData(identifier, socket, data)
	})
	socket.on('error', (err) => {
		_error('[Socket] has an error', err)
		clientUtil._handleSocketError(identifier, socket,err)
	})
	socket.on('close', (hasError) => {
		_log('socket close', identifier)
		return clientUtil._handleSocketClose(identifier, socket,hasError)
	})
	socket.on('timeout', () => {
		_log('socket timeout', identifier)
		clientUtil._handleSocketTimeout(identifier, socket)
	})
	socket.on('drain', () => { _log('socket drained')})
	socket.on('lookup', () => {	_log('socket lookup')})

	//fix stupid pauseOnConnect
	socket.resume()

	socket._writeQueue = 0
	socket.writeAsync = function(message){
		if(!message) throw new Error('INVALID MESSAGE')

		const writeToSocket = () => {
			if(isDestroyed(socket)) throw new Error('SOCKET DESTROYED')
			socket._writeQueue++;
			return new Promise(function(resolve, reject){
				if(!socket.write(message,() => {
					socket._writeQueue--
					console.log('message queue -1 is ', socket._writeQueue)
					resolve(true)
				})){
					reject(new Error('WAIT'))
				}
		})}

		return Promise.delay(socket._writeQueue*500)
			.then(()=> writeToSocket())
			.return('OK')
			.catch((err) => {
				if(socket._writeQueue > 10) throw new Error('BACKLOG FULL')
				if(_.isEqual(err.message, 'WAIT')){
					//going to have to wait..
					_log('[Note]: socket message is backlogged, will write when session msg queue is empty')
					_log('[Note]: message queue is ', socket._writeQueue)
					return true
				}
				if(_.isEqual(err.message, 'SOCKET DESTROYED')){
					console.log('SOCKET DESTROYED')
					return true
				}
				throw err
			})
			.tapCatch((err) => {
				_error('after other catch', err.message)
			})

	}

	//Event 'emitters'
	return {
		send: (message) => {
			return socket.writeAsync(message)

			//return socket.write(message)
			/*return retry(() => settleAll([socket.write(message)]), 5)
				.then((err, result) => {
					_error(err, err.toString())
					_log(result)
				});*/
		}
	}
}

module.exports = TcpClient

