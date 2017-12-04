local _tonumber = tonumber

local clientRoomName 	= KEYS[1]
local currentTime       = _tonumber(redis.call('get', 'serverTime'))
if(not currentTime) then
	return redis.error_reply('NO SERVERTIME')
end
local rk = {
	tickRooms      		= "tick|rooms",
	roomName       		= "rooms|"..KEYS[1],
	roomInfo       		= "rooms|"..KEYS[1].."|info",
	roomOptIns   		= "rooms|"..KEYS[1].."|optIns",
	roomMatchState   	= "rooms|"..KEYS[1].."|matchState",
	roomTurnState   	= "rooms|"..KEYS[1].."|turnState",
}
local matchState, newMatchState, doesRoomExist, turnExpiration, newTurnExpiration

--check if room exists
doesRoomExist = redis.call('exists', rk.roomName) == 1
if(not doesRoomExist) then
	return redis.error_reply('NOT EXIST')
end

--check if room state is right
matchState = redis.call('lindex', rk.roomMatchState, 0)
if(not matchState or matchState ~= "NEW_MATCH") then
	return redis.error_reply('INVALID_STATE')
end

--check if turn expiration is elapsed
turnExpiration = _tonumber(redis.call('hget', rk.roomInfo, 'turnExpireAt')) or -1
if(turnExpiration > currentTime) then
	return redis.status_reply('TURN NOT EXPIRED - '..matchState)
end

--change match state
newMatchState = redis.call('rpoplpush', rk.roomMatchState, rk.roomMatchState)
newTurnExpiration 	= currentTime+3000

--update to global room ticker with a grace period of 5 seconds
redis.call('zadd',rk.tickRooms,newTurnExpiration,clientRoomName)

--reset room info and set new match state
redis.call('hmset', rk.roomInfo,
	'matchState', newMatchState,
	'turnSeatIndex', 0,
	'turnStartAt', currentTime,
	'turnExpireAt', newTurnExpiration
)

return redis.status_reply('OK')
