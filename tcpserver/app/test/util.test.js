/* global describe it */
const chai = require('chai')
chai.config.includeStack = true; // turn on stack trace
chai.config.showDiff = true; // turn off reporter diff display
let should = chai.should()
let expect = chai.expect

//simulated client (taken functions from dashboard)
process.env.NODE_PATH = '.'
process.env.DEBUG_COLORS = true
process.env.DEBUG_HIDE_DATE = true
process.env.NODE_ENV = 'development'
process.env.DEBUG = '*,-not_this,-ioredis:*,-bull'

const arrToSet = require('../util/arrToSet')
const getRoomTypeFromParams = require('../util/getRoomTypeFromParams')
const getParamsFromRoomType = require('../util/getParamsFromRoomType')
const isGameRoomByType = require('../util/isGameRoomByType')
const isJson = require('../util/isJson')
const fromJson = require('../util/fromJson')
const isValidRoomByType = require('../util/isValidRoomByType')
const objToArr = require('../util/objToArr')
const remapToObject = require('../util/remapToObject')
const roomNameToArr = require('../util/roomNameToArr')

const {
	SYSTEM_ROOM_TYPE,
	TURNBASED_ROOM_TYPE,
	REALTIME_ROOM_TYPE,
	STANDARD_ROOM_TYPE
} = require('../scripts/constants')

