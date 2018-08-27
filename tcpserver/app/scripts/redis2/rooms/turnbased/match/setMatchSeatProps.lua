local _tonumber = tonumber

local clientRoomName 	= KEYS[1]
local params			= cjson.decode(ARGV[1])
local setNextTurn		= ARGV[2]

local clientSessionId 		= params.sessionId
local clientSeat 			= params.seat
local clientMatchId 		= params.matchId
local clientLastMessageId 	= params.lastMessageId
local clientSeatProps 		= params.seatProps

local currentTime       = _tonumber(redis.call('get', 'serverTime'))
if(not currentTime) then
	return redis.error_reply('NO SERVERTIME')
end
local rk = {
	tickSessions   		= "tick|sessions",
	tickRooms      		= "tick|rooms",
	roomName       		= "rooms|"..KEYS[1],
	roomInfo       		= "rooms|"..KEYS[1].."|info",
	roomMessages   		= "rooms|"..KEYS[1].."|messages",
	roomMatchState   	= "rooms|"..KEYS[1].."|matchState",
	roomTurnState   	= "rooms|"..KEYS[1].."|turnState",
	roomOptInsMatch   	= "rooms|"..KEYS[1].."|optIns",
}

local matchState, newMatchState, doesRoomExist, turnExpiration, newTurnExpiration
local seatIndex, matchId, matchIdExists, currentSeatIndex

local getHexSearch = function(searchTerm)
	local response = redis.call('zrangebylex', rk.roomName, searchTerm, searchTerm..'\xff', 'LIMIT', 0, 1)
	return response and response[1] and response[1]:sub(#searchTerm) or false
end

--===================================================

--check valid match exists
local serverMatchIdExists = function(mId)
	return redis.call('exists', rk.roomOptInsMatch..":"..mId) == 1 or redis.call('exists', rk.roomOptInsMatch..":"..mId..":locked") == 1
end

if(not clientMatchId or not serverMatchIdExists(clientMatchId)) then
	return redis.error_reply('INVALID MATCH ID')
end

--check not out of order message sent in from last update to matchSeatProps (unless using next matchId optIns)
local isNextMatchId = redis.call('lindex', rk.roomOptInsMatch, 0) == rk.roomOptIns..":"..clientMatchId
local matchLastMessageIdStart, matchLastMessageIdEnd
if(isNextMatchId) then
	matchLastMessageIdEnd = redis.call('hget', rk.roomInfo, 'lastMessageId')
	--ensure lastMessageId is above the prevMatchLastMessageIdEnd and above matchMessageIdStart
	if(matchLastMessageIdEnd) then

	end
end

local serverLastMessageId = redis.call('hget', rk.roomInfo, 'lastMessageId')

--TODO: fix the out of sync messages
if(not serverLastMessageId or serverLastMessageId > clientLastMessageId) then end

--check valid seat/session via room
local searchTerm = '[taken:seat:'..clientSeat..':' --since hex, already checks this too '[taken:sessionId:'..clientSessionId..':'
local serverSeat = getHexSearch(searchTerm)
if(not clientSeat or not serverSeat or serverSeat ~= clientSeat) then
	return redis.error_reply('INVALID SEAT OR SESSION ROOM')
end

--note: we don't check match state, so client can change seat props whenever (@see setMatchNextTurn) to add extra validation to ACTIVE state

--check valid seat/session via match
if(not clientSessionId or getHexSearch(searchTerm)) then
	return redis.error_reply('INVALID SEAT OR SESSION MATCH')
end


local getSeatData = function(seatIndex)
	local response = redis.call('hget', rk.roomOptInsMatch, seatIndex)
	return response and cjson.decode(response) or false
end

local checkValidSession = function(seatData)
	local conditionals = {
		not seatData or not seatData.sessionId,
		seatData.sessionId ~= clientSessionId,
		redis.call('exists', "sessions|"..clientSessionId) == 0
	}

	for x=1, #conditionals do if(conditionals[x]) then return false end end
	return true
end

local function getNextSeat(seatIndex)

	--check if we have popped all the turns (resulting in an empty table)
	if(not seatIndex) then
		--change state to COMPLETE
		return redis.call('rpoplpush', rk.roomMatchState, rk.roomMatchState)
	end

	--get data for seat
	local seatData = getSeatData(seatIndex)

	--check for valid seat
	if(not seatData or not checkValidSession(seatData)) then
		--skip those who fail the validation
		return getNextSeat(_tonumber(redis.call('lpop', rk.roomTurnState)))
	end

	if(newSeatParams) then
		--overwrite new params
		seatData.params = newSeatParams

		--set new params for seat after validation check
		redis.call('hset', rk.roomOptInsMatch, seatIndex, cjson.encode(seatData))
	end

	-- set new turn timer for seat
	newTurnExpiration = currentTime+5000

	return redis.call('hmset', rk.roomInfo,
	'turnState', seatIndex,
	'turnStartTime', currentTime,
	'turnExpireTime', newTurnExpiration
	)
end
--===================================================

--check if room exists
doesRoomExist = redis.call('exists', rk.roomName) == 1
if(not doesRoomExist) then
	return redis.error_reply('NOT EXIST')
end

--check if the session matches the one set in the seat
currentSeatIndex = _tonumber(redis.call('lindex', rk.roomInfo, 0))
if(not checkValidSession(currentSeatIndex)) then
	return getNextSeat(_tonumber(redis.call('lpop', rk.roomTurnState)))
end

--update to global room ticker with a grace period of 5 seconds
redis.call('zadd',rk.tickRooms,currentTime+5000,clientRoomName)

--get matchId
matchIdExists = redis.call('hexists', rk.roomInfo, 'matchId') == 1
if(not matchIdExists) then
	return redis.error_reply('NO MATCH ID')
end

matchId = _tonumber(redis.call('hget', rk.roomInfo, 'matchId'))
rk.roomOptInsMatch = rk.roomOptInsMatch..":"..matchId..":locked"

--get matchId room
matchIdExists = redis.call('exists', rk.roomOptInsMatch) == 1
if(not matchIdExists) then
	return redis.error_reply('NO MATCH ROOM')
end

--check if sessionId matches one setting the seat

return getNextSeat(_tonumber(redis.call('lpop', rk.roomTurnState)))
