const debug 	= require('debug') //https://github.com/visionmedia/debug
debug.log = console.info.bind(console) //one all send all to console.
const _log 		= debug('apiServer')
const _error 	= debug('apiServer:err')

//npm/node modules
const Promise			= require('bluebird')
const _isEmpty			= require('lodash/isEmpty')
const express       	= require('express')        // call express
const { check, validationResult } = require('express-validator/check');
const { matchedData, sanitize } = require('express-validator/filter');

//TODO: convert v3 to v4 express-validator

const bodyParser 		= require('body-parser')
let helmet 				= require('helmet')

const SERVER_NAME 		= process.env.SERVER_NAME
const HTTP_SERVER_PORT	= process.env.HTTP_SERVER_PORT
const HTTP_API_PATH		= process.env.HTTP_API_PATH

const helper	= require('../util/helpers')
const store		= require('../store')
const withDatabase		= store.database.withDatabase
const servers	= store.servers

const _identifier = 'ApiServer'

_log('[Init] %s - ApiServer', SERVER_NAME)
const addConfig = {
	attempts: 3,
	timeout: 5000,
	removeOnComplete: false,
}

const ApiServer = () => {
	const app = express()                 // define our app using express
	let server
	app.disable('x-powered-by')
	app.use(helmet())

	app.get('/robots.txt', (req, res) => {
		res.type('text/plain')
		res.send("User-agent: *\nDisallow: /")
	})

	// configure app to use bodyParser()
	// this will let us get the data from a POST
	app.use(bodyParser.urlencoded({ extended: true }))
	app.use(bodyParser.json())
	/*app.use(expressValidator({
		customValidators: {
			"checkMaintenanceMode": () => _result(serverConfig, 'getMaintenanceMode', true),
			"isSessionNotExpired": (sessionId) => {
				return withDatabase((db) => {
					return db.multi()
						.get('serverTime')
						.zscore('sessions|tick', sessionId)
						.exec()
						.then(([[err0, serverTime], [err1, lastUpdate]]) => {
							if(err0 || err1){ return false }
							return (serverTime-lastUpdate) > 60000
						})
				})
				.tapCatch(_error)
				.catchReturn(false)
			},
			"isValidGameRoomPath": (roomName) => roomName.match('^(\\w+):(\\w+):([a-zA-Z]+)$'), //appname:game:theme:id
			"isValidGameRoomName": (roomName) => roomName.match('^(\\w+):(\\w+):(\\w+):([0-9]+)$'), //appname:game:theme:id
			"isUserBlocked": (requesterId, userId) => {
				return withDatabase((db) => {
					return db.sismember(`users:${userId}:blocks`, requesterId).then((exists) => exists === 1)
				}).tapCatch(_error)
				.catchReturn(false)
			}
		},
		customSanitizers: {}
	})) // this line must be immediately after any of the bodyParser middlewares!*/


	const router = express.Router() // get an instance of the express Router

	/**
	 * @path /room/reconnect
	 * @description reconnect the user to the room by reserving or finding a new room for user
	 */
	router.use('/room/reconnect', (req, res, next) => {
		res.locals.test = true
		res.redirect(307,'reserve')
	})

	//Guarantee that the app name and roomArr will be filled by the server
	/** @function reserveMiddleware */
	router.use('/room/reserve', [
		//req.check('', 'Server in in maintenance mode').checkMaintenanceMode()

		check('sessionId')
			.isLength({min:1})
			.trim()
			.custom(sessionId => {
				return withDatabase((db) => {
					return db.multi()
						.get('serverTime')
						.zscore('sessions|tick', sessionId)
						.exec()
						.then(([[err0, serverTime], [err1, lastUpdate]]) => {
							if(err0 || err1){ return false }
							return (serverTime-lastUpdate) > 60000
						})
				})
				.tapCatch(_error)
				.catchReturn(false)
		}).withMessage('Session is expired'),
		check('params').isLength({min:1}).withMessage('invalid params'),
		check('roomName').isLength({min:1}).withMessage('invalid roomName').contains(':').withMessage('Room was formatted incorrectly'),
	], (req, res, next) => {

		const errors = validationResult(req)

		if(!errors.isEmpty()){
			return res.status(400).json({
				status: false,
				error: true,
				message: errors.mapped()
			})
		}

		const roomArr = helper._roomNameToArr(req.body.roomName)
		req.body.appName = roomArr.roomAppName
		req.body.roomArr = roomArr
		req.body.isReconnected = false /*req.statusCode === 308*/

		//TODO: remove
		if(req.body.userId === "786971"){
			_log('router reserve')
			_log(res.locals)
		}
		next()
	})

	/**
	 * @path /room/reserve
	 * @description reserves the room for the user
	 * @see reserveMiddleware for automatically added body parameters
	 */
	router.post('/room/reserve', [
		check('userId').isLength({min:1}).trim().isNumeric().withMessage('User id is not numeric'),
		check('params').isLength({min:1}).withMessage('invalid params'),
		check('appName','invalid roomName').isLength({min:1}).not().isIn(store.getConfig('appNames')).withMessage('App is not enabled'),
		check('roomArr').isLength({min:1}).withMessage('Invalid room arr')
	], (req, res) => {

		_log('cfg', store.getConfig('appNames'))

		//validate and trigger sanitize the values
		const errors = validationResult(req)

		if(!errors.isEmpty()){
			return res.status(400).json({
				status: false,
				error: true,
				message: errors.mapped()
			})
		}

		const apiQueue = store.queues.getQueueByName('apiQueue')
		if (!apiQueue) return new Error('Queue server offline.')
		return apiQueue.add('reserve', req.body, addConfig)
			.then((job) => job.finished())
			.then((result) => {
				if (!result || _isEmpty(result)) throw new Error('Invalid response.')
				return res.json(result)
			})/*
				if (!result.isEmpty()) {
					res.status(400).json({
						status: false,
						error: true,
						message: result.array()[0].msg
					})
					return //end
				}

				const body = req.body
				const sessionId = body.sessionId
				const userId    = parseInt(body.userId)
				const params    = body.params
				const isBot = userId >= 50000 && userId <= 70000

				let roomArr 	= body.roomArr
				let roomName 	= roomArr.roomName
				let roomPath 	= roomArr.roomPath
				let roomGame 	= roomArr.roomGame
				let roomTheme 	= roomArr.roomTheme
				let roomId 		= roomArr.roomId


				let appendResponse = JSON.stringify({
					userId: userId,
					sessionId: sessionId
				})


					//Id was passed, so we reserve the exact room
				if(roomName && roomId){

					return client.reserveGameRoom(sessionId, roomName, Date.now(), appendResponse)
						.then((result) => {
							if(!result){
								if(isBot){
									throw new Error('no room for bot')
								} else {
									return client.findAndReserveGameRoom(sessionId, roomPath, Date.now(), appendResponse)
								}
							}
							return result
						})
						.then((roomName) => {
							res.json({
								status: true,
								response: {
									roomName: roomName,
									params: params,
									message: "Reserved the seat for game room: " + roomName
								}
							})
						})
				}

				//we only have path or game room was full, so find and reserve a room
				if(roomPath){

					return client.findAndReserveGameRoom(sessionId, roomPath, maxSubscribers, appendResponse)
						.then((roomName) => {
							res.json({
								status: true,
								response: {
									roomName: roomName,
									params: params,
									message: "Reserved the seat for game room: " + roomName
								}
							})
						})
					//return TODO: remove when more types of rooms
				}*/
			.catch((err) => {
				_error(err)
				return res.status(400).json({
					status: false,
					error: true,
					message: err.message.toString()
				})
			})
	})


	/**
	 * @path /room/reserve
	 * @description reserves the room for the user
	 */
	router.post('/room/invite', (req, res) => {

/*
		req.checkBody('requesterId', 'Invalid user id was entered').isLength({min:1}).isNumeric().withMessage('User id is not numeric')
		req.checkBody('userId', 'Invalid user id was entered').isLength({min:1}).isNumeric().withMessage('User id is not numeric')
		req.checkBody('appName', 'Invalid app name').isLength({min:1}).isIn(serverConfig.appNameList).withMessage('App name is not added or is blocked')
		req.checkBody('sceneName', 'Invalid scene was found').isLength({min:1})
		req.checkBody('sceneParams', 'Invalid params was found').isLength({min:1})
		req.checkBody('gameType', 'Invalid game room type').isLength({min:1})
		req.checkBody('themeName', 'Invalid room theme').isLength({min:1})
		req.checkBody('roomPath', 'Invalid room path').isLength({min:1})
*/

/*		//validate and trigger sanitize the values
		req.getValidationResult().then((result) => {

			if (!result.isEmpty()) {
				res.status(400).json({
					status: false,
					error: true,
					message: result.array()[0].msg
				})
				return //end
			}
		}).catch((err) => {
			res.status(400).json({
				status: false,
				error: true,
				message: err.toString()
			})
		})*/
	})

	router.get('/status/:appName', (req, res) => {
		res.json({ message: 'OK' })
	})

	// test route to make sure everything is working (accessed at GET http://localhost:8080/r)
	router.get('/', (req, res) => {
		res.json({ message: 'OK' })
	})

	app.use(HTTP_API_PATH, router) // all of our routes will be prefixed with /api

	/*	router.post('/admin/refresh/settings', (req, res) => {

            getSettings((config) => {
                res.json({
                    success: true,
                    response: config
                })
            })
        })*/

	return servers.addServer({
		_identifier,
		getServer: () => app,
		start: () =>
			Promise.resolve(app.listen(HTTP_SERVER_PORT))
				.then((svr) => {
					server = svr
					server.timeout = 1000 * 30  // 30 sec
					let host = server.address().address;
					host = (host && host === '::') ? '0.0.0.0' : host
					const port = server.address().port;
					_log(`[${SERVER_NAME}] is listening at http://${host}:${port}${HTTP_API_PATH}`)
					//_log('store serverConfig is ',store.getConfig())
					return 'OK'
				}),
		close: (err) => {
			if(!server) throw new Error('[Server] Already Closed')
			if(err) _error('[Error] Forwarded Error ', err)

			return new Promise((resolve, reject) => {
				server.unref()
				server.close((err) => {
					if(err)
						reject(new Error('failed to close http server ' + err.toString()))
					else {
						console.log('closed w/out error api')
						resolve()
					}
				})
			})
			.return('OK')
			.finally(() => {
				if (servers.hasServer(_identifier)) servers.removeServerById(_identifier)
			})
			.catch((err) => {
				_error('[Error]: On Node Close\n%s', err.toString())
			})
		}
	})
}

module.exports = ApiServer
