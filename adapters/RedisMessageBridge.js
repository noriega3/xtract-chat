const debug         = require('debug') //https://github.com/visionmedia/debug
const Promise       = require('bluebird')
const _log        	= debug('redisBridge')
const _error        = debug('redisBridge:err')
const util       	= require('../util/helpers')
const store       	= require('../store')
const db			= store.database
const Subscriber    = db.getQueueSubClient()

const _forEach	= require('lodash/forEach')
const _get		= require('lodash/get')
const _isString	= require('lodash/isString')
const _isEmpty	= require('lodash/isEmpty')
const _isObject	= require('lodash/isObject')
const _includes	= require('lodash/includes')
const _isEqual	= require('lodash/isEqual')

const rooms = ['sessions|*','rooms|*','bot|*']

//todo: use bull queue to limit spam on client and auto confirm logic
const sendMessage = (sessionIds, formattedMessage) => {
	//check if we really need to use a promise for internal socket list
	return Promise.map(store.clients.getClientsByIds(sessionIds), (client) => {
		_log('going to send message to client')
			return client.send(formattedMessage)
		}, {concurrency: 5})
		.catch((err) => {
			if(_isEqual('SOCKET DESTROYED', err.message)) return _log('[SOCKET] destroyed, skipping sending of message.')
			_error(err)
		})
}
const sendMessages = (messages, sessionIds, dateInSeconds) => {
	_forEach(messages, (message) => {
		const serverReqTime = _get(message,'serverReqTime')
		const sendingMessage = _isString(message) ? message : JSON.stringify(message)
		message.serverTime = dateInSeconds //add serverTime to response
		message.serverLatency = serverReqTime && Date.now() - serverReqTime
		return sendMessage(sessionIds, `__JSON__START__${sendingMessage}__JSON__END__`)
	})
}
/****
 * Redis pub/sub per node server
 */
Subscriber.psubscribe(rooms)
Subscriber.on('pmessage', (pattern, channel, rawMessages) => {
	if(!_includes(rooms, pattern)) return
	const parsed = rawMessages && util._isJson(rawMessages) ? util._toJson(rawMessages) : {}
	const dateInSeconds = Date.now() / 1000
	const sessionIds = _get(parsed, 'sessionIds', [_get(parsed, 'sessionId', '')])
	const messages = _get(parsed, 'messages', [_get(parsed, 'message', {})])

	if(!_isObject(parsed)) return _error('invalid format message to room', pattern, channel, rawMessages)
	if(_isEmpty(messages)) return _error('invalid sending message to room',pattern, channel, rawMessages)
	if(_isEmpty(sessionIds)) return _error('no sessions to room', pattern, channel, rawMessages)

	sendMessages(messages, sessionIds, dateInSeconds)
})
