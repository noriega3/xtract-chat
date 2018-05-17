"use strict"
let apm = require('elastic-apm-node')

const debug         = require('debug')      //https://github.com/visionmedia/debug
debug.log = console.info.bind(console) //one all send all to console.
const _log          = debug('confirmInit')
const _error        = debug('confirmInit:err')

const Promise		= require('bluebird')

const _get = require('lodash/get')
const _partial = require('lodash/partial')
const _hasIn	= require('lodash/hasIn')
const _isEqual	= require('lodash/isEqual')
const _includes	= require('lodash/includes')
const _has	= require('lodash/has')

process.title = _includes(process.title, '/bin/node')? 'node_confirmInit' : process.title

const store = require('../../store')
const withDatabase 	= store.database.withDatabase

const confirmInit 	= store.getLua('./scripts/redis2/session/confirmInit.lua')
const publishToSession 	= store.getLua('./scripts/redis2/session/publishToSession.lua')


module.exports = function(job){
	const lastDbdb	= _get(job, 'db')
	return withDatabase((db) => {
		const sessionId 		= _get(job, 'data.sessionId')
		const initEventId 		= _get(job, 'data.params.initEventId')

		console.log('initEventId is', initEventId)

		const setupMessage = _partial((initEventId = false) => {
			return {
				phase: "confirmInit",
				room: `sessions:${sessionId}`,
				response: { initEventId }
			}
		}, _partial.placeholder)

		if(!_has(db, 'confirmInit')) db.defineCommand('confirmInit', {numberOfKeys: 2, lua: confirmInit})
		if(!_has(db, 'publishToSession')) db.defineCommand('publishToSession', {numberOfKeys: 2, lua: publishToSession})

		const publish = _partial((msg) => db.publishToSession(sessionId, Date.now(), JSON.stringify(msg)), _partial.placeholder)
		return db.confirmInit(sessionId, initEventId)
			.tap((result) =>  _log('[INIT CONFIRM] confirmation ', result.toString()))
			.call('toString')
			.then(setupMessage)
			.then(publish)
			.return('OK')
			.tapCatch((err) => {_error('[Error Confirm Init]', err)})
			.catchThrow(new Error('ERROR CONFIRM INIT'))
	}, lastDbdb)
		.tap(() => {_log('[CONFIRM INIT] DONE')})
		.return('OK')
		.tapCatch((err) => {
			_error('[Error Confirm Init]', err.status, err.message)
			console.log(err, err.stack.split("\n"))
		})

}
