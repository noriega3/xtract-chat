const _isEqual = require('lodash/isEqual')
const _join = require('lodash/join')
const _identity = require('lodash/identity')
const _size = require('lodash/size')
const _pickBy = require('lodash/pickBy')
const _toInteger = require('lodash/toInteger')

//TODO: change var names to less opinionated
module.exports = function(roomStr){
	if(!roomStr) return false
	let roomName, roomNameArr, roomPath, roomAppName, roomGame, roomTheme, roomId, roomAppGameName, roomAppGameThemeName,roomGameThemeName
	roomName = roomStr
	roomNameArr = roomStr.match('^(\\w+):(\\w+):(\\w+):([0-9]+)$') || roomStr.match('^(\\w+):(\\w+):([a-zA-Z]+)$') //todo: look into just splitting it by : vs a regex (needs performance testing)

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

	//capture those rooms who aren't a game room due to no # at the end
	if(!roomId){
		roomGame = undefined
		roomTheme = undefined
		roomId = undefined
		roomAppGameName = undefined
		roomAppGameThemeName = undefined
		roomGameThemeName = undefined
	}

	return _pickBy({
		roomName,roomPath,
		roomAppName,roomGame,roomTheme,roomId,
		roomAppGameName,roomAppGameThemeName,roomGameThemeName
	}, _identity);
}
