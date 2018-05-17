local _tostring = tostring
local _tonumber = tonumber
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
local convertValueType = function(value)
	local newVal, isNumeric, isString, isJson
	isNumeric = _tonumber(value)
	if(isNumeric) then
		return isNumeric
	else
		isString = _tostring(value)
		if(not isString) then
			return nil
		elseif(isString == 'true' or isString == 'false') then
			return isString == 'true'
		else
			isJson = isString:sub(1, 1) == "{" or  isString:sub(1, 1) == "["
			if(isJson) then
				return cjson.decode(value)
			end
			return isString
		end
	end
end
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
	while x <= #data do
		formatted[data[x]] = convertValueType(data[x+1])
		x = x + 2
	end
else
	data = redis.call('hmget', rk.roomInfo, _unpack(roomInfoKeys))
	for x=1, #data do
		formatted[roomInfoKeys[x]] = convertValueType(data[x])
	end
end
formatted = cjson.encode(formatted)
return redis.status_reply(formatted)
