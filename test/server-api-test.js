/* global describe it */
const uuidv4 		= require('uuid/v4')
const request 		= require('request')
const httpServer 	= require('../http_server.js')
const chai = require('chai')
chai.should()
//simulated client (taken functions from dashboard)
process.env.NODE_PATH = '.'
process.env.DEBUG_COLORS = true
process.env.DEBUG_HIDE_DATE = true
process.env.NODE_ENV = "development"
process.env.DEBUG = "*,-not_this,-ioredis:*,-bull"
const HTTP_SERVER_PORT = process.env.HTTP_SERVER_PORT
//uses mocha chai
//uses API for chai - http://chaijs.com/api/
//Don't use arrow ES6 on mocha (recommended)
describe('HTTP Server',function(){
	this.timeout(10000)
	let args = {
		"sessionId": false,
		"appName": "source",
		"userId": 50001,
		"roomName": "source:slots:enchantedForest",
		"params": {
			"isGameRoom": true
		}
	}

	before(function(done){
		httpServer.init((hResult) => {
			console.log('http result', hResult)
			done()
		})

		args.sessionId = uuidv4()
	})

	//test against dummy data
	it('reserve room with path and game room', function(done){
		args.params = {
			"isGameRoom": true
		}

		new request({
			method: 'POST',
			url: `http://0.0.0.0:${HTTP_SERVER_PORT}/api/v1/room/reserve`,
			json:true,
			body: args,
		}, (err, response, resBody) => {
			console.log('request end', resBody)
			resBody.should.be.an('object')
			resBody.should.to.have.nested.property('response.roomName')
			resBody.response.roomName.should.to.have.string(args.roomName)
			resBody.should.to.have.nested.property('response.message')
			resBody.response.message.should.to.have.string('Reserved the seat for game room: '+args.roomName)
			resBody.should.to.have.nested.property('response.params')
			resBody.response.params.should.to.have.nested.property('isGameRoom')

			done(err)
		})
	})

	after(function(done){
		httpServer.destroy().then((result) => {
			console.log('destroy')
			done()
		})
	})

})
