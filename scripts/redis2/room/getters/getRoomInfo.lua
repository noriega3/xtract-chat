local _tostring = tostring
local _unpack = unpack

--VALIDATION
if(not KEYS[1] or not _tostring(KEYS[1])) then return redis.error_reply('NO ROOM NAME KEY') end
if(ARGV) then
	for x=1, #ARGV do
		if(not _tostring(ARGV[x])) then return redis.error_reply('ROOM PARAM INVALID') end
	end
end

--========================================================================
-- UTILITY Functions
--========================================================================

--========================================================================
-- CORE Functions
--========================================================================
local clientRoomName 	= KEYS[1]
local roomInfoKeys		= ARGV
local rk = {
	roomInfo = 'rooms|'..clientRoomName..'|info',
}
local formatted = {}
local data, x

if(not roomInfoKeys) then
	data = redis.call('hgetall', rk.roomInfo)
	x = 1
	while x < #data do
		formatted[data[x]] = data[x+1]
		x = x + 2
	end
else
	data = redis.call('hmget', rk.roomInfo, _unpack(roomInfoKeys))
	for x=1, #data do
		formatted[roomInfoKeys[x]] = data[x]
	end
end

return redis.status_reply(cjson.encode(formatted))
