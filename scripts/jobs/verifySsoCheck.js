"use strict"
const debug = require('debug')
debug.log = console.info.bind(console) //one all send all to console.
const _log = debug('verifySso')
const _error = debug('verifySso:error')

const Promise		= require('bluebird')
const store	        = require('../../store')
const getConnection = store.database.getConnection

module.exports = (job) => {
	const data = job.data
	const sessionId = data.sessionId
	const rawMessage = data.rawMessage

	return Promise.using(getConnection(), (client) => {
		return client.verifySsoCheck(sessionId, rawMessage)
			.then((result) => {
				//_log('r', result)

				return 'OK'
			})
			.catch((err) => {

				_log('WOULD LOG OUT HERE')
				/*			return sessionQueue.add('destroy', {sessionId: sessionId, destroyType: 'expired'}, addConfig)
                                .then((nestedJob) => nestedJob.finished())
                                .then((nestedJobResult) => sessionId)
                                .catch((err) => 'OK')*/

				_error('[Error verifySsoCheck]', err)
				throw new Error('Error '+ err.toString())
			})
	})

}
