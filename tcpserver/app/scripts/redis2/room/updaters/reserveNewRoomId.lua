local _stringformat = string.format
local _tonumber = tonumber
local _tostring = tostring
local _type = type
local _unpack = unpack

--VALIDATION
if(not KEYS[1]) then return redis.error_reply('NO ROOM NAME KEY') end

--========================================================================
-- UTILITY Functions
--========================================================================

local checkWithinRateLimit = function(item)
	local current = redis.call('llen', 'rateLimit|'..item)

	if(current > 10) then
		return false
	end

	if(redis.call('exists', 'rateLimit|'..item) ~= 1) then
		redis.call('rpush', 'rateLimit|'..item, 'rateLimit|'..item)
		redis.call('expire', 'rateLimit|'..item, 1)
	else
		redis.call('rpushx', 'rateLimit|'..item, 'rateLimit|'..item)
	end
	return true
end

--========================================================================
-- CORE Functions
--========================================================================

local roomPath = KEYS[1]
if(checkWithinRateLimit('roomCreates')) then
	--ensure that this is a roomPath and does not exist

	if(redis.call('exists', 'rooms|'..roomPath..'|info') == 1) then return redis.error_reply('INVALID ROOM PATH') end

	local newId = redis.call('incr', 'ids|rooms')
	local newRoom = roomPath..':'..newId

	--ensure that this is new room does not exist
	if(redis.call('exists', 'rooms|'..newRoom..'|info') == 1) then return redis.error_reply('INVALID ROOM PATH (ROOM ALREADY EXISTS)') end

	return newRoom
end
return redis.error_reply('RATE LIMIT')
