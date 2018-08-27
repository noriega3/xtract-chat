import {WS_CLOSE, WS_CONNECTING, WS_MESSAGE, WS_OPEN} from './index'

export const handleOnConnecting = (event, {wsId}) => ({
	type: WS_CONNECTING,
	payload: {
		timestamp: new Date(),
		wsId,
		event
	}
})

export const handleOnOpen = (event, {wsId}) => ({
	type: WS_OPEN,
	payload: {
		timestamp: new Date(),
		wsId,
		event
	}
})

export const handleOnClose = (event, {wsId}) => ({
	type: WS_CLOSE,
	payload: {
		timestamp: new Date(),
		wsId,
		event
	}
})

export const handleOnMessage = (event, {wsId}) => ({
	type: WS_MESSAGE,
	payload: {
		timestamp: new Date(),
		wsId,
		data: event.data,
		event
	}
});

export default {}
