"use strict"
const debug = require('debug')
debug.log = console.info.bind(console) //one all send all to console.
const log = debug('initJob')
const errlog = debug('initJob:error')

const Promise  = require('bluebird')
const _  = require('lodash')
const sendSsoCheck  = require('./sendSsoCheck')
Promise.promisifyAll(sendSsoCheck)
const subscribe  = require('./subscribe')
const RoomActions 	= require('../room/shared')
const store  = require('../../store')
const getConnection  = store.database.getConnection

const colon = require('../../util/colon')
const objToArr = require('../../util/objToArr')
const remapToObject = require('../../util/remapToObject')
const arrToSet = require('../../util/arrToSet')
log('created new instance')
//jobs are independent (outside the server process) so we need to create queues that will destroy after process is finished
const Queue = require('../queue')

const PUBLISH_DELAY = 3000

const _validatePlayerData = (data) => {
	if(_.isEmpty(data)) throw new Error('[Socket] player data is empty')
	return data
}

const _validateSessionId = (sessionId) => {
	if(!_.isString(sessionId)) throw new Error('[Socket] sessionId does not conform to string')
	/*if(/^[0-9A-F]{8}-[0-9A-F]{4}-[5][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/.test(_.toUpper(sessionId))) throw new Error('[Socket] sessionId does not conform to uuid')*/
	return sessionId
}

if (process.env.FORK) {
	console.log('started from fork()');
}

module.exports = function(job){
	const isWorker = job.worker
	const roomQueue = Queue('roomQueue')
	const {sessionId,playerData,timeAddQueue} = job.data
	const {appName,userId} = playerData
	const timeStartExec = Date.now()
	const initEventId = `${sessionId}|confirmInit|${timeStartExec}`
	const sessionRoom = colon('sessions', sessionId)

	//adds playerData to the new object to be set in session:*id*
	let sessionData = Object.assign({
		sessionId,
		initEventId,
		//initConfirm: ,
		online: 1,
		created: Date.now()
	}, playerData)

	let objSessionData = objToArr(sessionData)
	let roomList
	job.progress(25)
	//Hook in single app user check

	return Promise.using(getConnection(isWorker), (client) => {

		return Promise.all([roomQueue, _validatePlayerData(playerData),_validateSessionId((sessionId))])
			.then(() => sendSsoCheck({ data: {sessionId,appName,userId}, worker: true}))
			//.tap(log)
			.then(() => client.initSession(sessionId, objSessionData))
			//.tap((result) => log('[INIT] Setup', result.toString()))
			.then(arrToSet)
			.tap((rooms) => roomList = rooms)
			.then((rooms) =>
					subscribe({data: {
							isInit: true,
							sessionId,
							rooms,
							userId,
							appName,
						} })
				//roomQueue.add('subscribe', )
			)
			//.call('finished')
			//.tap((result) => log('[INIT] Sub Job', result.toString()))
			//.delay(PUBLISH_DELAY)
			.then(([sessionId, roomList]) => { //TODO: https://github.com/OptimalBits/bull/issues/340
				const rooms = remapToObject(roomList)
				log('test delay start', rooms)

				const message = JSON.stringify({
					phase: "init",
					room: sessionRoom,
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
				})
				return client.publishToSession(sessionId, Date.now(), message)
			})
			.tap((result) => log('[INIT] Publish', result.toString()))

			.then((result) => result.toString())
			.tapCatch((err) => errlog(err))
			.tapCatch(() => RoomActions.commandUnSubSession(sessionId, 'error'))
			.finally(() => {
				//client.quit()
			})
			.catch((err) => {
				log('error catch')
				log('[ERROR INIT]' + err.status, err.message)
				log(err, err.stack.split("\n"))
				throw new Error('Init Error ' + err.toString())
			})
	})

	//})


}
