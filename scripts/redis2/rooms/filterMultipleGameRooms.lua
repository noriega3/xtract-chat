local _tonumber = tonumber
--checks a room during a subscribe phase to ensure that this gameroom is set as the latest gameroom the user has requested to join
local hexSearchObject = function(redisKey, subject, predicate)
	local searchTerm = '[spo||'..subject..'||'..predicate..'||'
	local results = redis.call('zrangebylex', redisKey, searchTerm, searchTerm..'\xff')
	local response = {}
	for x = 1,#results do
		response[#response+1] = results[x]:sub(#searchTerm)
	end
	return response
end


local sessionId             = KEYS[1]
local currentTime           = _tonumber(redis.call('get', 'serverTime'))
if(not currentTime) then
	return redis.error_reply('NO SERVERTIME')
end

local rk = {
	countsRooms             = "counts|rooms",
	tickRooms               = "tick|rooms",
	tickSessions            = "tick|sessions",
	session                 = "sessions|"..KEYS[1],
}

--========================================================================
-- CORE Functions
--========================================================================

local sessionAlive = redis.call('zadd', rk.tickSessions, 'XX', currentTime, sessionId)
if(not sessionAlive) then
	return redis.error_reply('NO SESSION')
end

local lastGameRoom 	= redis.call('hget', rk.session, 'lastGameRoom')
local gameRooms 	= hexSearchObject('hex|sessions:rooms',sessionId,'has-gameroom-of')
local roomsToUnsub 	= {}

for _,room in pairs(gameRooms) do
	if(not lastGameRoom or room ~= lastGameRoom) then
		roomsToUnsub[#roomsToUnsub+1] = room
	end
end

return roomsToUnsub
