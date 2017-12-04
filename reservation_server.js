'use-strict'
const express       = require('express')        // call express
let helmet 			= require('helmet')
const debug         = require('debug')
const _log          = debug('reserveapi')
const Redis         = require('ioredis')
const expressValidator = require('express-validator') //https://github.com/ctavan/express-validator || //https://github.com/chriso/validator.js
const fs            = require('fs')
const util          = require('util')
const helper        = require('./utils/helpers')
const globals       = require('./globals')
const gcm			= require('node-gcm')
const _				= require('lodash')
const dbConfig	= require('./_confs/config.default.json')

const configServer  = globals.getVariable("SERVER_SETTINGS")
const configClient  = globals.getVariable("REDIS_CLIENT")

const redisClient   = new Redis(configClient)
const redisConfigClient = new Redis(configServer)

const app        = express()                 // define our app using express
const bodyParser = require('body-parser')

let server, serverConfig
/*
var message = new gcm.Message();
message.addNotification('title', 'Alert!!!');

// Set up the sender with you API key
var sender = new gcm.Sender(***REMOVED***);

// Add the registration tokens of the devices you want to send to
var registrationTokens = [];
registrationTokens.push('fwsjuAnHXpo:APA91bFbZCTg5rEW_IzLGvHiJvKopclPuHjx5XE8ylYHfHsv-CDyTGpdhkzSn_lNfV61NcF6qHSB7rM9sg7us47HLFsHVmoxBURzlMlYfEeCTEn9N5lho9Qkspm4HF1Wl_CNyhu7wpvw');

sender.send(message, { registrationTokens: registrationTokens }, function (err, response) {
	if(err) console.error(err);
	else    console.log(response);
});*/

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(helmet())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

app.get('/robots.txt', (req, res) => {
	res.type('text/plain')
	res.send("User-agent: *\nDisallow: /")
})

app.use(expressValidator({
    customValidators: {
        "checkMaintenanceMode": () => {
            return !(serverConfig.maintenanceMode && (serverConfig.maintenanceMode === 1 || serverConfig.maintenanceMode === true))
        },
        "isSessionNotExpired": (sessionId) => {
			return redisClient.multi()
				.get('serverTime')
				.zscore('sessions|tick', sessionId)
				.exec()
				.then(([[err0, serverTime], [err1, lastUpdate]]) => {
					if(err0 || err1){ return false }
					return (serverTime-lastUpdate) > 60000
				})
        },
        "isValidGameRoomPath": (roomName) => roomName.match('^(\\w+):(\\w+):([a-zA-Z]+)$'), //appname:game:theme:id
        "isValidGameRoomName": (roomName) => roomName.match('^(\\w+):(\\w+):(\\w+):([0-9]+)$'), //appname:game:theme:id
        "isUserBlocked": (requesterId, userId) => {
			return redisClient.sismember(helper._colon("users", userId, "blocks"), requesterId).then((exists) => exists === 1)
		}
    },
    customSanitizers: {}
})) // this line must be immediately after any of the bodyParser middlewares!

const port = process.env.PORT || 8080 // set our port
const router = express.Router() // get an instance of the express Router
app.use('/api/v1', router) // all of our routes will be prefixed with /api

/**
 * @path /room/reconnect
 * @description reconnect the user to the room by reserving or finding a new room for user
 */
router.use('/room/reconnect', (req, res, next) => {
	res.locals.test = true
	res.redirect(307,'reserve')
})

//Guarantee that the app name and roomArr will be filled by the server
router.use('/room/reserve', (req, res, next) => {

	req.check('', 'Server in in maintenance mode').checkMaintenanceMode()
	req.checkBody('sessionId', 'Invalid session id was entered').notEmpty().isSessionNotExpired().withMessage('Session is expired')
	req.checkBody('roomName', 'Invalid room was entered').notEmpty().contains(':').withMessage('Room was formatted incorrectly')
	req.getValidationResult().then((result) => {
		if (!result.isEmpty()) {
			res.status(400).json({
				status: false,
				error: true,
				message: result.array()[0].msg
			})
			return //end
		}

		const roomArr = helper._roomNameToArr(req.body.roomName)
		req.body.appName = roomArr.roomAppName
		req.body.roomArr = roomArr
		req.body.isReconnected = false /*req.statusCode === 308*/

		if(req.body.userId === "786971"){
			_log('router reserve')
			_log(res.locals)
		}

		next()
	})
})

