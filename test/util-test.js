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
const colon = require('../util/colon')
const getRoomTypeFromParams = require('../util/getRoomTypeFromParams')

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

	describe('colon', function () {
		it('normal input', function () {
			const result = colon('derp','some')
			result.should.equal('derp:some')
		})
		it('one value', function () {
			const result = colon('one')
			result.should.equal('one')
		})
		it('double colon value', function () {
			const result = colon('one', 'two:', 'three:')
			result.should.equal('one:two::three:')
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
})
