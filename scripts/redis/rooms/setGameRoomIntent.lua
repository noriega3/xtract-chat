local _tonumber = tonumber
--checks a room during a subscribe phase to ensure that this gameroom is set as the latest gameroom the user has requested to join

local sessionId             = KEYS[1]
local clientRoomName        = KEYS[2]
local currentTime           = _tonumber(redis.call('get', 'serverTime'))

if(not currentTime) then
	return redis.error_reply('NO SERVERTIME')
end

local rk = {
	countsRooms             = "counts|rooms",
	tickRooms               = "tick|rooms",
	tickSessions            = "tick|sessions",
	session                 = "sessions|"..KEYS[1],
	roomName                = "rooms|"..KEYS[2],
	roomInfo                = "rooms|"..KEYS[2].."|info",
	roomMessages            = "rooms|"..KEYS[2].."|messages",
}

--========================================================================
-- CORE Functions
--========================================================================

local sessionAlive = redis.call('zadd', rk.tickSessions, 'XX', currentTime, sessionId)
if(not sessionAlive) then return false, 'NO SESSION' end

local didSet = redis.call('hset', rk.session, 'lastGameRoom', clientRoomName)
if(didSet) then
	return redis.status_reply(clientRoomName)
else
	return redis.error_reply('INVALID ROOM')
end
