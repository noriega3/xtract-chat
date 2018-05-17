"use strict"
const debug         = require('debug')
debug.log = console.info.bind(console) //one all send all to console.
const _log          = debug('newQueue')
const _error        = debug('newQueue:err')

const Queue         = require('bull')
const store			= require('../../store')
const db		= store.database
const _hasIn		= require('lodash/hasIn')
//Overwrites for bull queue, to use same redis instances for client and subscriber
const queueOverwrites = {
	prefix: "Workers",
	createClient: (type, opts) => {
		switch (type) {
			case 'client': return db.getQueueClient()
			case 'subscriber': return db.getQueueSubClient()
			default: return db.createQueueClient(opts)
		}
	}
}
const createQueue = (name) => {
	_log("[Created a new queue: %s]", name)
	return new Queue(name, queueOverwrites)
}
module.exports = createQueue
