import {WS_CLEAR_LOG, WS_CLOSE, WS_CONNECTING, WS_MESSAGE, WS_OPEN, WS_REQ_RECONNECT, WS_REQ_SEND} from '../middleware/websocket'
import _ from 'lodash'
const parseJson = (str) => _.attempt(JSON.parse.bind(null, str))

const initialState = {
	connecting: false,
	sessionId: false,
	userId: false,
	appName: false,
	isInited: false,
	initEventId: false,
	subscriptions: [],
	messagesRec: [],
	messagesSent: [],
	chat: {},
	request: "",
	initRequest: "",
	clearOnConnect: true,
	lastEventId: false
}

const handleInit = (state, data) => {
	const rooms = _.keys(_.get(data, 'response.rooms', {}))//get room keys (ignore type value)
	state.sessionId = _.get(data, 'response.sessionId')
	state.userId = _.get(data, 'response.userId')
	state.appName = _.get(data, 'response.appName')
	state.appName = _.get(data, 'response.appName')
	state.isInited = false
	state.initEventId = _.get(data, 'response.initEventId')
	state.subscriptions = _.union(state.subscriptions,rooms)
}

const handleSubscribed = (state, data) => {
	const msgSessionId = _.get(data, 'response.sessionId', '')
	const subbedRoom = _.get(data, 'room', '')
	const targetedRoom = _.get(data, 'response.room', '')
	const inSubbedRoom = _.includes(state.subscriptions, subbedRoom)
	const inTargetedRoom = _.includes(state.subscriptions, targetedRoom)
	const sessionMatches = _.isEqual(msgSessionId, state.sessionId)
	if((!inTargetedRoom && !inSubbedRoom) || !sessionMatches) return false //check if message of user is in room
	state.subscriptions = _.union(state.subscriptions,[targetedRoom])
	//Note: other players besides this session will be handled rooms file
}

const handleUnsubscribed = (state, data) => {
	const msgSessionId = _.get(data, 'response.sessionId', '')
	const subbedRoom = _.get(data, 'room', '')
	const targetedRoom = _.get(data, 'response.room', '')
	const inSubbedRoom = _.includes(state.subscriptions, subbedRoom)
	const inTargetedRoom = _.includes(state.subscriptions, targetedRoom)
	const sessionMatches = _.isEqual(msgSessionId, state.sessionId)
	if(!inSubbedRoom || !inTargetedRoom || !sessionMatches) return false //check if message of user is in room
	state.chat = _.without(state.chat, data.room)
	state.subscriptions = _.without(state.subscriptions, data.room)
}

const handleIncomingChatMessage = (state, data) => {
	const response = _.get(data, 'response', {message: 'invalid message'})
	const room = _.get(data, 'room', 'invalid')
	const chatLog = _.get(state.chat, room)
	state.chat[room] = chatLog && _.concat(chatLog, response) || [response]
}

export default function (state = initialState, action) {
	const isClientWs = _.isEqual(_.get(action, 'payload.wsId'), 'webclient')
	if(!isClientWs) return state

	const type = _.get(action, 'type', 'invalid')
	const rawReceivedMessage = _.get(action, 'payload.data', '{"sessionId": "server", "message": "invalid message"}')
	const rawSendMessage = _.get(action, 'payload.message', '{"sessionId": "server", "message": "invalid message"}')
	let newState = _.cloneDeep(state)
	let newMessageRec, newMessageSent
	let formatRecMsg

	switch (type) {
		case WS_MESSAGE:
			console.log('message found, so', rawReceivedMessage)
			if(!_.isString(rawReceivedMessage)) return state
			formatRecMsg = _.trimStart(rawReceivedMessage, '__INIT__')
			formatRecMsg = _.trimStart(formatRecMsg, '__JSON__START__')
			formatRecMsg = _.trimEnd(formatRecMsg, '__JSON__END__')
			formatRecMsg = _.trimEnd(formatRecMsg, '__ENDINIT__')
			if(parseJson(formatRecMsg)){
				formatRecMsg = parseJson(formatRecMsg)

				//set last eventId now
				newState.lastEventId = _.get(formatRecMsg, 'response.eventId')

				//specific for init
				if(_.isEqual('init',_.get(formatRecMsg, 'phase'))){
					handleInit(newState, formatRecMsg)
				}

				//specific for subscribe
				if(_.isEqual('subscribed',_.get(formatRecMsg, 'phase'))){
					handleSubscribed(newState, formatRecMsg)
				}

				//specific for unsubscribe
				if(_.isEqual('unsubscribed',_.get(formatRecMsg, 'phase'))){
					handleUnsubscribed(newState, formatRecMsg)
				}

				//specific for chat
				if(_.isEqual('sendChatToRoom',_.get(formatRecMsg, 'phase'))){
					handleIncomingChatMessage(newState, formatRecMsg)
				}
			}

			newMessageRec = {
				clientTime: Date.now(),
				parsed: formatRecMsg || rawReceivedMessage,
				message: rawReceivedMessage
			}

			newState.messagesRec = newState.messagesRec.concat([newMessageRec])
			return {...state, ...newState}

		case WS_CONNECTING:
			return {
				...state,
				connected: false,
				connecting: true
			}
		case WS_OPEN:
			return {
				...state,
				connected: true,
				connecting: false,
				subscriptions: [],
				messagesRec: [],
				messagesSent: [],
			}
		case WS_CLOSE:
			return {
				...state,
				sessionId: false,
				connected: false,
				connecting: false,
				subscriptions: [],
				messagesRec: [],
				messagesSent: [],
			}
		case WS_CLEAR_LOG:
			return {
				...state,
				messages: []
			}

		//User requests
		case WS_REQ_SEND:
			//add to list of things sent
			newMessageSent = _.get(action, 'payload', '{}')
			console.log('ws send,', rawSendMessage)
			if(_.startsWith(rawSendMessage, '__INIT__')){
				newState.initRequest = rawSendMessage
			}
			if(_.get(action, 'payload.confirmInit')) newState.isInited = true


			//filter out certain keys to be saved in sent array
			newMessageSent = _.pick(newMessageSent, ['clientTime', 'message', 'parsed'])
			newState.messagesSent = newState.messagesSent.concat([newMessageSent])
			return {...state,...newState}
		default:
			return state
	}
}
