"use strict"
const debug         = require('debug')      //https://github.com/visionmedia/debug
const _log          = debug('keepAlive')
const _error        = debug('keepAlive:err')

const Promise		= require('bluebird')
const store = require('../../store')
const getConnection = store.database.getConnection

module.exports = (job) => {
	const data 		= job.data
	const sessionId = data.sessionId
	const params 	= JSON.stringify(data.params) || {}

	return Promise.using(getConnection('keepAlive'), (client) => {
		return client.keepAlive(sessionId, params)
		})
		.return('OK')
		.catch((err) => {
			_error('[Error KeepAlive]', err)
			throw new Error('Error '+ err.toString())
		})
}
