"use strict"
const net = require("net")
const chai = require('chai')
const debug = require('debug')
const assert = chai.assert
const expect = chai.expect
const should = chai.should()
const _log          = debug('tests')
//simulated client (taken functions from dashboard)


//uses mocha chai
//uses API for chai - http://chaijs.com/api/
//Don't use arrow ES6 on mocha (recommended)

describe('Simulate socket connection', function () {

	//it('Test connection init', function (done) {

	it('init test', function(done) {
		this.timeout(10000)

		const args = {
			"username": "Player12323A",
			"score": 605000,
			"avatar": "0",
			"userId": "785007",
			"appName": "source"
		}

		const Subscriber = require('../_dashboard/scripts/subscriber')
		const client = Subscriber(args)

		client.on('init', function(response){
			client.disconnect()
			response.should.be.an('object')
			response.should.to.have.nested.property('response.sessionId')
			done()
		})
	})

	it('standard room test', function(done) {
		this.timeout(10000)

		const args = {
			"username": "Player12323A",
			"score": 605000,
			"avatar": "0",
			"userId": "785006",
			"appName": "source"
		}
		const Subscriber = require('../_dashboard/scripts/subscriber')
		const client = Subscriber(args)
		let sessionId

		client.on('init', function(data){
			data.should.be.an('object')
			data.should.to.have.nested.property('response.sessionId')
			sessionId = data.response.sessionId.toString()
			client.requestSubscribe(args.appName+":standard", {isSystem: false})
		})

		client.on('subscribed', function(data){
			data.should.be.an('object')
			data.should.to.have.nested.property('response.sessionId')
			if(data.room === args.appName+":standard" && sessionId && sessionId === data.response.sessionId){
				client.requestUnsubscribe(args.appName+":standard")
			}
		})

		client.on('unsubscribed', function(data){

			if(data.room === args.appName+":standard" && sessionId && sessionId === data.response.sessionId){
				done()
			}
		})
	})

	it('system room test', function(done) {
		this.timeout(10000)

		const args = {
			"username": "Player12323A",
			"score": 605000,
			"avatar": "0",
			"userId": "785006",
			"appName": "slotsfreesocialcasino"
		}
		const Subscriber = require('../_dashboard/scripts/subscriber')
		const client = Subscriber(args)
		let sessionId

		client.on('init', function(data){
			data.should.be.an('object')
			data.should.to.have.nested.property('response.sessionId')
			sessionId = data.response.sessionId.toString()
			client.requestSubscribe("all:system", {isSystem: true})
		})

		client.on('subscribed', function(data){
			data.should.be.an('object')
			data.should.to.have.nested.property('response.sessionId')
			if(data.room === "all:system" && sessionId && sessionId === data.response.sessionId){
				client.requestUnsubscribe("all:system")
			}
		})

		client.on('unsubscribed', function(data){

			if(data.room === "all:system" && sessionId && sessionId === data.response.sessionId){
				done()
			}
		})
	})


	it('sub/unsub realtime room test', function(done) {
		this.timeout(10000)

		const args = {
			"username": "Player12323A",
			"score": 605000,
			"avatar": "0",
			"userId": "785006",
			"appName": "source"
		}
		const Subscriber = require('../_dashboard/scripts/subscriber')
		const client = Subscriber(args)
		let sessionId, roomName

		client.on('init', function(data){
			data.should.be.an('object')
			data.should.to.have.nested.property('response.sessionId')
			sessionId = data.response.sessionId.toString()
			client.findAndReserveRoom(args.appName+":slots:testTheme", {appName: args.appName, isGameRoom: true, isTurnBased: false})
		})

		client.on('reservation', function(data){
			data.should.be.an('object')
			roomName = data.roomName
			client.requestSubscribe(roomName, data.params)
		})

		client.on('subscribed', function(data){
			data.should.be.an('object')
			data.should.to.have.nested.property('response.sessionId')
			if(roomName && data.room === roomName && sessionId && sessionId === data.response.sessionId){
				client.requestUnsubscribe(roomName)
			}
		})

		client.on('unsubscribed', function(data){

			if(roomName && data.room === roomName && sessionId && sessionId === data.response.sessionId){
				done()
			}
		})
	})

	it('sub/unsub turn based room test', function(done) {
		this.timeout(10000)

		const args = {
			"username": "Player12323A",
			"score": 605000,
			"avatar": "0",
			"userId": "785006",
			"appName": "source"
		}
		const Subscriber = require('../_dashboard/scripts/subscriber')
		const client = Subscriber(args)
		let sessionId, roomName

		client.on('init', function(data){
			data.should.be.an('object')
			data.should.to.have.nested.property('response.sessionId')
			sessionId = data.response.sessionId.toString()
			client.findAndReserveRoom(args.appName+":blackjack:testTheme", {appName: args.appName, isGameRoom: true, isTurnBased: true})
		})

		client.on('reservation', function(data){
			data.should.be.an('object')
			roomName = data.roomName
			client.requestSubscribe(roomName, data.params)
		})

		client.on('subscribed', function(data){
			data.should.be.an('object')
			data.should.to.have.nested.property('response.sessionId')
			if(roomName && data.room === roomName && sessionId && sessionId === data.response.sessionId){
				client.requestUnsubscribe(roomName)
			}
		})

		client.on('unsubscribed', function(data){

			if(roomName && data.room === roomName && sessionId && sessionId === data.response.sessionId){
				done()
			}
		})
	})

})
