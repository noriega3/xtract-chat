local _tonumber = tonumber

local clientRoomName 	= KEYS[1]
local sessionId 		= KEYS[2]
local seatIndex 		= KEYS[3]
local currentTime       = _tonumber(redis.call('get', 'serverTime'))
if(not currentTime) then
	return redis.error_reply('NO SERVERTIME')
end

local rk = {
	tickRooms      		= "tick|rooms",
	roomName       		= "rooms|"..KEYS[1],
	roomInfo       		= "rooms|"..KEYS[1].."|info",
	roomOptIns	 		= "rooms|"..KEYS[1].."|optIns",
	roomMatchState   	= "rooms|"..KEYS[1].."|matchState",
}
local doesRoomExist, nextMatchId, matchState
local turnExpiration, isOptInState
local optInSeats

--check if room exists
doesRoomExist = redis.call('exists', rk.roomName) == 1
if(not doesRoomExist) then
	return redis.error_reply('NOT EXIST')
end

--check if room state is right
matchState = redis.call('lindex', rk.roomMatchState, 0)
isOptInState = matchState and matchState == "OPT_IN"
if(not matchState) then
	return redis.error_reply('INVALID GAME STATE')
end

--check optIns and current match state
rk.roomOptInsMatch = redis.call('lindex', rk.roomOptIns, 0)
if(not rk.roomOptInsMatch) then
	return redis.error_reply('NO OPT INS')
end

--update to global room ticker with a grace period of 5 seconds
redis.call('zadd',rk.tickRooms,currentTime+5000,clientRoomName)

optInSeats = redis.call('hvals', rk.roomOptInsMatch)

--check if turn expiration is elapsed for the match state (if opt_in)
turnExpiration = _tonumber(redis.call('hget', rk.roomInfo, 'turnExpireAt')) or -1
if((turnExpiration < currentTime) and matchState == "OPT_IN" and #optInSeats > 0) then
	--turn is expired and is on OPT_IN state

	--retrieve the next match id
	nextMatchId = redis.call('hget', rk.roomInfo, 'nextMatchId')

	--set them to the next match id
	rk.roomOptInsMatch = rk.roomOptIns..":"..nextMatchId

	optInSeats = redis.call('hvals', rk.roomOptInsMatch)
end

--ensure sessionId of seat matches
if(#optInSeats > 0 and redis.call('hget', rk.roomOptInsMatch, seatIndex) == sessionId) then

	--remove them from seat
	redis.call("hdel", rk.roomOptInsMatch, seatIndex)

	return redis.status_reply('OK')
end

return redis.error_reply('NO SESSION')
