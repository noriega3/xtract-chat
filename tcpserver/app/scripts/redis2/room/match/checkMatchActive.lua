local _tonumber = tonumber
local _type = type

local config = {
	timeNextPlayer = 25000,
	timeNextState = 15000 --'COMPLETE' state
}

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

--check if turn expiration is elapsed
turnExpiration = _tonumber(redis.call('hget', rk.roomInfo, 'matchTurnExpire')) or -1
if(not turnExpiration or (turnExpiration > currentTime)) then
	return redis.status_reply('TURN NOT EXPIRED')
end

--check if matchId exists
matchId = _tonumber(redis.call('lindex', rk.roomMatchList, 0))
if(not matchId) then
	return redis.error_reply('INVALID MATCH')
end

--get current matchId to check
rk.roomMatch = rk.roomMatchList..":"..matchId
rk.roomMatchTurn = rk.roomMatch..":turn"
rk.roomMatchState = rk.roomMatch..":state"

--check if room state is right (ACTIVE)
matchState = redis.call('lindex', rk.roomMatchState, 0)
if(not matchState or matchState ~= "ACTIVE") then
	return redis.error_reply('INVALID STATE')
end

--check if match is live
rk.roomMatchLive = rk.roomMatch..":live"
if(redis.call('exists', rk.roomMatchLive) == 0) then
	return redis.error_reply('MATCH IS NOT LIVE OR NOT EXIST')
end

--===================================================
local function checkSeat(seatIndex)
	local sessionExists, turnStateExists
	local seatSessionId, isValidOptIn, isSessionAlive, seatOptInData

	--check if we have popped all the turns (resulting in an empty table)
	if(not seatIndex) then
		--change state to COMPLETE
		return redis.call('rpoplpush', rk.roomMatchState, rk.roomMatchState)
				--and redis.call('hmset', rk.roomInfo, 'turnStartTime', currentTime, 'turnExpireTime', currentTime+config.timeNextState)
	end

	--check if session is opted in
	seatOptInData = redis.call('hget', rk.roomMatchLive, seatIndex)
	seatOptInData = seatOptInData and cjson.decode(seatOptInData) or {}
	seatSessionId = seatOptInData and seatOptInData.sessionId or -1
	isValidOptIn = isValidOptIn and isValidOptIn == seatSessionId
	if(not isValidOptIn) then
		return checkSeat(_tonumber(redis.call('lpop', rk.roomMatchTurn)))
	end

	--check if session is still alive
	sessionExists = redis.call('exists', "sessions|"..seatSessionId) == 1
	if(not sessionExists) then
		return checkSeat(_tonumber(redis.call('lpop', rk.roomMatchTurn)))
	end

	return redis.call('hmset', rk.roomInfo,
		'matchTurn', seatIndex,
		'matchTurnStart', currentTime,
		'matchTurnExpire', currentTime+config.timeNextPlayer
	)
end
--===================================================

seatIndex = redis.call('lpop', rk.roomMatchTurn)

--check if seat is 0 (indicating prep time)
if(_type(seatIndex) == "number" and seatIndex == 0) then
	--First ACTIVE call

	--TODO: something here

	--get first seat and set it
	seatIndex = _tonumber(redis.call('lindex', rk.roomMatchTurn, 0))
else

	--check if turn expiration is elapsed
	turnExpiration = _tonumber(redis.call('hget', rk.roomInfo, 'turnExpireTime')) or -1
	if(turnExpiration > currentTime) then
		return redis.status_reply('TURN NOT EXPIRED - '..matchState)
	end

	--get next seat
	seatIndex = _tonumber(redis.call('lpop', rk.roomTurnState))
end

--update to global room ticker with a grace period of 5 seconds
redis.call('zadd',rk.tickRooms,currentTime+5000,clientRoomName)


return checkSeat(seatIndex)
