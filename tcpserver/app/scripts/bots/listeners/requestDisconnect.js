const debug         = require('debug')      //https://github.com/visionmedia/debug
const _log          = debug('bot:reqDisconnect')
const _error        = debug('bot:reqDisconnect:err')
debug.log = console.info.bind(console) //one all send all to console.

const disconnect	= ('../actions/disconnect')

module.exports = function(data){
	const client = this
	//_log('Requesting dc for ',client.sessionId, data, (Date.now() - data.response.time))
	if (data.response && data.response.sessionId === client.sessionId && data.room) {

		//check if time is within a timeframe
		const validTime = (Date.now() - data.response.time) <= 10000

		if (validTime) {
			disconnect()
		} else {
			_log('time limit reached for dc request')
		}
	} else {
		_error('err on disconnect')
	}
}
