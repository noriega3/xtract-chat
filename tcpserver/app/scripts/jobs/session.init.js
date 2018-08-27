const debug = require('debug')
debug.log = console.info.bind(console) //one all send all to console.
const _log = debug('initJob')
const _error = debug('initJob:error')

const Promise  = require('bluebird')
const jwt = require('jsonwebtoken');

const _get 		= require('lodash/get')
const _isEmpty 	= require('lodash/isEmpty')
const _isString = require('lodash/isString')
const _omit 	= require('lodash/omit')
const _clone 	= require('lodash/clone')
const _isEqual 	= require('lodash/isEqual')
const _has 	= require('lodash/has')
const _includes = require('lodash/includes')

process.title = _includes(process.title, '/bin/node')? 'node_init' : process.title

const objToArr = require('../../util/objToArr')
const remapToObject = require('../../util/remapToObject')
const arrToSet = require('../../util/arrToSet')

const sendSsoCheck  = Promise.method(require('./session.sendSsoCheck'))
const subscribe  	= Promise.method(require('./room.subscribe'))
const unsubscribe  	= Promise.method(require('./room.unsubscribe'))

const store  = require('../../store')
const withDatabase  = store.database.withDatabase

const publishToSession 	= store.getLua('/session/publishToSession.lua')
const initSession 		= store.getLua('/session/initSession.lua')

const _validatePlayerData = (data) => {
	if(_isEmpty(data)) throw new Error('[Socket] player data is empty')
	return data
}

const _validateSessionId = (sessionId) => {
	if(!_isString(sessionId)) throw new Error('[Socket] sessionId does not conform to string')
	/*if(/^[0-9A-F]{8}-[0-9A-F]{4}-[5][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/.test(_.toUpper(sessionId))) throw new Error('[Socket] sessionId does not conform to uuid')*/
	return sessionId
}

if (process.env.FORK) {
	_log('started from fork()');
}

module.exports = function(job){
	const lastDbConnection 	= _get(job,'dbConnection')
	return withDatabase((db) => {
		_log('data', job.data)
		const sessionId 		= _get(job,'data.sessionId')
		const timeAddQueue 		= _get(job,'data.timeAddQueue')
		const playerData 		= _get(job,'data.params')
		const appName 			= _get(job,'data.params.appName')
		const userId 			= _get(job,'data.params.userId')
		const req 				= _get(job,'data.req')
		const timeStartExec 	= Date.now()
		const sessionRoom 		= `sessions:${sessionId}`
		let sessionData, objSessionData, roomList, initEventId

		//adds playerData to the new object to be set in session:*id*
		sessionData = Object.assign({
			sessionId,
			online: 1,
			created: Date.now()
		}, playerData)

        initEventId = jwt.sign(sessionData, sessionId)

		objSessionData = objToArr(sessionData)

		db.defineCommand('initSession', {numberOfKeys: 2, lua: initSession})
		db.defineCommand('publishToSession', {numberOfKeys: 2, lua: publishToSession})

		const initSessionOnDb = Promise.method(function(){
			return db.initSession(sessionId, initEventId, objSessionData)
				.then(arrToSet)
				.then((newRoomList) => (roomList = newRoomList))
				.catch((err) => {
					if(_isEqual(err.message,`SESSION EXISTS: ${sessionId}`)) {
                        _log('MULTIPLE INITS CALLED')
                        return 'OK'
                    } else
						throw err
				})
				.return('OK')
		})

		const subscribeToSystemRooms = Promise.method(function(){
			if(!roomList) throw new Error('NO ROOM LIST')
			const rooms = _clone(roomList)
			return subscribe({db,data: { sessionId,rooms,skipSessionCheck: true} })
		})

		const sendInitMessage = Promise.method(function(){
			if(!roomList) throw new Error('INVALID SUBSCRIPTIONS')
			const rooms = remapToObject(_clone(roomList))

			const message = {
				phase: "init",
				room: sessionRoom,
                req,
				_server: {
					totalTimeInQueue: timeStartExec - timeAddQueue,
					totalTimeExecute: Date.now() - timeStartExec
				},
				response: {
					initEventId,
					sessionId: sessionId,
					userId: userId,
					appName: appName,
					rooms: rooms
				}
			}
			return db.publishToSession(sessionId, Date.now(), JSON.stringify(message), JSON.stringify({skipChecks:true})).return('OK')
		})

		return Promise.all([_validatePlayerData(playerData),_validateSessionId((sessionId))])
			.tap((result) => {_log('[INIT] validation check', result)})

			.then(() => sendSsoCheck({ db, data: {sessionId,appName,userId}}))
			.tap((result) => {_log('[INIT] single user check', result)})

			.then(initSessionOnDb)
			.tap((result) => {_log('[INIT] init Db Session', result)})

			.then(subscribeToSystemRooms)
			.tap((result) => _log('[INIT] sub to system rooms', _omit(result, 'db')))

			.then(sendInitMessage)
			.tap((result) => _log('[INIT] send init message', result))

			.tapCatch((err) => {_error('[PROMISE ERR] ', err)})
			.catch((error) => {
				unsubscribe({db, data:{sessionId: sessionId, rooms: roomList, error}})
            })
			.return('OK')

	},lastDbConnection)
		.tap((result) => {_log('[INIT] DONE', _omit(result, 'db'))})
		.return(Promise.resolve('OK'))
		.tapCatch((err) => {
			_error('[Error Init]', err.status, err.message)
			console.log(err, err.stack.split("\n"))
		})
}
