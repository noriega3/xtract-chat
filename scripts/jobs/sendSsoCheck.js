"use strict"
const debug = require('debug')
debug.log = console.info.bind(console) //one all send all to console.
const log = debug('sendSsoCheck')
const errlog = debug('sendSsoCheck:err')

const Promise		= require('bluebird')
const store	        = require('../../store')
const getConnection = store.database.getConnection

module.exports = (job) => {
	const isWorker = job.worker
	log('in ssoChec1k', job)

	const {sessionId,userId,appName} = job.data
	log('in ssoCheck2')

	return Promise.using(getConnection(isWorker), (client) => {
		return client.sendSsoCheck(userId, sessionId, appName)
			.tap(log)
			.then((result) => {
				//_log('sendsso', result)
				return 'OK'
			})
			.catch((err) => {
				errlog('[Error sendSsoCheck]', err)
				throw new Error('Error '+ err.toString())
			})
		//.finally(() => client.quit())
	})

}
