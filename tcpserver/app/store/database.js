"use strict"
const debug         = require('debug')      //https://github.com/visionmedia/debug
debug.log = console.info.bind(console) //one all send all to console.
const _log        = debug('database')
const _error        = debug('database:err')

const Promise       = require('bluebird')
const _has    		= require('lodash/has')
const _hasIn   		= require('lodash/hasIn')
const _remove		= require('lodash/remove')
const _size			= require('lodash/size')
const EventEmitter 	= require('events')
let Redis         = require('ioredis')
Promise.promisifyAll(Redis)
Promise.promisifyAll(Redis.prototype)

const defaultConfig = {
    host: process.env.PS_HOST,
    port: process.env.PS_PORT,
    password: process.env.PS_PASS
}

//const dbCommands 	= require('../scripts/redis')
const dbCommands 	= require('../scripts/redis2')
let _connections = []
EventEmitter.defaultMaxListeners = 100

let dbClient, queueClient, queueSubClient, settingsClient
dbClient = new Redis({
	...defaultConfig,
	lazyConnect:true
})

//Capture unhandled rejects
Redis.Promise.onPossiblyUnhandledRejection(function (error) {
	_error('[REDIS ERROR]', error)

	// you can log the error here.
	// error.command.name is the command name, here is 'set'
	// error.command.args is the command arguments, here is ['foo']
	if(error.command && error.command.name && error.command.args){
		_error("[Redis Error] %s",error.command.name, error.command.args, error)
	}
})

const createConnection = (name, opts = {}) => {
	if(dbClient) return dbClient
	dbClient = new Redis({
		...defaultConfig,
		lazyConnect:true
	})
	dbCommands(dbClient)
	_connections.push(dbClient)
	return dbClient
}

const getConnection = function(){
	return Promise.resolve(createConnection()).disposer(function(){
		if(!dbClient) return
		if(_hasIn(dbClient, 'disconnect')) dbClient.disconnect()
		if(_hasIn(dbClient, 'unref')) dbClient.unref()
		_remove(_connections, dbClient)
		dbClient = null
		//_log('removed connection', process.title, _connections)
	})
}

const withDatabase = function(transaction, optClient){
	if(optClient) return Promise.try(() => transaction(optClient))
	return Promise.using(getConnection(), function(connection){
		return Promise.try(() => transaction(connection))
	})
}

const withSettingsDatabase = function(transaction, optClient){
    if(optClient) return Promise.try(() => transaction(optClient))
    return Promise.using(getSettingsClient(), function(connection){
        return Promise.try(() => transaction(connection))
    })
}

const createQueueClient = (opts = {}) => {
	let newC = new Redis({
		...opts,
		...defaultConfig
    })
	if(_connections.push(newC)) return newC
	throw new Error('Invalid Queue Client Created')
}

const createSettingsClient = (opts = {}) => {
	const store = require('.')
	let connection = new Redis({
		...opts,
		...defaultConfig,
		db: 1
	}, {retryStrategy: (times) => Math.min(Math.exp(times), 20000)})
	connection.client('setname', 'dbSettings')
    require('@redis/attachConfigCmds')(connection)
	Promise.promisifyAll(connection)
	if(_connections.push(connection)) return connection
	throw new Error('Invalid Settings Client Created')
}

const createQueueSubClient = (opts = {}) => {
	let newC = new Redis({
		...opts,
		...defaultConfig,
	})
	if(_connections.push(newC)) return newC
	throw new Error('Invalid Sub Client Created')
}

const getQueueClient = (opts) => {
	if(!queueClient) queueClient = createQueueClient(opts)
	return queueClient
}

const getQueueSubClient = (opts) => {
	if(!queueSubClient)	queueSubClient = createQueueSubClient(opts)
	return queueSubClient
}

const getSettingsClient = (opts) => {
	if(!settingsClient)	settingsClient = createSettingsClient(opts)
	return settingsClient
}

const close = () => {

	if(_has(dbClient, 'disconnect')) dbClient.disconnect()
	if(_has(queueClient, 'disconnect')) queueClient.disconnect()
	if(_has(queueSubClient, 'disconnect')) queueSubClient.disconnect()
	if(_has(settingsClient, 'disconnect')) settingsClient.disconnect()

	return Promise.reduce(_connections, (result, c) => {
		if(_has(c, 'disconnect')) return c.disconnect().then(()=> {
			_remove(_connections, c)
			return result+1
		})
		return result+1
	}, 1)
}

const call = (commandName, params) => {
	if(_size(params) > 0)
		return Promise.using(getConnection(), (client) => client[commandName](...params))
	else
		return Promise.using(getConnection(), (client) => client[commandName]())
}

//Create redis instances
exports = module.exports = {
	createConnection,
    withSettingsDatabase, //latest revision
	withDatabase, //latest revision
	getConnection, //deprecated
	createQueueClient,
	getQueueClient,
	getQueueSubClient,
	getSettingsClient,
	close,
	call
}
/*
setInterval(function(){
	console.log('----------------------------------------------------')
	console.log(`${_dbClients.length},\n ${_dbClientNames}`)
	console.log('----------------------------------------------------')
},1000)

*/
