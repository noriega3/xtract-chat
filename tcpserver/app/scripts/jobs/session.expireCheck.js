"use strict"

const debug = require('debug')
debug.log = console.info.bind(console) //one all send all to console.
const _log = debug('expireCheck')
const _error = debug('expireCheck:error')

const Promise		= require('bluebird')
const store	        = require('../../store')
const getConnection = store.database.getConnection

const destroy = require('./session.destroy')

module.exports = function(job){
	return Promise.using(getConnection(), (client) => {
		return client.getServerTime()
			.then((serverTime) => client.zrangebyscore('tick|sessions', 0, serverTime - 60000, 'LIMIT', 0, 10))
			.each((sessionId) => {
				return destroy({data:{sessionId: sessionId, destroyType: 'expired'}})
			})
			.return('OK')
			.catch((err) => {
				_error('[ERR @ expireCheck]' + err.toString())
				throw new Error('Error ' + err.toString())
			})
	})
}
