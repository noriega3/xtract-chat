/**
 * Creates redis instances and wraps the bull queue to share redis instances for client/sub and rest of server
 */
'use strict'
const _         	= require('lodash')
const Redis         = require('ioredis')
const Queue         = require('bull')
const debug         = require('debug')      //https://github.com/visionmedia/debug
const _log          = debug('queue_man')
const _error        = debug('redis_error')

const serverScripts		= require('./server/server-scripts')
const globals           = require('../globals')
const SERVER_NAME       = globals.getVariable("SERVER_NAME")
const configSub         = globals.getVariable("REDIS_SUBSCRIBER")
const configClient      = globals.getVariable("REDIS_CLIENT")
const configServer      = globals.getVariable("SERVER_SETTINGS")
const configDefault     = globals.getVariable("REDIS_DEFAULT")

//Capture unhandled rejects
Redis.Promise.onPossiblyUnhandledRejection(function (error) {
	_log('error', error.toString())
	// you can log the error here.
	// error.command.name is the command name, here is 'set'
	// error.command.args is the command arguments, here is ['foo']
	if(error.command && error.command.name && error.command.args){
		_error("[Redis Error] %s",error.command.name, error.command.args, error)
	}
});

//Create redis instances
const dbSubscriber 		= new Redis(configSub) //only one
const dbClient 			= new Redis(configClient) //only one
const dbServerSettings 	= new Redis(configServer) //only one

//add clustering support without changing actual config file
globals.setVariable("REDIS_SUBSCRIBER",configSub)
globals.setVariable("REDIS_CLIENT",configClient)

//Hold all queues created for this node worker
let queueList = []

//init the main server script and attach any custom commands or functions
serverScripts(dbClient, dbSubscriber, dbServerSettings)

//Overwrites for bull queue, to use same redis instances for client and subscriber
const queueOverwrites = {
	createClient: (type, opts) => {
		switch (type) {
			case 'client': return dbClient
			case 'subscriber': return dbSubscriber
			default:
				return new Redis(_.merge(opts, configDefault))
		}
	}
}

//Create the main "class"
const Manager = () => {}
Manager.subscriber = dbSubscriber
Manager.client = dbClient
Manager.settingsClient = dbServerSettings

//Wrapper that creates a new bull queue to always use same redis connection
Manager.newQueue = (name) => {

	let newQueue = new Queue(name, queueOverwrites) //supports redis clustering (NOT node clustering via pm2)
	newQueue.name = name
	Manager[name] = newQueue
	_log("[Created a new queue: %s]", name)
	return newQueue
}

Manager.destroyQueues = () => {
	return queueList.map((queue) => {
		_log('[Queue Closed] %s', queue.name)
		return queue.close()
	})
		.then((results) => true)
		.catch((err) => {
			_log('[Queue Close Err] '+ err.toString())
			return false
		})
}

module.exports = Manager
