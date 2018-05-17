/* global describe it */
const common = require('./common')
const expect = common.expect
const Subscriber = common.Subscriber

const Promise = require("bluebird")
const _isEqual = require("lodash/isEqual")

const TCP_SERVER_PORT = process.env.TCP_SERVER_PORT || 7776 //default for 7776 for client-test

let args = {
	'username': 'Player12323A',
	'score': 605000,
	'avatar': '0',
	'userId': '785007',
	'appName': 'source'
};
let client, emitter, actions, socket, roomName

before(function(){
	return new Promise((resolve, reject) => {
		args.score = Math.random(0,100000000)
		args.avatar = Math.random(0,100)
		roomName = 'source:systemsomething'
		client = Subscriber(args, { port: TCP_SERVER_PORT})
		if(!client) return reject(new Error('invalid client'))
		emitter = client.getEmitter()
		actions = client.getActions()
		socket = client.getSocket()
		socket.once('connect', () => {
			resolve()
		})
		socket.once('error', (err) => {
			reject(err)
		})
	})
})

it('init', function(done){
	emitter.once('init', function(res){
		expect(res).be.an('object')
		res.should.have.nested.property('response.sessionId')
		res.should.have.nested.property('response.userId')
		res.response.userId.should.have.string(args.userId)
	})
	emitter.once('confirmInit', function(res){
		expect(res).be.an('object')
		res.should.have.nested.property('response.initEventId')
		res.response.initEventId.should.equal('OK')
		done()
	})
})

it('subscribed', function(done) {
	actions.requestSubscribe(roomName, {isSystem:true})
	let timer  = setTimeout(function () {done(new Error('timeout'))}, 5000)
	emitter.on('subscribed', function(res){

		res.should.be.an('object')
		res.should.have.property('phase')
		res.should.have.property('room')
		res.should.have.property('response')
		console.log('------')
		console.log(res)
		console.log('------')
		if(_isEqual(roomName, res.room)){
			clearTimeout(timer)
			res.response.should.include({sessionId: client.getSessionId(), isSystem:true})
			done()
		}
	})
})

it('unsubscribed', function(done) {
	actions.requestUnSubscribe(roomName)
	let timer  = setTimeout(function () {done(new Error('timeout'))}, 5000)
	emitter.on('unsubscribed', function(res){
		res.should.be.an('object')
		res.should.have.property('phase')
		res.should.have.property('room')
		res.should.have.property('response')

		if(_isEqual(roomName, res.room)){
			clearTimeout(timer)
			res.room.should.equal(roomName)
			res.response.should.include({sessionId: client.getSessionId(), isSystem:true})
			done()
		}
	})
})

after(function() {
	return new Promise((resolve, reject) => {
		emitter = client.getEmitter()
		actions = client.getActions()
		socket = client.getSocket()
		actions.disconnect('destroy')

		socket.once('close', () => {
			emitter = null
			actions = null
			socket = null
			args = null
			resolve()
		})
		socket.once('error', (err) => {
			reject(err)
		})
	})
});
