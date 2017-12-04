const Promise       = require("bluebird")
const os         	= require('os')
let pm2         	= Promise.promisifyAll(require('pm2'))
const _         	= require('lodash')    //https://github.com/broofa/node-uuid
const uuid4         = require('uuid/v4')    //https://github.com/broofa/node-uuid
const uuid5         = require('uuid/v5')    //https://github.com/broofa/node-uuid
const debug         = require('debug')      //https://github.com/visionmedia/debug
const buffer         = require('buffer')

//https://github.com/visionmedia/debug
const _log          = debug('ps_dashboard')
const _error          = debug('error')
const globals       = require('../globals')
const Sockets       = globals.sockets
const redisManager  = require('../scripts/redis_manager')
const {client, settingsClient, subscriber} = redisManager
const helper = require("../utils/helpers");
const roomSubQueue  = redisManager.roomSubQueue
const roomQueue     = redisManager.roomQueue
const sessionQueue  = redisManager.sessionQueue
const config  		= require('../ecosystem.config')
const maxBufferSize = globals.getVariable("BUFFER_SIZE")
const serverName    = globals.getVariable("SERVER_NAME")
const serverUuid    = uuid4(serverName)
const addConfig = {
    attempts: 3,
	timeout: 5000,
	removeOnComplete: true
}
let onErrBack
const parseLodash = (str) => {
	return _.attempt(JSON.parse.bind(null, str));
}

const helpers = {
	pm2Callback: (ws, error = true, message = "Unhandled Message") => {
		pm2.disconnect()
		if(ws){
			helpers.sendMessage(ws, {error: error, response: message})
		}
		return false
	},
	sendMessage: (ws, message = {event: false, error:true, response:"Unhandled Error"}) => {
		ws.send(JSON.stringify(message), (error) => {
			if(_.has('terminate', ws)){
				_error('[WS Error]: ', error)
				return ws.terminate()
			}
		})
	}
}

