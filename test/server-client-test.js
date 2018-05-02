/* global describe it */
process.title = 'node-mocha'
const Promise = require("bluebird")
const _isEqual = require("lodash/isEqual")
const chai = require('chai')
chai.config.includeStack = true; // turn on stack trace
chai.config.showDiff = true; // turn off reporter diff display
chai.config.truncateThreshold = 10; // disable truncating
chai.should()
const expect = chai.expect

//simulated client (taken functions from dashboard)
process.env.NODE_PATH = '.'
process.env.DEBUG_COLORS = true
process.env.DEBUG_HIDE_DATE = true
process.env.NODE_ENV = 'development'
process.env.DEBUG = '*,-not_this,-ioredis:*,-bull'
const TCP_SERVER_PORT = process.env.TCP_SERVER_PORT || 7776 //default for 7776 for client-test
//uses mocha chai
//uses API for chai - http://chaijs.com/api/
//Don't use arrow ES6 on mocha (recommended)
const Subscriber = require('../scripts/bots/subscriber')

const createSocketTest = (name, path) => {
    describe(name, function(){
		this.timeout(10000)
		require(path)
	});
}

describe('Server', function(){
	this.timeout(60000)
/*	const nodeServer = require('../pubsub_server.js')
	const httpServer = require('../http_server.js')

	this.timeout(10000)

	before(function(done){
		nodeServer.init(() => done())
	})

	before(function(done){
		httpServer.init(() => done())
	})*/

	createSocketTest('System Room', './client-system-test')
	createSocketTest('Standard Room', './client-standard-test')
	createSocketTest('Realtime Room', './client-realtime-test')
	createSocketTest('Turnbased Room', './client-turnbased-test')

/*	after(function(done){
		httpServer.destroy(() => done())
	})

	after(function(done){
		nodeServer.destroy(() => done())
	})*/


})
