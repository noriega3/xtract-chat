const Promise       = require("bluebird")
const os         	= require('os')
let pm2         	= Promise.promisifyAll(require('pm2'))
const _         	= require('lodash')
const uuid5         = require('uuid/v5')    //https://github.com/kelektiv/node-uuid
const debug         = require('debug')      //https://github.com/visionmedia/debug
const WebSocket		= require('ws')
const _log          = debug('wsDashClient')
const _error        = debug('wsDashClient:err')
const store			= require('../store')
const get			= require('lodash/get')
//TODO: reformat to client, nodesocket, socket listener format

const configPath = './ecosystem.config.js'
const configFile = require(`../${configPath}`)
const helpers 		= require("../util/helpers");

const parseLodash = (str) => {
	return _.attempt(JSON.parse.bind(null, str));
}

const WebSocketDashboardClient = (wsSocket, req) => {
	const serverUuid = store.getUuid()
	const maxBufferSize = store.getMaxBufferSize()
	const _type = 'ws'
	const _address = `${get(req, 'headers.x-forwarded-for', get(req, 'connection.remoteAddress', 'invalid'))}:${get(wsSocket, '_socket.remotePort', Date.now())}`
	const _identifier = uuid5(_address,serverUuid) //use this via server to target
	const _buffer = Buffer.allocUnsafe(maxBufferSize).fill(0)

	_log('[Open Socket ws]: %s | %s', _address, _identifier)

	const actions = setupSocket(_identifier, wsSocket)

	return store.clients.addClient({
		_identifier,
		_type,
		...actions, //add additional actions client can perform
		getClientType: () => _type,
		getAddress: () => _address,
		getSessionId: () => _identifier,
		getBuffer: () => _buffer,
	})
}

const setupSocket = (identifier, ws) => {

	const intentActions = setIntentHandlers(ws)

	ws.on('message', (req) => {
		const data = parseLodash(req)
		const isJSON = helpers._isJson(req)

		if(!data || !isJSON) return intentActions.sendMessage({event: 'data', error:true, response: 'Invalid JSON'})

		const intent = (data && data.intent) ? data.intent : "error"

		if(intent){
			if(!_.invoke(intentActions, intent, data))
				intentActions.sendMessage({error: true, response: 'Bad Intent for data', request: req})
			return true
		} else {
			_error("No intent defined for data: ", data)
			return intentActions.sendMessage({error: true, response: 'No Intent for data', request: req})
		}
	})

	ws.on('error', (err) => {
		//clientUtil._handleSocketError(identifier, ws, err)
		if (err.errno) return
		throw err

	})

	ws.on('close', (...args) => {
		if(ws.redis){
			ws.redis.quit()
			ws.redis = null
			delete ws.redis
		}

		if(ws.sub){
			ws.sub.quit()
			ws.sub = null
			delete ws.sub
		}

		if(pm2){
			pm2.disconnect()
		}

		//clientUtil._handleSocketClose(identifier, ws, args)
	})
	ws.on('timeout', (...args) => {
		//clientUtil._handleSocketTimeout(identifier, ws, args)
	})

	intentActions.refreshAllStatuses()
	intentActions.connectToBus()
	intentActions.sendMessage(JSON.stringify({event:'statusChange', id:'connected', 'status': true}))

	return {
		send: intentActions.sendMessage //make it public
	}
}


