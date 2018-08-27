import {WS_CLEAR_LOG, WS_CLOSE, WS_CONNECTING, WS_MESSAGE, WS_OPEN, WS_REQ} from '../middleware/websocket'
import _ from 'lodash'

const defaultLogMessage = '{"message":"  \u001b[33;1mpm2:failure \u001b[0mParsing message \u001b[33m+7s\u001b[0m\n","timestamp":"2999-01-01 01:01:01 +00:00","type":"err","process_id":-1,"app_name":"error"}'
const initialState = {
	pm2Connect: false,
	pm2BusConnect: false,
	connected:false,
	isLogging: false,
	isRefreshing: false,
	//system: {},
	servers: [],
	messages: [],
	matches: [],
	matchSelected: '',
	matchDetails: {},
	clearOnConnect: true,
	logOnConnect: true
}
const parseJson = (str) => _.attempt(JSON.parse.bind(null, str))
export default function (state = initialState, action) {
	const isDashboardWs = _.isEqual(_.get(action, 'payload.wsId'), 'dashboard')
	if(!isDashboardWs) return state

	const type = _.get(action, 'type', 'invalid')
	const payload = _.get(action, 'payload')
	const payEvent = _.get(payload, 'event')

	const rawMessage = _.get(payload, 'data', '{}')
	const message = parseJson(rawMessage)
	const logMessage = parseJson(_.get(message, 'response.data', defaultLogMessage))
	const msgResponse = _.get(message, 'response', {})
	const msgEvent = _.get(message, 'event', '')
	const msgField = _.get(message, 'id')
	const msgStatus = _.get(message, 'status')
	let newState = {}

	switch (type) {
		case WS_MESSAGE:
			switch(msgEvent){
				case 'log':
					if(state.isLogging && logMessage){
						newState.messages = _.concat([logMessage],state.messages)
					}
					break
				case 'statusChange':
					if(!msgField) return state
					newState[msgField] = msgStatus
					break
				case 'status':
					newState.system = msgResponse
					break
				case 'pm2Status':
					newState.servers = msgResponse
					newState.isRefreshing = false
					break;
			}

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
				pm2Connect: false,
				pm2BusConnect: false,
				isLogging: false,
				isRefreshing: false,
				messages: state.clearOnConnect ? [] : state.messages
			}
		case WS_CLOSE:
			return {
				...state,
				connected: false,
				connecting: false,
				pm2Connect: false,
				pm2BusConnect: false,
				isLogging: false,
				isRefreshing: false
			}
		case WS_CLEAR_LOG:
			return {
				...state,
				messages: []
			}
		case WS_REQ:
			switch(payEvent){
				case 'toggleClearOnConnect':
					newState.clearOnConnect = !state.clearOnConnect
					break
				case 'toggleLogOnConnect':
					newState.logOnConnect = !state.logOnConnect
					break
			}
			return {
				...state,
				...newState
			}
		default:
			return state
	}
}