const onSocketData = (ws, req) => {

	_log('[DASH LOG]', req)

	const data = parseLodash(req)

	if(!data){
		return helpers.sendMessage(ws, {event: 'data', error:true, response: 'Invalid JSON'})
	}

	const intent = (data && data.intent) ? data.intent : false
	const serverName = (data && data.serverName) ? data.serverName : false
	const processName = (serverName) ? serverName : './ecosystem.config.js'

	//Determine route based on intent
	switch(intent){
		case "startLog":
			pm2.launchBus((error, bus) => {
				if(error) return helpers.pm2Callback(ws, error, intent)

				helpers.sendMessage(ws, {event: intent, response: 'START LOG'})

				bus.on('log:*', (type, data) => {
					helpers.sendMessage(ws, {event:'log', type, response: data})
				})
			})
			break
		case "stopLog":
			pm2.disconnect()
			helpers.sendMessage(ws, {event: intent, response: 'STOP LOG'})
			break
		case "reload":
			pm2.connect((error) => {
				if(error) return helpers.pm2Callback(ws, error, intent)

				helpers.sendMessage(ws, {event: intent, response: 'RELOAD REQ'})

				pm2.start('./ecosystem.config.js', (err) => {
					pm2.disconnect()
					helpers.sendMessage(ws, {event: intent, error: !_.isNil(err), response: err || 'RELOAD OK'})
				})
			})

			break
		case "restart":
			pm2.connect((error) => {
				if(error) return helpers.pm2Callback(ws, error, intent)

				helpers.sendMessage(ws, {event: intent, response: 'RESTART REQ'})

				pm2.restart(serverName ? serverName : 'all', (err) => {
					pm2.disconnect()
					helpers.sendMessage(ws, {event: intent, error: !_.isNil(err), response: err || 'RESTART OK'})
				})
			})

			break
		case "info":
			pm2.connect((error) => {
				if(error) return helpers.pm2Callback(ws, error, intent)
				pm2.describe('all', (err,des) => {
					helpers.sendMessage(ws, {event: intent, error: !_.isNil(err), response: err || des})
					pm2.disconnect()
				})
			})

			break
		case "start":
			pm2.connect((error) => {
				if(error) return helpers.pm2Callback(ws, error, intent)

				helpers.sendMessage(ws, {event: intent, response: 'START REQ'})

				pm2.start(processName, (err) => {
					pm2.disconnect()
					helpers.sendMessage(ws, {event: intent, error: !_.isNil(err), response: err || 'START OK'})
				})
			})

			break
		case "stop":
			pm2.connect((error) => {
				if(error) return helpers.pm2Callback(ws, error, intent)

				helpers.sendMessage(ws, {event: intent, response: 'STOP REQ'})

				pm2.stop(processName, (err) => {
					pm2.disconnect()
					helpers.sendMessage(ws, {event: intent, error: !_.isNil(err), response: err || 'STOP OK'})
				})
			})

			break
		case "status":
			const used = process.memoryUsage().heapUsed / 1024 / 1024
			helpers.sendMessage(ws, {event: intent, response: [
				{ key: "connections", value: Sockets.length },
				{ key: "upTime", value: used },
				{ key: "totalMem", value: os.totalmem() },
				{ key: "memoryUsage", value: used },
				{ key: "loadAverages", value: os.loadavg() },
			]})
			break
		case "pm2status":
			pm2.listAsync()
				.then((results) => helpers.sendMessage(ws, {event: intent, response:results}))
				.catch((err) => helpers.sendMessage(ws, {event: intent, error:err.toString(), response:err.toString()}))
			break

		case "matches":
			client.smembers('matches|')
				.then(results => {
					//TODO: get opt in list to fill list view

				helpers.sendMessage(ws, {event: 'matchList', response:results})
			})
			.catch((err) => helpers.sendMessage(ws, {event: intent, error:err.toString(), response:err.toString()}))
			break
		case "matchdetails":
			console.log(data)

			//TODO: add selectable to listview to populate details
			const roomName = _.get(data, 'roomName')

			if(roomName){
				subscriber.psubscribe('rooms|'+data.roomName)
				subscriber.on('pmessage', (pattern, channel, message) => {
					console.log(message)


					const parsed = message && helper._isJson(message) ? JSON.parse(message) : {}
					const dateInSeconds = Date.now() / 1000

					if(pattern === 'rooms|*'){

						if(helper._isObject(parsed)) {
							if(parsed.messages){
								Promise.map(parsed.messages, (msg) => {
									//add serverTime to response
									msg.serverTime = dateInSeconds
									return helpers.sendMessage(ws, {event: 'matchdetails', response: msg})
								})

							} else if(parsed.message){
								parsed.message.serverTime = dateInSeconds
								helpers.sendMessage(ws, {event: 'matchdetails', response: parsed.message})
							}
						}

					}
				})
			} else {
				helpers.sendMessage(ws, {event: 'matchdetails', response:'error'})
			}
			break
		default:
			_error("No intent defined for data: ", data)
			return helpers.sendMessage(ws, {error: true, response: 'No Intent for data', request: req})
	}
}

const onSocketError = (sessionId) => {

}

const onSocketClose = (sessionId) => {
	setImmediate(() => {
        _log('[Closed WS]: %s', sessionId)
        Sockets.deleteSocketBySessionId(sessionId)
    })
}

/**
 * Main function, handles a creation of a socket instance, and bridges the connection with a redis instance
 * @param socket
 */
function dashboardClientBridge(socket){
	socket.send(JSON.stringify({status:'connected'}))

    //Set the configs for the socket
    socket.isConnected = true

    const remoteIp = socket.remoteAddress + ':' + socket.remotePort
    let sessionId = uuid5(remoteIp, serverUuid)

    socket.serverVersion    = 2
    socket.sessionId        = sessionId
    socket.name             = remoteIp
    socket.state            = "connecting" //set state to connection aka init
	//socket.buffer           = Buffer.allocUnsafe(maxBufferSize).fill(0) //create a buffer for the socket with the max size defined
    //socket.buffer           = Buffer.allocUnsafeSlow(maxBufferSize).fill(0) //create a buffer for the socket with the max size defined (changed 1120)
    //socket.bufferLen        = 0

    _log('[Dashboard Socket]: %s | %s', socket.name, sessionId)
    //_log('[Buffer Length]: %s', socket.bufferLen)

    //socket.setEncoding('utf-8') //TODO: check if this will cause processing we dont need
    socket.on('message', (rawData) => onSocketData(socket,rawData))
    socket.on('error', (e) => onSocketError(sessionId,e))
    socket.on('close', () => onSocketClose(sessionId))

	//globals.pushVariable("clientSocketsList", socket)
	Sockets.addSocket(socket)

	return socket
}

module.exports = dashboardClientBridge