const setIntentHandlers = (ws) => {

	const sendMessage = (message = {event: false, error:true, response:"Unhandled Error"}, cb) => {
		if (!_.isEqual(ws.readyState, WebSocket.OPEN)) return _error('[Socket] not open, skipping.')
		if(_.isObject(message)){
			return ws.send(JSON.stringify(message), (error) => {
				if(_.has('terminate', ws)){
					_error('[WS Error]: ', error)
					return ws.terminate()
				}
			})
		} else {
			return ws.send(message.toString(), (error) => {
				if(_.has('terminate', ws)){
					_error('[WS Error]: ', error)
					return ws.terminate()
				}
			})
		}
	}

	const connectToPm2 = () => {
		pm2.connect((error) => {
			if(error){
				return sendMessage({event:'statusChange', id:'pm2Connect', status: false, error:true})
			}
			return sendMessage({event:'statusChange', id:'pm2Connect', status: true}) && sendMessage({event:'statusChange', id:'isLogging', status: this.isLogging})
		})
	}
	const error = (data) => {
		if(this.socket)	sendMessage({error: true, response: data.toString()})
	}
	const pm2Callback = (error = true, message = "Unhandled Message") =>{
		if(this.socket){
			sendMessage({error: error, response: message})
		}
		return false
	}
	const startLog = () => {
		this.isLogging = _.isEqual(true, this.busConnected)
		sendMessage({event:'statusChange', id:'isLogging', status: this.isLogging, message: this.isLogging && 'OK' || 'pm2 bus not connected'})
	}
	const stopLog = () => {
		this.isLogging = false
		sendMessage({event:'statusChange', id:'isLogging', status: this.isLogging})
	}
	const status = () =>_.throttle(() => {
			sendMessage({
				event: 'status',
				response: {
					connections: store.clients.getSize(),
					upTime: os.uptime(),
					freeMem: os.freemem(),
					totalMem: os.totalmem(),
					usagePercent: (os.totalmem()-os.freemem()) / os.totalmem(),
					processUsage: process.memoryUsage().heapUsed,
					loadAverages: os.loadavg(),
					cpus: os.cpus()
				}})
	}, 5000)
	const pm2Status = () => _.throttle(() => {
		if(!pm2 || !_.has(pm2, 'listAsync')) return
		pm2.listAsync()
			.then((results) => {
				sendMessage({event: 'pm2Status', response: results})
			})
			.catch((err) => sendMessage({
				event: 'pm2Status',
				error: err.toString(),
				response: err.toString()
			}))
	}, 3000)
	const connectToBus = () =>{
		pm2.launchBus((error, bus) => {
			if(error) return pm2Callback(error, 'startLog')

			this.busConnected = true
			bus.on('log:err', (data) => {
				if(!this.isLogging) return
				sendMessage({event:'log', type:'err', response: data})
			})

			bus.on('log:out', (data) => {
				if(!this.isLogging) return
				sendMessage({event:'log', type:'out', response: data})
			})

			bus.on('close', () => {
				this.busConnected = false
				stopLog()
			})
			sendMessage({event:'statusChange', id:'pm2BusConnect', status: true})
		})
	}
	const reload = () =>{
		pm2.start(configFile, (err) => {
			if(err) return sendMessage({event: 'reload', error: true, message: err.toString()})
			pm2Status()
		})
	}
	const restart = ({serverName}) => {
		sendMessage({event: 'restart', response: 'RESTART REQ'})
		pm2.restart(serverName ? serverName : 'all', (err) => {
			if(err) return sendMessage({event: 'restart', error: true, message: err.toString()})
			pm2Status()
		})
	}
	const watch = ({serverName}) => {
		sendMessage({event: 'watch', response: 'WATCH REQ'})
		let serverFile = _.find(configFile.apps, {'name': serverName})
		if(_.isSet(serverFile, 'watch'))
			_.set(serverFile, 'watch', true)
		serverFile.watch = true
		pm2.start({name: serverName, 'watch': true} ,(err) => {
			if(err) return sendMessage({event: 'watch', error: true, message: err.toString()})
			pm2Status()
		})
	}
	const unwatch = ({serverName}) => {
		sendMessage({event: 'unwatch', response: 'WATCH REQ'})
		pm2.start(serverName,{'watch': false} ,(err) => {
			if(err) return sendMessage({event: 'unwatch', error: true, message: err.toString()})
			pm2Status()
		})
	}
	const info = () =>{
		pm2.describe('all', (err,des) => {
			if(err) return sendMessage({event: 'info', error: true, message: err.toString()})
			sendMessage({event: 'info', response: des})
		})
	}
	const start = ({serverName}) =>{
		const processName = (serverName) ? serverName : configFile
		sendMessage({event: 'start', response: 'START REQ'})

		pm2.start(processName, (err) => {
			if(err) return sendMessage({event: 'start', error: true, message: err.toString()})
			pm2Status()
		})

	}
	const stop = ({serverName}) =>{
		const processName = (serverName) ? serverName : configFile
		sendMessage({event: 'stop', response: 'STOP REQ'})
		pm2.stop(processName, (err) => {
			if(err) return sendMessage({event: 'stop', error: true, message: err.message})
			pm2Status()
		})
	}
	const disconnect = () => {
		sendMessage({event:'statusChange', id:'pm2Connect', status: false})
		sendMessage({event:'statusChange', id:'pm2BusConnect', status: false})
		pm2.disconnect()
	}
	const disconnectToBus = () => {
		sendMessage({event:'statusChange', id:'pm2BusConnect', status: false})
		pm2.disconnectBus()
	}
	const refreshAllStatuses = () => {
		pm2Status()
		status()
	}

	return {
		sendMessage,
		connectToPm2,
		error,
		pm2Callback,
		startLog,
		stopLog,
		status,
		pm2Status,
		connectToBus,
		reload,
		restart,
		watch,
		unwatch,
		info,
		start,
		stop,
		disconnect,
		disconnectToBus,
		refreshAllStatuses
	}
}

module.exports = WebSocketDashboardClient
