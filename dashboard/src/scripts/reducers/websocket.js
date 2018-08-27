import jwtDecode from 'jwt-decode'
import * as auth from '../actions/apiAuthActions'
import * as ws from '../middleware/socketio-client'
import _ from 'lodash'

const initialState = {
	connected: false,
	registered: false,
	registering: false,
	messages: [],
	rooms: [],
	lastJoinedRoom: '',
	lastLeftRoom: '',
	lastMessage: {},
	lastError: ''
}

export default function (state = initialState, action) {
	const type = _.get(action, 'type', 'invalid')
	switch (type) {
		case ws.WEBSOCKET_CONNECTED:
			return {
				...initialState,
				connected: true
			}
		case ws.WEBSOCKET_DISCONNECTED:
			return {...initialState}
		case ws.REGISTER_REQUEST:
			return {
				...state,
				registering: true
			}
		case ws.REGISTER_SUCCESS:
			return {
				...state,
				registering: false,
				registered: true
			}
		case ws.MSG_RECEIVED:
			return {
				...state,
				messages: state.messages.concat(action.payload),
				message: action.payload,
			}
		case ws.JOIN_SUCCESS:
			return {
				...state,
				rooms: _.union(state.rooms, [action.payload.room]),
				lastJoinedRoom: action.payload.room
			}
		case ws.LEAVE_SUCCESS:
			return {
				...state,
				rooms: _.without(state.rooms, [action.payload.room]),
				lastLeftRoom: action.payload.room
			}
		case ws.WEBSOCKET_FAILURE:
		case ws.WEBSOCKET_ERROR:
		case ws.REGISTER_FAILED:
		case ws.JOIN_FAILED:
		case ws.MSG_FAILED:
		case ws.STATUS_FAILED:
		case ws.LEAVE_FAILED:
			return {
				...state,
				lastError: action.payload
			}
		default:
			return state
	}
}

export function isConnected(state){
	return state.connected
}

export function lastJoinedRoom(state){
	return state.lastJoinedRoom
}

export function lastLeftRoom(state){
	return state.lastLeftRoom
}

export function isRegistered(state){
	return !state.registering && state.registered
}

export function isRegistering(state){
	return state.registering
}

export function lastError(state){
	return state.lastError
}
