import {WS_CLEAR_LOG, WS_CLOSE, WS_CONNECTING, WS_MESSAGE, WS_OPEN, WS_REQ_RECONNECT, WS_REQ_SEND} from '../middleware/websocket'
import _ from 'lodash'
const parseJson = (str) => _.attempt(JSON.parse.bind(null, str))

const initialState = {}

const handleInit = (state, data) => {
	state.sessionId = _.get(data, 'response.sessionId')
	state.userId = _.get(data, 'response.userId')
	state.appName = _.get(data, 'response.appName')
	state.isInited = false
	state.subscriptions = _.union(state.subscriptions,[data.room])
}

const handleSubscribed = (state, data) => {
	const msgSessionId = _.get(data, 'response.sessionId', '')
	//check if message of user is in room
	const roomReceived = _.get(data, 'room', '')
	const inRoom = _.includes(state.subscriptions, roomReceived)
	if(!inRoom) return false

	//check if response body room name and if session id matches
	const responseRoom = _.get(data, 'response.room', '')
	if(_.isEqual(msgSessionId, state.sessionId)){
		state.subscriptions = _.union(state.subscriptions,[response.room])
	}
	//Note: other players besides this session will be handled rooms file
}

const handleUnsubscribed = (state, data) => {
	if(_.isEqual(response.sessionId, state.sessionId)){
		state.chat = _.without(state.chat, data.room)
		state.subscriptions = _.without(state.subscriptions, data.room)
	}

}

const handleIncomingChatMessage = (state, data) => {
	const response = _.get(data, 'response', {message: 'invalid message'})
	const room = _.get(data, 'room', 'invalid')
	state.chat[room] = _.concat(state.chat[room], [response])
}

export default function (state = initialState, action) {
	return state
}
