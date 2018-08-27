/* credits: https://github.com/giantmachines/redux-websocket/blob/master/src/index.js */
/* credits: https://github.com/compulim/redux-websocket-bridge/blob/master/src/index.js */
import { compose } from 'redux';
import _ from 'lodash'
import partial from 'lodash/fp/partial';
import partialRight from 'lodash/fp/partialRight';
import Log
	from '../../../../Log'
import {handleOnOpen, handleOnClose, handleOnMessage, handleOnConnecting} from './actions'
import { createWebsocket, removeWebSocket, findWebSocket } from './websocket';
// Action types to be dispatched by the user
export const WS_REQ_CONNECT = 'WEBSOCKET:CONNECT';
export const WS_REQ_RECONNECT = 'WEBSOCKET:RECONNECT';
export const WS_REQ_CLOSE = 'WEBSOCKET:CLOSE';
export const WS_REQ_SEND = 'WEBSOCKET:SEND';
export const WS_CLEAR_LOG = 'WEBSOCKET:CLEARLOG';
// Action types dispatched by the WebSocket implementation
export const WS_CONNECTING = 'WEBSOCKET:CONNECTING';
export const WS_OPEN = 'WEBSOCKET:OPEN';
export const WS_CLOSE = 'WEBSOCKET:CLOSED';
export const WS_MESSAGE= 'WEBSOCKET:MESSAGE';
export const WS_REQ_CLEARONCONNECT= 'WEBSOCKET:CLEARONCONNECT';
export const WS_REQ= 'WEBSOCKET:REQUEST';

const createMiddleWare = () => {

	/**
	 * A function to create the WebSocket object and attach the standard callbacks
	 */
	const handleConnect = ({ dispatch }, config) => {
		// Instantiate the websocket.
		const ws = createWebsocket(config);
		let client = ws.client

		// Function will dispatch actions returned from action creators.
		const dispatchAction = partial(compose, [dispatch]);

		// Setup handlers to be called like this: dispatch(open(event));
		client.onconnecting = partialRight(dispatchAction(handleOnConnecting), [ws]); //this isn't always called
		client.onopen = partialRight(dispatchAction(handleOnOpen), [ws]);
		client.onclose = partialRight(dispatchAction(handleOnClose), [ws]);
		client.onmessage = partialRight(dispatchAction(handleOnMessage), [ws]);
	};

	const handleSendMessage = (payload) => {
		const ws = findWebSocket(payload)
		if(!_.has(ws, 'client')) return Log.warn('No socket available', 'Socket Component')
		const client = _.get(ws, 'client')
		const wsId = _.get(payload, 'wsId', '')
		const message =_.get(payload, 'message')
		if(_.isEmpty(message)) return Log.warn('No message request supplied for WebSocket', 'Socket Component')
		if(_.has(ws, 'wsId') && _.isEqual(ws.wsId, wsId)){
			client.send(message)
		} else {
			Log.warn('WebSocket is closed, ignoring. Trigger a WS_CONNECT first.', 'Socket Component')
		}
	}

	/**
	 * Close the WebSocket connection and cleanup
	 */
	const handleClose = (config) => {
		let ws = findWebSocket(config)
		if(!_.has(ws, 'client')) return
		let client = ws.client
		client.close()
		removeWebSocket(ws)
	};

	return store => next => action => {
		switch (action.type) {
			// User request to connect
			case WS_REQ_CONNECT:
			case WS_REQ_RECONNECT:
				handleClose(action.payload)
				handleConnect(store, action.payload)
				next(action)
				break
			// User request to send a message
			case WS_REQ_SEND:
				//console.trace();
				action.payload.clientTime = Date.now()
				handleSendMessage(action.payload)
				next(action)
				break
			// User request to disconnect
			case WS_REQ_CLOSE:
				handleClose(action.payload)
				next(action)
				break
			default:
				next(action)
				break
		}
	}
}
export default createMiddleWare()
