const _isEqual = require('lodash/isEqual')
const _join = require('lodash/join')
const _identity = require('lodash/identity')
const _size = require('lodash/size')
const _pickBy = require('lodash/pickBy')
const _toInteger = require('lodash/toInteger')

module.exports = function(roomStr){
	if(!roomStr) return false
	let roomName, roomNameArr, roomPath, roomAppName, roomGame, roomTheme, roomId, roomAppGameName, roomAppGameThemeName,roomGameThemeName
	roomName = roomStr
	roomNameArr = roomStr.match('^(\\w+):(\\w+):(\\w+):([0-9]+)$') || roomStr.match('^(\\w+):(\\w+):([a-zA-Z]+)$')

	let roomArrSize = _size(roomNameArr)
	if(_isEqual(roomArrSize,5)){
		[roomName, roomAppName, roomGame, roomTheme, roomId] = roomNameArr
		roomPath = roomAppName+":"+roomGame+":"+roomTheme
		roomId = _toInteger(roomId)
	} else if(_isEqual(roomArrSize,4)){
		[roomPath, roomAppName, roomGame, roomTheme] = roomNameArr
	}

	if(roomAppName && roomGame) {
		roomAppGameName = _join([roomAppName, roomGame], ':')

		if(roomTheme) {
			roomAppGameThemeName = _join([roomAppName, roomGame, roomTheme], ':')
		}
	}

	if(roomGame && roomTheme)
		roomGameThemeName = _join([roomGame,roomTheme], ':')

	return _pickBy({
		roomName,roomPath,
		roomAppName,roomGame,roomTheme,roomId,
		roomAppGameName,roomAppGameThemeName,roomGameThemeName
	}, _identity);
}
