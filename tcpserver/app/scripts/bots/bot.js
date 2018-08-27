"use strict"
const debug         = require('debug')      //https://github.com/visionmedia/debug
debug.log = console.info.bind(console) //one all send all to console.
const _log          = debug('bot')
const _error        = debug('bot:err')

const net 			= require('net')

const _get 			= require('lodash/get')

const isJson = require('../../util/isJson')
const fromJson = require('../../util/fromJson')

const EventEmitter 	= require('events').EventEmitter
const TCP_PORT		= process.env.TCP_SERVER_PORT
class SubEmitter extends EventEmitter {	constructor(parent) {super(parent)}}

const disconnect = require('./actions/disconnect')
const findAndReserveRoom = require('./actions/findAndReserveRoom')
const publish = require('./actions/publish')
const requestSubscribe = require('./actions/requestSubscribe')
const requestUnSubscribe = require('./actions/requestUnSubscribe')
const reserveRoom = require('./actions/reserveRoom')

const setupActions = (client) => {
	return {
		disconnect 			: disconnect.bind(client),
		findAndReserveRoom	: findAndReserveRoom.bind(client),
		publish 			: publish.bind(client),
		requestSubscribe 	: requestSubscribe.bind(client),
		requestUnSubscribe 	: requestUnSubscribe.bind(client),
		reserveRoom			: reserveRoom.bind(client)
	}
}

const subscribed = require('./listeners/subscribed')
const init = require('./listeners/init')
const confirmInit = require('./listeners/confirmInit')
const reservation = require('./listeners/reservation')
const requestDisconnect = require('./listeners/requestDisconnect')

const attachListeners = (client) => {
	return {
		subscribed 			: subscribed.bind(client),
		init 				: init.bind(client),
		confirmInit			: confirmInit.bind(client),
		reservation 		: reservation.bind(client),
		requestDisconnect 	: requestDisconnect.bind(client)
	}
}



const createSubClient = (data, options) => {
	let client
	const _identifier =  "test" //NOTE: not sessionId
	const _socket = new net.Socket()
	let _emitter = new SubEmitter()
	let _state = "init"
	let _rooms = []
	let _reserves = []
	let _userData = []
	let _actions, _listeners
	let _sessionId = false

	client = {
		_state, _rooms, _reserves, _userData,
		getSessionId: () => _sessionId,
		setSessionId: (newSessionId) => _sessionId = newSessionId,
		getIdentifier: () => _identifier,
		getReserves: () => _reserves,
		getSubscriptions: () => _rooms,
		getEmitter: () => _emitter,
		getUserData: () => _userData,
		getSocket: () => _socket, //TODO: difference between this and addListener logic
		//client.getActions() { return _actions } //TODO: difference between this and addListener logic
		getActions: () => _actions
	}

	_actions = setupActions(client)
	_listeners = attachListeners(client)

	_emitter.once('init', _listeners.init)
	_emitter.on('confirmInit', _listeners.confirmInit)
	_emitter.on('subscribed', _listeners.subscribed)
	_emitter.on('reservation', _listeners.reservation)
	_emitter.on('requestDisconnect', _listeners.requestDisconnect)
	_emitter.on('error', _listeners.requestDisconnect)


	// Set up a client and connect to port 31337 (or whatever port you use)
	_socket.on('close', (hadError) => {
		_emitter.emit('close', hadError)
		_log('[CLOSE]:', hadError)
	})

	_socket.on('connect', () => {
		_log('[CONNECT]: to %s', TCP_PORT)
		_rooms = []
		_reserves = []
		_userData = data
		_socket.write(`__INIT__${JSON.stringify(data)}__ENDINIT__`) // Send some data
	})

	// When data is returned from server
	_socket.on('data', (dataRaw) => {
		if(_state === "disconnecting") return

		console.log('data received')

		//Unlike init, we start from beginning of buffer
		let jsonStart = dataRaw.indexOf('__JSON__START__')
		let jsonEnd = dataRaw.indexOf('__JSON__END__')

		if (jsonStart !== -1 && jsonEnd !== -1) {
			let bufStr = dataRaw.toString('utf8', jsonStart + 15, jsonEnd)

			let response = bufStr && isJson(bufStr) ? JSON.parse(bufStr) : {}
			let phase = (response && response.phase) ? response.phase : false
			let eventId = (response && response.eventId) ? response.eventId : false

			_log('%j', response)
			//Determine route based on phase
			//console.log('emitting', phase, response)
			_emitter.emit(phase, response)

			if(eventId){
				_actions.publish({
					intent: "eventConfirm",
					eventId: eventId
				})
			}
		}
	})

	_socket.on('error', (err) => {
		_error('[ERROR]: ', err.status, err.message)
		console.log(err, err.stack.split("\n"))
		_emitter.emit('error', err)
		_actions.disconnect('destroy', err)
	})

	_socket.on('end', (err) => {
		_error('[END]')
		_emitter.emit('end', err)
		_actions.disconnect('destroy')
	})

	_socket.on('drain', () => {
		_error('[DRAIN]')
		_emitter.emit('drain')
	})

	_socket.on('lookup', (data) => {
		_error('[LOOKUP]:', data)
		_emitter.emit('lookup', data)
	})

	_socket.on('timeout', () => {
		_error('[TIMEOUT]')
		_emitter.emit('timeout')
		_actions.disconnect('destroy')
	})

	//initialize emitter and connection
	_socket.connect({ port: _get(options, 'port', TCP_PORT)})

	return client
}


const _onUnhandledError = (err) => {
	_log('[Process Error] Uncaught Exception\n%s', err.toString())
	console.log(err, err.stack.split('\n'))
}
const _onUnhandledRejection = (err) => {
	_log('[Process Error] unhandledRejection:\n%s', err.toString())
	console.log(err, err.stack.split('\n'))
}

//***************************************************************************//

process.on('uncaughtException', _onUnhandledError) //Process any uncaught exceptions
process.on('unhandledRejection', _onUnhandledRejection)

module.exports = createSubClient
