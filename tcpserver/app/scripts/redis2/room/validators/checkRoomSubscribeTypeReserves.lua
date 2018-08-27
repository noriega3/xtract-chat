local _tostring = tostring

--VALIDATION
if(not KEYS[1] or not _tostring(KEYS[1])) then return redis.error_reply('NO ROOM PATH KEY') end

--========================================================================
-- UTILITY Functions
--========================================================================

local checkRoomExistence = function(roomName)
	return redis.call('exists', 'rooms|'..roomName) == 1 and
		redis.call('exists', 'rooms|'..roomName..'|info') == 1 and
		redis.call('hexists', 'rooms|'..roomName..'|info', 'destroying') == 0
end

--========================================================================
-- CORE Functions
--========================================================================
local clientRoomName = KEYS[1]
--check if room and it's properties exist on the first check
if(not checkRoomExistence(clientRoomName)) then
	return redis.error_reply('ROOM NO EXIST')
end

if(redis.call('hget', 'rooms|'..clientRoomName..'|info', 'roomSubscribeType') == 'reserves') then
	return redis.status_reply('HAS RESERVATION FLAG')
else
	return redis.status_reply('NO RESERVES REQUIRED')
end