describe('Util test', function () {

	//Also helps with what parameters fit in each util

	describe('arrToSet', function () {
		it('normal input', function () {
			const result = arrToSet(['someKey', 'someValue','some3', 'some4'])
			result.should.include.deep.ordered.members([ [ 'someKey', 'someValue' ], [ 'some3', 'some4' ] ])
		})
		it('should have an error', function () {
			const result = arrToSet()
			should.not.exist(result)
		})
	})

	describe('getParamsFromRoomType', function () {
		it('System room', function () {
			const result = getParamsFromRoomType(SYSTEM_ROOM_TYPE)
			result.should.have.property('isSystem')
			result.should.not.have.property('isGameRoom')
			result.should.not.have.property('isTurnBased')
		})
		it('Turnbased room', function () {
			const result = getParamsFromRoomType(TURNBASED_ROOM_TYPE)
			result.should.have.property('isGameRoom',true)
			result.should.have.property('isTurnBased',true)
			result.should.not.have.property('isSystem')
		})
		it('Realtime room', function () {
			const result = getParamsFromRoomType(REALTIME_ROOM_TYPE)
			result.should.have.property('isGameRoom',true)
			result.should.not.have.property('isTurnBased')
			result.should.not.have.property('isSystem')
		})
		it('Standard room', function () {
			const result = getParamsFromRoomType(STANDARD_ROOM_TYPE)
			result.should.be.empty
		})
		it('parameter 2 should equal to value when empty', function () {
			const result = getParamsFromRoomType(undefined, 'something')
			result.should.equal('something')
		})
	})

	describe('getRoomTypeFromParams', function () {
		it('isGameRoom (realtime)', function () {
			const result = getRoomTypeFromParams({isGameRoom:true})
			result.should.equal(1)
		})
		it('System room', function () {
			const result = getRoomTypeFromParams({isSystem:true})
			result.should.equal(-1)
		})
		it('Turnbased room', function () {
			const result = getRoomTypeFromParams({isGameRoom:true, isTurnBased: true})
			result.should.equal(2)
		})
		it('Standard room', function () {
			const result = getRoomTypeFromParams({})
			result.should.equal(0)
		})
		it('two special types in one', function () {
			(() => getRoomTypeFromParams({isSystem:true, isGameRoom: true})).should.throw()
		})
	})

	describe('isGameRoomByType', function () {
		it('System room', function () {
			const result = isGameRoomByType(SYSTEM_ROOM_TYPE)
			result.should.be.false
		})
		it('Turnbased room', function () {
			const result = isGameRoomByType(TURNBASED_ROOM_TYPE)
			result.should.be.true
		})
		it('Realtime room', function () {
			const result = isGameRoomByType(REALTIME_ROOM_TYPE)
			result.should.be.true
		})
		it('Standard room', function () {
			const result = isGameRoomByType(STANDARD_ROOM_TYPE)
			result.should.be.false
		})
		it('parameter should throw when empty', function () {
			(() => isGameRoomByType('434')).should.throw()
		})
	})

	describe('fromJson/isJson', function () {
		it('is json true', function () {
			const result = isJson(JSON.stringify({"something": 30, "another": true, "nested": {"something": "blah"}}))
			result.should.be.true
		})
		it('is json false', function () {
			const result = isJson('fdfd')
			result.should.be.false
		})
		it('valid conversion', function () {
			const result = fromJson(JSON.stringify({"something": 30, "another": true, "nested": {"something": "blah"}}))
			result.should.be.an('object')
			console.log(result)
		})

	})

	describe('isValidRoomByType', function () {
		it('System room', function () {
			const result = isValidRoomByType(SYSTEM_ROOM_TYPE)
			result.should.be.true
		})
		it('Turnbased room', function () {
			const result = isValidRoomByType(TURNBASED_ROOM_TYPE)
			result.should.be.true
		})
		it('Realtime room', function () {
			const result = isValidRoomByType(REALTIME_ROOM_TYPE)
			result.should.be.true
		})
		it('Standard room', function () {
			const result = isValidRoomByType(STANDARD_ROOM_TYPE)
			result.should.be.true
		})
		it('random number', function () {
			const result = isValidRoomByType(-343493)
			result.should.be.false
		})
		it('parameter should throw when empty', function () {
			(() => isValidRoomByType()).should.throw()
		})

	})

	describe('objToArr', function () {
		it('valid object', function () {
			const result = objToArr({"something": 30, "another": true, "nested": {"something": "blah"}})
			result.should.be.an('array')
		})
		it('invalid object', function () {
			const result = objToArr('fdfd')
			result.should.be.empty
		})
	})

	describe('remapToObject', function () {
		it('valid array', function () {
			const result = remapToObject(["something", 30, "another", true, "nested", {"something": "blah"}])
			result.should.be.an('object')
		})
		it('invalid array', function () {
			const result = remapToObject('fdfd')
			result.should.be.empty
		})
	})

	describe('roomNameToArr', function () {
		it('no :', function () {
			const result = roomNameToArr("someRoomName")
			result.should.have.all.keys(['roomName'])
			result.should.not.contain.keys(['roomPath',
										'roomAppName','roomGame','roomTheme','roomId',
										'roomAppGameName','roomAppGameThemeName','roomGameThemeName'])
		})
		it('one :', function () {
			const result = roomNameToArr("something:test")
			result.should.have.all.keys(['roomName'])
			result.should.not.contain.keys(['roomPath',
										'roomAppName','roomGame','roomTheme','roomId',
										'roomAppGameName','roomAppGameThemeName','roomGameThemeName'])
		})
		it('two :', function () {
			const result = roomNameToArr('category:subcategory:sub2cat')
			result.should.have.all.keys(['roomName'])
			result.should.not.contain.keys(['roomPath',
										'roomAppName','roomGame','roomTheme','roomId',
										'roomAppGameName','roomAppGameThemeName','roomGameThemeName'])
		})
		it('three : with string end', function () {
			const result = roomNameToArr('cat:sub:topic')
			result.should.have.all.keys(['roomName', 'roomPath', 'roomAppName'])
			result.should.not.contain.keys(['roomAppName',
											'roomGame','roomTheme','roomId', 'roomAppGameName','roomAppGameThemeName',
											'roomGameThemeName'])
		})
		it('three : with number end (game rooms)', function () {
			const result = roomNameToArr('source:slots:athemename:300')
			result.should.have.all.keys(['roomName','roomPath',
										'roomAppName','roomGame','roomTheme','roomId',
										'roomAppGameName','roomAppGameThemeName','roomGameThemeName'])
		})
	})
})
