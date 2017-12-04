local _tonumber = tonumber
local clientRoomName 	= KEYS[1]
local currentTime       = _tonumber(redis.call('get', 'serverTime'))
if(not currentTime) then
	return redis.error_reply('NO SERVERTIME')
end
local rk = {
	tickRooms      	= "tick|rooms",
	roomName       	= "rooms|"..KEYS[1],
	roomInfo       	= "rooms|"..KEYS[1].."|info",
	roomOptIns   	= "rooms|"..KEYS[1].."|optIns",
	roomOptInsMatch   	= "rooms|"..KEYS[1].."|optIns:",
	roomMatchState   	= "rooms|"..KEYS[1].."|matchState",
	roomTurnState   	= "rooms|"..KEYS[1].."|turnState",
}
local matchState, newMatchState, doesRoomExist, turnExpiration, newTurnExpiration
local matchId, newMatchId

--check if room exists
doesRoomExist = redis.call('exists', rk.roomName) == 1 and redis.call('exists', rk.roomInfo) == 1
if(not doesRoomExist) then
	return redis.error_reply('NOT EXIST')
end

--check if room state is right
matchState = redis.call('lindex', rk.roomMatchState, 0)
if(matchState ~= "COMPLETE") then
	return redis.error_reply('INVALID_STATE')
end

--check if turn expiration is elapsed
turnExpiration = _tonumber(redis.call('hget', rk.roomInfo, 'turnExpireAt')) or -1
if(not turnExpiration or turnExpiration > currentTime) then
	return redis.status_reply('TURN NOT EXPIRED - '..matchState)
end

--set next matchId
matchId = redis.call('hget', rk.roomInfo, 'matchId')
newMatchId = redis.call('hincrby', rk.roomInfo, 'matchId', 1)

--remove turn state if existing
if(redis.call('exists', rk.roomTurnState) == 1) then
	redis.call('del',rk.roomTurnState)
end

if(redis.call('exists', rk.roomOptInsMatch..matchId) == 1) then
	redis.call('del',rk.roomTurnState)
end

if(redis.call('exists', rk.roomOptInsMatch..matchId..":locked") == 1) then
	redis.call('del',rk.roomOptInsMatch..matchId..":locked")
end

--set next state, place current state to bottom
newMatchState 		= redis.call('rpoplpush', rk.roomMatchState, rk.roomMatchState)
newTurnExpiration 	= currentTime+2000 --30 sec

--update to global room ticker with a grace period of 5 seconds
redis.call('zadd',rk.tickRooms,newTurnExpiration,clientRoomName)

--reset room info
redis.call('hmset', rk.roomInfo,
	'matchState', newMatchState,
	'turnSeatIndex', 0,
	'turnStartAt', currentTime,
	'turnExpireAt', newTurnExpiration
)

return redis.status_reply('OK')
