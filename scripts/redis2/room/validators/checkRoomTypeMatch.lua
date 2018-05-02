local _tostring = tostring

--VALIDATION
if(not KEYS[1] or not _tostring(KEYS[1])) then return redis.error_reply('NO ROOM NAME KEY') end
if(not ARGV[1] or not _tostring(ARGV[1])) then return redis.error_reply('NO ROOM TYPE PARAM') end

--========================================================================
-- UTILITY Functions
--========================================================================

--========================================================================
-- CORE Functions
--========================================================================
local clientRoomName 	= _tostring(KEYS[1])
local roomTypeId 		= _tostring(ARGV[1])

local rk = {
	roomInfo = 'rooms|'..clientRoomName..'|info',
}
local storedRoomType = redis.call('hget', rk.roomInfo, 'roomTypeId')
local isValid = storedRoomType and storedRoomType == roomTypeId

if(isValid) then
	return redis.status_reply('MATCH')
else
	return redis.error_reply('NO MATCH')
end