/**
 * @path /room/reserve
 * @description reserves the room for the user
 */
router.post('/room/reserve', (req, res) => {

    req.checkBody('userId', 'Invalid user id was entered').notEmpty().isNumeric().withMessage('User id is not numeric')
    req.checkBody('params', 'Invalid params was found').notEmpty()
    req.checkBody('params.isGameRoom', 'Invalid game room type').optional().isBoolean()
    req.checkBody('appName', 'Invalid app name').notEmpty().isIn(serverConfig.appNameList).withMessage('App name is not added or is blocked')
    req.checkBody('roomArr', 'Invalid room name').notEmpty()

	let serverTime
    //validate and trigger sanitize the values
    req.getValidationResult().then((result) => {

        if (!result.isEmpty() || _.keys(serverConfig).length === 0) {
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
		_log('this user is a bot', body)

		let roomArr 	= body.roomArr
		let roomName 	= roomArr.roomName
		let roomPath 	= roomArr.roomPath
		let roomGame 	= roomArr.roomGame
		let roomTheme 	= roomArr.roomTheme
		let roomId 		= roomArr.roomId

        let maxSubscribers = serverConfig.maxSubscribersPerRoom[roomGame]

        if(roomTheme === "lobby"){
            //TODO: when a lobby is a true waiting lobby, then change this.
            maxSubscribers = serverConfig.maxSubscribersPerRoom["default"]
        }

        let appendResponse = JSON.stringify({
            userId: userId,
            sessionId: sessionId
        })

        //Id was passed, so we reserve the exact room
        if(roomName && roomId){

            return redisClient.reserveGameRoom(sessionId, roomName, maxSubscribers, JSON.stringify(roomArr), appendResponse)
                .then((result) => {
            		if(!result){
            			if(isBot){
							throw new Error('no room for bot')
						} else {
							return redisClient.findAndReserveGameRoom(sessionId, roomPath, maxSubscribers, appendResponse)
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

            return redisClient.findAndReserveGameRoom(sessionId, roomPath, maxSubscribers, appendResponse)
                .then((roomName) => {
                _log('room rserve props', roomName)
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
        }
    }).catch((err) => {
		res.status(400).json({
			status: false,
			error: true,
			message: err.toString()
		})
	})
})


/**
 * @path /room/reserve
 * @description reserves the room for the user
 */
router.post('/room/invite', (req, res) => {

	req.checkBody('requesterId', 'Invalid user id was entered').notEmpty().isNumeric().withMessage('User id is not numeric')
	req.checkBody('userId', 'Invalid user id was entered').notEmpty().isNumeric().withMessage('User id is not numeric')
	req.checkBody('appName', 'Invalid app name').notEmpty().isIn(serverConfig.appNameList).withMessage('App name is not added or is blocked')
	req.checkBody('sceneName', 'Invalid scene was found').notEmpty()
	req.checkBody('sceneParams', 'Invalid params was found').notEmpty()
	req.checkBody('gameType', 'Invalid game room type').notEmpty()
	req.checkBody('themeName', 'Invalid room theme').notEmpty()
	req.checkBody('roomPath', 'Invalid room path').notEmpty()

	//validate and trigger sanitize the values
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
	})
})

router.get('/status/:appName', (req, res) => {
	res.json({ message: 'OK' })
})

// test route to make sure everything is working (accessed at GET http://localhost:8080/r)
router.get('/', (req, res) => {
    res.json({ message: 'yo' })
})

const getSettings = (callback) => {

	const settingMulti = redisConfigClient.multi()
	let setting

	_.forEach(dbConfig, (value, key) => {
		setting =  dbConfig[key]
		if(_.isFunction(settingMulti[setting.getType])){
			_.invoke(settingMulti, setting.getType, setting.key)
		}
	})

	return settingMulti.exec()
		.then((configs) => {

			if(_.isEmpty(configs) || configs[0][0] || configs[0][1] === null){

				_log('creating default config')
				const settingMulti = redisConfigClient.multi()

				_.forEach(dbConfig, (value, key) => {
					setting =  dbConfig[key]
					if(_.isFunction(settingMulti[setting.setType])){
						_.invoke(settingMulti, setting.setType, setting.defaultValue)
					}
				})

				return settingMulti.exec()
					.then(results => {

						if(_.isEmpty(results) || results[0][0]){
				throw new Error('Invalid Server Config')
			}

						const settingMulti = redisConfigClient.multi()

						_.forEach(dbConfig, (value, key) => {
							setting =  dbConfig[key]
							if(_.isFunction(settingMulti[setting.getType])){
								_.invoke(settingMulti, setting.getType, setting.key)
							}
						})
						return settingMulti.exec()
					})
			}

			return configs
		})
		.then((configs) => {


			if(_.isEmpty(configs) || configs[0][0] || configs[0][1] === null){
				throw new Error('Invalid Server Config')
			}

			serverConfig = {}

			_.forEach(configs, ([err, value], key) => {
				const configName = dbConfig[key].config
				serverConfig[configName] = value
			})

			//update global var
			globals.setVariable("SERVER_CONFIG", serverConfig)
			callback(serverConfig)
		})
		.catch((err) => {
			_log('[Process Error] Invalid Server Config Exception: ', err.toString())
			console.log(err, err.stack.split("\n"))
			process.exit(1)
		})
}

router.post('/admin/refresh/settings', (req, res) => {

	getSettings((config) => {
		res.json({
			success: true,
			response: config
		})
	})
})

/**
 * @path /room/takeTurn
 * @description consumes the user's turn for the user
 */
router.post('/room/takeTurn', (req, res) => {
	req.check('', 'Server in in maintenance mode').checkMaintenanceMode()
	req.checkBody('sessionId', 'Invalid session id was entered').notEmpty().isSessionNotExpired().withMessage('Session is expired')
	req.checkBody('roomName', 'Invalid room was entered').notEmpty().contains(':').withMessage('Room was formatted incorrectly')
	req.checkBody('details', 'Invalid details entered').notEmpty()
	req.getValidationResult().then((result) => {
		if (!result.isEmpty()) {
			res.status(400).json({
				status: false,
				error: true,
				message: result.array()[0].msg
			})
			return //end
		}
	})
})

/**
 * Config client is ready
 */
redisConfigClient.on('ready', () => {

	getSettings((config) => {
		if(_.keys(config).length === 0){
			const err = new Error('SETTINGS ARE NOT FILLED IN, EITHER IT IS EMPTY OR IT GOT ERASED VIA REDIS MEMORY MANAGEMENT')
			console.error(err.message)
			throw err
		}

		//start the http server
		server = app.listen(port, () => {
			if(process.send){
				_log('Reservation API online on port: ' + port)
				process.send('ready')
			}
		})
	})
	.catch((err) => {
		_log('[Process Error] Server Config Not Found: ', err.toString())
		console.log(err, err.stack.split("\n"))
		process.exit(1)
	})
})

redisClient.defineCommand('takeTurn', {
	numberOfKeys: 5,
	lua: fs.readFileSync("./scripts/redis/rooms/reserveGameRoom.lua", "utf8")
})

redisClient.defineCommand('reserveGameRoom', {
    numberOfKeys: 4,
    lua: fs.readFileSync("./scripts/redis/rooms/reserveGameRoom.lua", "utf8")
})

redisClient.defineCommand('findAndReserveGameRoom', {
    numberOfKeys: 3,
    lua: fs.readFileSync("./scripts/redis/rooms/findAndReserveGameRoom.lua", "utf8")
})

_log('Reservation API is starting up')

process.stdin.resume()

const _onNodeClose = () => {
	//disconnect the redis client if connected
	if(redisConfigClient)
		redisConfigClient.disconnect()

	//Check if server has already started
	if(server){
		server.close((err) => {
			process.stdout.write('\033c')
			process.exit(err ? 1 : 0)
		})
	} else {
		process.exit(0)
	}

}

//Listen for exit events
//Catch SIGINT and close server gracefully
process.on('SIGINT', _onNodeClose)

//Catch SIGTERM and close server gracefully
process.on('SIGTERM', _onNodeClose)

/**
 * Process any uncaught exceptions
 */
process.on('uncaughtException', (err) => {
	_log('[Process Error] Uncaught Exception: ', err.toString())
	console.log(err, err.stack.split("\n"))

	process.exit(1)
})

process.on('unhandledRejection', function (err) {
	_log('[Process Error] unhandledRejection: ', err.toString())
	console.log(err, err.stack.split("\n"))

	process.exit(1)
	throw err;
});
