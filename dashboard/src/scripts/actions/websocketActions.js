import * as ws from '../middleware/socketio-client'

export const register = (user) =>({
	type: ws.REGISTER_REQUEST,
	payload: user
})

export const joinRoom = (room, listener) =>({
	type: ws.JOIN_REQUEST,
	payload: room,
	meta: {listener}
})

export const leaveRoom = (roomName) =>({
	type: ws.LEAVE_REQUEST,
	payload: roomName
})

export const sendMessage = (roomName) =>({
	type: ws.MSG_REQUEST,
	payload: roomName
})

export const getStatus = (roomName) =>({
	type: ws.STATUS_REQUEST,
	payload: roomName
})
