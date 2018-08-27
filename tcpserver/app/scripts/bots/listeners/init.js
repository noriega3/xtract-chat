const debug         = require('debug')      //https://github.com/visionmedia/debug
const _log          = debug('bot:init')
const _error        = debug('bot:init:err')
debug.log = console.info.bind(console) //one all send all to console.

module.exports = function(data){
	const client = this
	const actions = this.getActions()
	client.setSessionId(data.response.sessionId)

	_log('something')
	console.log('listeners init')
	console.log('state is currently', client._state)
	//Automatically send confirmInit
	if (client._state === "init") {
		console.log('state changing to ready')
		client._state = "confirming"
		actions.publish({
			sessionId: client.sessionId,
			intent: 'confirmInit',
			params: {
				eventId: data.response.eventId,
				initEventId: data.response.initEventId
			}
		})
	}

	if (client.keepAliveTimer) {
		clearInterval(client.keepAliveTimer)
	}

	client.keepAliveTimer = setInterval(() => {
		const dataToSend = {
			intent: "keepAlive",
			params: {
				startPing: Date.now()
			}
		}
		return actions.publish(dataToSend)
	}, 30000)

	//_log('[Bot] Connected w/ data \n', data)
}
