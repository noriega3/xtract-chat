import _ from 'lodash'
import {WS_CLEAR_LOG, WS_REQ_CLOSE, WS_REQ_CONNECT, WS_REQ_RECONNECT, WS_REQ_SEND} from '../middleware/websocket'
const wssUrl = process.env.WS_SIMULATOR_URL

const wsId = 'webclient'

/* Utility Function */
const _isJson = function(str){
	try {
		JSON.parse(str);
	} catch (e) {
		return false;
	}
	return true;
}

export const sendConnect = () => ({
	type: WS_REQ_CONNECT,
	payload:{
		wsId: wsId,
		url: wssUrl,
	}
})
export const sendReconnect = () => ({
	type: WS_REQ_RECONNECT,
	payload: {
		wsId: wsId,
		url: wssUrl
	}
})

export const sendClose = () => ({
	type: WS_REQ_CLOSE,
	payload: {
		wsId: wsId,
		url: wssUrl
	}
})

export const sendMessage = (message, objRequest) => {
	const isJSON = _isJson(objRequest)
	let request = objRequest
	if(_.isString(request) && isJSON) {request = JSON.parse(objRequest)}

	return ({
		type: WS_REQ_SEND,
		url: wssUrl,
		payload: {
			wsId: wsId,
			url: wssUrl,
			parsed: request,
			message: message
		}
	})
}

export const sendConfirmInit = (sessionId, initEventId) => {

	const request = {
		sessionId: sessionId,
		intent: 'confirmInit',
		params: {initEventId}
	}
	return ({
		type: WS_REQ_SEND,
		url: wssUrl,
		payload: {
			wsId: wsId,
			url: wssUrl,
			parsed: request,
			message: `__JSON__START__${JSON.stringify(request, null, 2)}__JSON__END__`,
			confirmInit: true
		}
	})
}

export const sendConfirmEventId = (sessionId, eventId) => {

	const request = {
		sessionId: sessionId,
		intent: 'eventConfirm',
		eventId: eventId
	}
	return ({
		type: WS_REQ_SEND,
		url: wssUrl,
		payload: {
			wsId: wsId,
			url: wssUrl,
			parsed: request,
			message: `__JSON__START__${JSON.stringify(request, null, 2)}__JSON__END__`,
		}
	})
}

export const clearMessages = () => ({
	type: WS_CLEAR_LOG,
	payload: {
		wsId: wsId,
		url: wssUrl,
		message: 'clearMessages'
	}
})

export const sendChatMessage = (sessionId, userId, room, message) => {

	console.log('send chat')
	//TODO: dynamically hook in an eventId
	//TODO: restructure to the intent/params format
	const request = {
		eventId: `${userId}|sendChatToRoom|${Date.now()}`,
		intent: 'sendChatToRoom',
		sessionId,
		userId,
		room,
		message
	}

	console.log('req send', request)

	return ({
		type: WS_REQ_SEND,
		url: wssUrl,
		payload: {
			wsId: wsId,
			url: wssUrl,
			parsed: request,
			message: `__JSON__START__${JSON.stringify(request, null, 2)}__JSON__END__`
		}
	})
}
