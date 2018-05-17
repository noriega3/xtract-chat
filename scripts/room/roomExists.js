const debug         = require('debug')      //https://github.com/visionmedia/debug
debug.log = console.info.bind(console)
const _log          = debug('roomExists')
const _error        = debug('roomExists:err')

const Promise		= require('bluebird')

const _isEqual = require('lodash/isEqual')
const _partial = require('lodash/partial')
module.exports = function(data){
	const {db, roomName} = data
	const parseStatus = _partial((result) => _isEqual(result,1))

	return db.exists([`rooms|${roomName}|info`])
		.then(parseStatus)
		.tap(_log)
		.tapCatch(_error)
}
