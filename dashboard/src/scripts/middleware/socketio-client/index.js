import partial from 'lodash/fp/partial'
import {compose} from 'redux'

const io = require('socket.io-client')


export const WEBSOCKET_CONNECTING = '@@ws/CONNECTING'
export const WEBSOCKET_CONNECTED = '@@ws/CONNECTED'
export const WEBSOCKET_DISCONNECTED = '@@ws/DISCONNECTED'
export const WEBSOCKET_FAILURE = '@@ws/FAILURE'

export const WEBSOCKET_MESSAGE = '@@ws/MESSAGE'
export const WEBSOCKET_ERROR = '@@ws/ERROR'

export const REGISTER_REQUEST = '@@ws/REGISTER_REQUEST'
export const REGISTER_SUCCESS = '@@ws/REGISTER_SUCCESS'
export const REGISTER_FAILED = '@@ws/REGISTER_FAILED'

export const JOIN_REQUEST = '@@ws/JOIN_REQUEST'
export const JOIN_SUCCESS = '@@ws/JOIN_SUCCESS'
export const JOIN_FAILED = '@@ws/JOIN_FAILED'

export const MSG_REQUEST = '@@ws/MSG_REQUEST'
export const MSG_SUCCESS = '@@ws/MSG_SUCCESS'
export const MSG_FAILED = '@@ws/MSG_FAILED'

export const STATUS_REQUEST = '@@ws/STATUS_REQUEST'
export const STATUS_SUCCESS = '@@ws/STATUS_SUCCESS'
export const STATUS_FAILED = '@@ws/STATUS_FAILED'

export const LEAVE_REQUEST = '@@ws/LEAVE_REQUEST'
export const LEAVE_SUCCESS = '@@ws/LEAVE_SUCCESS'
export const LEAVE_FAILED = '@@ws/LEAVE_FAILED'

let socket = null;
let state = 'init';
let listeners = new Map();

export function createWsMiddleware() {
	return ({dispatch}) => next => action => {
		if(!socket) {
			console.log('socket does not exist yet for this call', action.type)
			return next(action)
		}

		const dispatchAction = dispatch;
		let isDisconnected = state === WEBSOCKET_DISCONNECTED

		switch(action.type){
			case REGISTER_REQUEST:
				if(isDisconnected) return dispatchAction({type:REGISTER_FAILED, payload: 'disconnected'})
				socket.emit('register', action.payload, (err, res) => {
					if(err)	return dispatchAction({type:REGISTER_FAILED, payload: err})
					return dispatchAction({type:REGISTER_SUCCESS, payload: res})
				});
				break;
			case JOIN_REQUEST:
				if(isDisconnected) return dispatchAction({type:JOIN_FAILED, payload: 'disconnected'})
				socket.emit('join', action.payload, (err, res) => {
					if(err)	return dispatchAction({type:JOIN_FAILED, payload: err})

					//register callback if added
					if(action.meta.listener) listeners.set(action.payload, action.meta.listener)

					return dispatchAction({type:JOIN_SUCCESS, payload: res})
				});
				break;
			case MSG_REQUEST:
				if(isDisconnected) return dispatchAction({type:MSG_FAILED, payload: 'disconnected'})
				socket.emit('message', action.payload, (err, res) => {
					if(err)	return dispatchAction({type:MSG_FAILED, payload: err})
					return dispatchAction({type:MSG_SUCCESS, payload: res})
				});
				break;
			case STATUS_REQUEST:
				if(isDisconnected) return dispatchAction({type:STATUS_FAILED, payload: 'disconnected'})
				socket.emit('status', action.payload, (err, res) => {
					if(err)	return dispatchAction({type:STATUS_FAILED, payload: err})
					return dispatchAction({type:STATUS_SUCCESS, payload: res})
				});
				break;
			case LEAVE_REQUEST:
				if(isDisconnected) return dispatchAction({type:LEAVE_FAILED, payload: 'disconnected'})
				socket.emit('leave', action.payload, (err, res) => {
					if(err)	return dispatchAction({type:LEAVE_FAILED, payload: err})
					listeners.delete(action.payload)
					return dispatchAction({type:LEAVE_SUCCESS, payload: res})
				});
				break;
		}

		return next(action)
	}
}

export default function (store) {
	/* eslint-disable */
	socket = io.connect('http://localhost:1234')
	/* eslint-enable */

	store.dispatch({type: WEBSOCKET_CONNECTING, payload: {}});

	socket.on('error', function (err) {
		console.log('received socket error:')
		console.log(err)
	})

	socket.on('connect', (data = {}) => {
		state = WEBSOCKET_CONNECTED
		store.dispatch({type: WEBSOCKET_CONNECTED, payload:data});
		listeners.clear() //TODO: check if reconnect calls on connect again
	});

	socket.on('disconnect', (data = {}) => {
		state = WEBSOCKET_DISCONNECTED
		store.dispatch({type: WEBSOCKET_DISCONNECTED, payload:data});
		listeners.clear()
	});

	socket.on('server:error', (data) => {
		store.dispatch({type:WEBSOCKET_ERROR, payload: data});
	});

	socket.on('server:close', (data) => {
		store.dispatch({type: WEBSOCKET_MESSAGE, payload:data});
	});

	socket.on('server:message', (data) => {
		if(listeners.has(data.room))
			listeners.get(data.room)(data.event, data.message)
		else
			store.dispatch({type: WEBSOCKET_MESSAGE, payload:data});
	});
}
