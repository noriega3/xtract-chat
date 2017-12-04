local _tonumber = tonumber

local clientRoomName 	= KEYS[1]
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
local seatIndex, matchId, matchIdExists

--check if room exists
doesRoomExist = redis.call('exists', rk.roomName) == 1
if(not doesRoomExist) then
	return redis.error_reply('NOT EXIST')
end

--check if room state is right
matchState = redis.call('lindex', rk.roomMatchState, 0)
if(not matchState or matchState ~= "ACTIVE") then
	return redis.error_reply('INVALID_STATE')
end

--check if turn expiration is elapsed
turnExpiration = _tonumber(redis.call('hget', rk.roomInfo, 'turnExpireAt')) or -1
if(turnExpiration > currentTime) then
	return redis.status_reply('TURN NOT EXPIRED - '..matchState)
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

--===================================================
local function getNextSeat(seatIndex)
	local sessionExists, turnStateExists
	local seatSessionId, isValidOptIn, isSessionAlive

	turnStateExists = redis.call('exists', rk.roomTurnState) == 1
	if(not turnStateExists) then
		return redis.call('rpoplpush', rk.roomMatchState, rk.roomMatchState)
	end


	--check if invalid numbered seat
	seatSessionId = redis.call('hget', rk.roomOptInsMatch, seatIndex)
	if(seatIndex <= 0) then
		return getNextSeat(_tonumber(redis.call('lpop', rk.roomTurnState)))
	end

	--check if session is opted in
	isValidOptIn = redis.call('hget', rk.roomOptInsMatch, seatIndex)
	isValidOptIn = isValidOptIn and isValidOptIn == seatSessionId
	if(not isValidOptIn) then
		return getNextSeat(_tonumber(redis.call('lpop', rk.roomTurnState)))
	end

	--check if session is still alive
	sessionExists = redis.call('exists', "sessions|"..seatSessionId) == 1
	if(not sessionExists) then
		return getNextSeat(_tonumber(redis.call('lpop', rk.roomTurnState)))
	end

	-- set new turn timer for seat
	newTurnExpiration = currentTime+10000

	return redis.call('hmset', rk.roomInfo,
		'turnSeatIndex', seatIndex,
		'turnStartAt', currentTime,
		'turnExpireAt', newTurnExpiration
	)
end
--===================================================
seatIndex = _tonumber(redis.call('lpop', rk.roomTurnState))
return getNextSeat(seatIndex)
