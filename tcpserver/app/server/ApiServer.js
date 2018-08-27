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

const SERVER_NAME 		= process.env.SERVER_NAME || 'blue-api'
const HTTP_SERVER_PORT	= process.env.HTTP_SERVER_PORT || 8080
const HTTP_API_PATH		= process.env.HTTP_API_PATH || '/api/v2'

const roomNameToArr = require('../util/roomNameToArr')
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
let config

const ApiServer = () => {
	const app = express()                 // define our app using express
	let server
	app.disable('x-powered-by')
	app.use(helmet())

    config = require('../config.json')
    _log('Using configs', config)

	app.get('/robots.txt', (req, res) => {
		res.type('text/plain')
		res.send("User-agent: *\nDisallow: /")
	})

	// configure app to use bodyParser()
	// this will let us get the data from a POST
	app.use(bodyParser.urlencoded({ extended: true }))
	app.use(bodyParser.json())
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
        _log(req.body)
        const roomArr = roomNameToArr(req.body.roomName)
		_log('room arr', roomArr)
        req.body.appName = req.body.appName || _get(roomArr, 'roomAppName')
        req.body.roomArr = roomArr
        req.body.isReconnected = false /*req.statusCode === 308*/

        //TODO: remove
        if(req.body.userId === "786971"){
            _log('router reserve')
            _log(res.locals)
        }
        next()
    })


	router.post('/auth', [
        check('userId').isLength({min:1}).trim().isNumeric().withMessage('User id is not numeric'),
        check('token')
			.isLength({min:5})
			.trim()
			.custom(token => {
            	return true
			})
			.withMessage('Token is invalid')
	], (req, res, next) => {

		const errors = validationResult(req)

		if(!errors.isEmpty()){
			return res.status(400).json({
				status: false,
				error: true,
				message: errors.mapped()
			})
		}
		_log(req.body)
		const roomArr = roomNameToArr(req.body.roomName)
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
		check('appName').isLength({min:1}).isIn(config.appNames).withMessage('App is not enabled'),
		check('roomArr').isLength({min:1}).withMessage('Invalid room arr')
	], (req, res) => {

		_log('cfg', config, req.body)

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
		return apiQueue.add('room.reserve', req.body, addConfig)
			.call('finished')
			.then((result) => {
				if (!result || _isEmpty(result)) throw new Error('Invalid response.')
				return res.json(result)
			})
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
	 * @path /room/invite
	 * @description reserves the room for the user
	 */
	router.post('/room/invite', [
		check('userId').isLength({min:1}).trim().isNumeric().withMessage('User id is not numeric'),
		check('requesterId').isLength({min:1}).trim().isNumeric().withMessage('RequesterId id is not numeric'),
		check('appName','invalid appName').isLength({min:1}).isIn(config.appNames).withMessage('App is not enabled'),
		check('sceneName').isLength({min:1}).withMessage('Invalid sceneName'),
		check('roomPath').isLength({min:1}).withMessage('Invalid roomPath'),
		check('roomId').isLength({min:1}).withMessage('Invalid roomId'),
		check('themeName').isLength({min:1}).withMessage('Invalid themeName'),
		check('gameType').isLength({min:1}).withMessage('Invalid gameType'),
		check('sceneParams').isLength({min:1}).withMessage('Invalid sceneParams')
	], (req, res) => {

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
		return apiQueue.add('room.invite', req.body, addConfig)
			.call('finished')
			.then((result) => {
				if (!result || _isEmpty(result)) throw new Error('Invalid response.')
				return res.json(result)
			})
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
	 * @path /room/invite/confirm
	 * @description reserves the room for the user
	 */
	router.post('/room/invite/confirm', [
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
		check('userId').isLength({min:1}).trim().isNumeric().withMessage('User id is not numeric'),
		check('roomName').isLength({min:1}).withMessage('Invalid roomName'),
		check('params').isLength({min:1}).withMessage('invalid params')
	], (req, res) => {

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
		return apiQueue.add('room.invite.confirm', req.body, addConfig)
			.call('finished')
			.then((result) => {
				if (!result || _isEmpty(result)) throw new Error('Invalid response.')
				return res.json(result)
			})
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
	 * @path /room/reconnect
	 * @description reserves the room for the user
	 */
	router.post('/room/invite/confirm', [
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
		check('userId').isLength({min:1}).trim().isNumeric().withMessage('User id is not numeric'),
		check('roomName').isLength({min:1}).withMessage('Invalid roomName'),
		check('params').isLength({min:1}).withMessage('invalid params')
	], (req, res) => {

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
		return apiQueue.add('room.reconnect', req.body, addConfig)
			.call('finished')
			.then((result) => {
				if (!result || _isEmpty(result)) throw new Error('Invalid response.')
				return res.json(result)
			})
			.catch((err) => {
				_error(err)
				return res.status(400).json({
					status: false,
					error: true,
					message: err.message.toString()
				})
			})
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
					let host, port
                    server = svr
                    server.timeout = 1000 * 30  // 30 sec
                    host = server.address().address
                    host = (host && host !== '::') ? host : '0.0.0.0'
                    port = server.address().port
                    _log(`[${SERVER_NAME}] is listening at http://${host}:${port}${HTTP_API_PATH}`)
					return Promise.resolve('OK')
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
