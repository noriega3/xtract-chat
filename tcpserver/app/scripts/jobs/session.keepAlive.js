"use strict"


const debug         = require('debug')      //https://github.com/visionmedia/debug
const _log          = debug('keepAlive')
const _error        = debug('keepAlive:err')

const Promise		= require('bluebird')
const store = require('../../store')
const withDatabase = store.database.withDatabase

module.exports = function(job) {
	return withDatabase((connection) => {
		const data = job.data
		const sessionId = data.sessionId
		const params = JSON.stringify(data.params) || {}

		return connection.keepAlive(sessionId, params)
			.return('OK')
			.catch((err) => {
				_error('[Error KeepAlive]', err)
				throw new Error('Error ' + err.toString())
			})
	})
}
