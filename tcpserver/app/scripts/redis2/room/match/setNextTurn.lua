local _tonumber = tonumber

local clientRoomName 	= KEYS[1]
local clientSessionId 	= ARGV[1]
local newSeatParams		= cjson.decode(ARGV[2])
local newMatchData		= cjson.decode(ARGV[3])
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

--===================================================
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
		seatData.seatProps = newSeatParams

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

--check if room state is right (ACTIVE)
matchState = redis.call('lindex', rk.roomMatchState, 0)
if(not matchState or matchState ~= "ACTIVE") then
	return redis.error_reply('INVALID_STATE')
end

--check if it is this seat's turn
currentSeatIndex = _tonumber(redis.call('lindex', rk.roomTurnState, 0))
if(not checkValidSession(currentSeatIndex)) then
	return getNextSeat(_tonumber(redis.call('lpop', rk.roomTurnState)))
end

--check if turn expiration is in range
turnExpiration = _tonumber(redis.call('hget', rk.roomInfo, 'turnExpireTime')) or -1
if(turnExpiration < currentTime) then
	return redis.status_reply('TURN IS EXPIRED - '..matchState)
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

return getNextSeat(_tonumber(redis.call('lpop', rk.roomTurnState)))
