import {WS_CLEAR_LOG, WS_REQ_CLOSE, WS_REQ_CONNECT, WS_REQ_RECONNECT, WS_REQ_SEND, WS_REQ} from '../middleware/websocket'
const wssUrl = process.env.WS_CONNECTOR_URL
const wsId = 'dashboard'

export const sendConnect = () => ({
	type: WS_REQ_CONNECT,
	payload:{
		wsId: wsId,
		url: wssUrl
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

export const sendMessageIntent = (intent, params = {}) => ({
	type: WS_REQ_SEND,
	payload: {
		wsId: wsId,
		url: wssUrl,
		request: {...params, intent},
		message: JSON.stringify({...params, intent})
	}
})

export const sendMessage = (params) => ({
	type: WS_REQ_SEND,
	url: wssUrl,
	payload: {
		wsId: wsId,
		url: wssUrl,
		request: {...params},
		message: JSON.stringify({...params})
	}
})

export const clearMessages = () => ({
	type: WS_CLEAR_LOG,
	payload: {
		wsId: wsId,
		url: wssUrl,
		request: 'clearMessages'
	}
})

export const toggleClearOnConnect = () => ({
	type: WS_REQ,
	payload: {
		event: 'toggleClearOnConnect',
		wsId: wsId,
		url: wssUrl
	}
})

export const toggleLogOnConnect = () => ({
	type: WS_REQ,
	payload: {
		event: 'toggleLogOnConnect',
		wsId: wsId,
		url: wssUrl
	}
})
