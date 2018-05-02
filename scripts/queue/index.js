"use strict"
const Queue         = require('bull')
const {log}         = require('../../util/loggers')
const store			= require('../../store')
const db		= store.database
//Overwrites for bull queue, to use same redis instances for client and subscriber
const queueOverwrites = {
	prefix: "Workers",
	createClient: (type, opts) => {
		console.log('new worker')

		switch (type) {
			case 'client': return db.getQueueClient()
			case 'subscriber': return db.getQueueSubClient()
			default: return db.createQueueClient(opts)
		}
	}
}
const createQueue = (name) => {
	log("[Created a new queue: %s]", name)
	return new Queue(name, queueOverwrites)
}
module.exports = createQueue
