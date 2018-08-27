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

const confirmInit 	= store.getLua('/session/confirmInit.lua')
const publishToSession 	= store.getLua('/session/publishToSession.lua')


module.exports = function(job){
	const lastDb	= _get(job, 'db')
	return withDatabase((db) => {
		const sessionId 		= _get(job, 'data.sessionId')
		const initEventId 		= _get(job, 'data.params.initEventId')
		const req 				= _get(job, 'data.req')

		console.log('initEventId is', initEventId)

		const setupMessage = _partial((initEventId = false) => {
			return {
				phase: "confirmInit",
				room: `sessions:${sessionId}`,
                req,
				response: { initEventId }
			}
		}, _partial.placeholder)

		if(!_has(db, 'confirmInit')) db.defineCommand('confirmInit', {numberOfKeys: 0, lua: confirmInit})
		if(!_has(db, 'publishToSession')) db.defineCommand('publishToSession', {numberOfKeys: 2, lua: publishToSession})

        const publish = _partial((msg) => db.publishToSession(sessionId, Date.now(), JSON.stringify(msg)), _partial.placeholder)

		return db.confirmInit(sessionId, initEventId)
			.tap((result) =>  _log('[INIT CONFIRM] confirmation ', result.toString()))
			.call('toString')
			.then(setupMessage)
			.then(publish)
			.return('OK')
			.tapCatch((err) => {_error('[Error Confirm Init db]', err.message, err.stack.split("\n"))})
			.catchThrow(new Error('ERROR CONFIRM INIT'))
	}, lastDb)
		.tap(() => {_log('[CONFIRM INIT] DONE')})
		.return(Promise.resolve('OK'))
		.tapCatch((err) => {
			_error('[Error Confirm Init]', err.message)
			console.log(err.stack.split("\n"))
		})

}
