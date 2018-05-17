"use strict"
const debug         = require('debug')      //https://github.com/visionmedia/debug
debug.log = console.info.bind(console) //one all send all to console.
const _log          = debug('formatRoomList')
const _error        = debug('formatRoomList:err')
const Promise		= require('bluebird')

const _isEqual	= require('lodash/isEqual')
const _size		= require('lodash/size')
const _get		= require('lodash/get')
const _nth		= require('lodash/nth')
const _pick		= require('lodash/pick')
const _isArray	= require('lodash/isArray')
const _isString	= require('lodash/isString')
const _clone	= require('lodash/clone')
const _isEmpty	= require('lodash/isEmpty')
const store = require('../../store')

const getRoomInfo = store.getLua("./scripts/redis2/room/getters/getRoomInfo.lua")

const getRoomDataFromDb = Promise.method(function(db, roomDataOrName){
	let roomName
	if(_isArray(roomDataOrName) && (_isEqual(_size(roomDataOrName), 3) || _isEqual(_size(roomDataOrName), 2)) && _isString(_nth(roomDataOrName, 1))){
		roomName = _nth(roomDataOrName, 1)
	} else if(_isString(roomDataOrName)){
		roomName = roomDataOrName
	}
	db.defineCommand('getRoomInfo', { numberOfKeys: 1, lua: getRoomInfo })

	return Promise.resolve(db.getRoomInfo(roomName, 'roomTypeId', 'roomName', 'validUnSubParamKeys', 'validSubParamKeys'))
		.then(JSON.parse)
		.tapCatch(_error)
})

const validateDataWithDb = Promise.method(function(formatType, dbRoomData, roomData){
	const dbRoomTypeId = _get(dbRoomData, 'roomTypeId', -999)
	const dbRoomName = _get(dbRoomData, 'roomName', false)
	const dbValidParamKeys = _isEqual(formatType, 'subscribe') ? _get(dbRoomData, 'validSubParamKeys', {}) : _get(dbRoomData, 'validUnSubParamKeys', {})
	let inputRoomTypeId, inputRoomName

	//Get a valid input (non-db)
	if(_isArray(roomData) && (_isEqual(_size(roomData), 3) || _isEqual(_size(roomData), 2)) && _isString(_nth(roomData, 1))){
		inputRoomTypeId = _isEqual(_nth(roomData, 0), 'GET') ? dbRoomTypeId : _nth(roomData, 0)
		inputRoomName = _nth(roomData, 1)
	} else if(_isString(roomData)){
		return [dbRoomTypeId, dbRoomName, {}] //Note: empty params when passed roomData is a string
	} else {
		throw new Error('INVALID ROOM DATA')
	}

	if(!_isEqual(inputRoomTypeId, dbRoomTypeId))
		throw new Error('NOT EQUAL ROOM TYPE ID')
	else if(!_isEqual(inputRoomName, dbRoomName))
		throw new Error('NOT EQUAL ROOM NAME')

	return [inputRoomTypeId, inputRoomName, _pick(_nth(roomData, 2), dbValidParamKeys)]
})

module.exports = function(data){
	const {db, roomList, formatType} = data
	if(_isEmpty(roomList)) return []
	const cpyRoomList = _clone(roomList)

	return Promise.reduce(cpyRoomList, (filteredList, roomData) => {
			return getRoomDataFromDb(db, roomData)
				.then((dbRoomData) => validateDataWithDb(formatType, dbRoomData, roomData))
				.then((filtered) => (filteredList.push(filtered)))
				.return(filteredList)
				.tapCatch(_error)
				.catchReturn(filteredList)
		},[])
		.then((newList) => ({...data, roomList: newList}))
		.tapCatch(_error)
}
