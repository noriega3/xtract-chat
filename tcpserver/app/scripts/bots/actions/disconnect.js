const debug         = require('debug') //https://github.com/visionmedia/debug
const _log        = debug('disconnect')
const _error        = debug('disconnect:err')
module.exports = function(type,msg){
	let client = this
	const socket = this.getSocket()
	const sessionId = this.getSessionId()
	client._state = "disconnecting"

	client._rooms = []
	client._reserves = []

	if(sessionId){
		_log('[DISCONNECTED]: ', sessionId)
	}

	switch(type){
		case 'end':
			return socket.end(msg)
		case 'destroy':
			client = null
			return socket.destroy(msg)
		default:
			return socket.end()
	}
}
