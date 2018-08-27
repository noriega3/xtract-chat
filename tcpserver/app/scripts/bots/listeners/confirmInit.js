const _isEqual		= require('lodash/isEqual')
const debug         = require('debug')      //https://github.com/visionmedia/debug
const _log          = debug('bot:confirmInit')
const _error        = debug('bot:confirmInit:err')
debug.log = console.info.bind(console) //one all send all to console.

module.exports = function(data){
	const client = this

	if(_isEqual(data.response.initEventId, "OK") && _isEqual(client._state, "confirming")) {
		_log('SUCCESS CONFIRM, SET READY')
		client._state = "ready"
	}
}
