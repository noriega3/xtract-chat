import {WS_CLEAR_LOG, WS_CLOSE, WS_CONNECTING, WS_MESSAGE, WS_OPEN, WS_REQ_RECONNECT, WS_REQ_SEND} from '../middleware/websocket'
import _ from 'lodash'
const parseJson = (str) => _.attempt(JSON.parse.bind(null, str))

const initialState = {
	list: [],
	counts: {},
	data: {},
	subscribers: {}
}

const handleInit = (state, data) => {
	state.sessionId = _.get(data, 'response.sessionId')
	state.userId = _.get(data, 'response.userId')
	state.appName = _.get(data, 'response.appName')
	state.isInited = false
	state.subscriptions = _.union(state.subscriptions,[data.room])
}

const handleSubscribed = (state, data) => {
	//check if response body room name and if session id matches
	const sessionId = _.get(data, 'response.sessionId', 'invalid')
	const roomName = _.get(data, 'response.room', 'invalid')
	const roomSubs = _.get(state.subscribers, roomName, [])

	state.list = _.union(state.list,[roomName])
	state.subscribers[roomName] = _.union(roomSubs,[sessionId])
}

const handleUnsubscribed = (state, data) => {
	//check if response body room name and if session id matches
	const sessionId = _.get(data, 'response.sessionId', 'invalid')
	const roomName = _.get(data, 'response.room', 'invalid')
	const roomSubs = _.get(state.subscribers, roomName, [])

	state.list = _.without(state.list,roomName)
	state.subscribers[roomName] = _.without(roomSubs,sessionId)
}

export default function (state = initialState, action) {
	const isClientWs = _.isEqual(_.get(action, 'payload.wsId'), 'webclient')
	if(!isClientWs) return state

	const type = _.get(action, 'type', 'invalid')
	const rawMessage = _.get(action, 'payload.data', '{"sessionId": "server", "message": "invalid message"}')
	let newState = _.cloneDeep(state)
	if(!_.isString(rawMessage)) return state
	let newMessageRec
	let formatRecMsg

	switch (type) {
		case WS_MESSAGE:
			formatRecMsg = _.trimStart(rawMessage, '__INIT__')
			formatRecMsg = _.trimStart(rawMessage, '__JSON__START__')
			formatRecMsg = _.trimEnd(formatRecMsg, '__JSON__END__')
			formatRecMsg = _.trimEnd(formatRecMsg, '__ENDINIT__')
			if(parseJson(formatRecMsg)){
				formatRecMsg = parseJson(formatRecMsg)

				//specific for subscribe
				if(_.isEqual('subscribed',_.get(formatRecMsg, 'phase'))){
					handleSubscribed(newState, formatRecMsg)
				}
				//specific for unsubscribe
				if(_.isEqual('unsubscribed',_.get(formatRecMsg, 'phase'))){
					handleUnsubscribed(newState, formatRecMsg)
				}

				//TODO: hook into a roomUpdate message to verify # of subs per room
			}
			return {...state, ...newState}
		default:
			return state
	}
}
