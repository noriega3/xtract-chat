local _tonumber = tonumber
local _unpack = unpack
local _stringformat = string.format
local _tostring = tostring
local _type = type

--VALIDATION
if(not KEYS[1] or not _tostring(KEYS[1])) then return redis.error_reply('NO ROOM PATH KEY') end
if(not KEYS[2] or not _tonumber(KEYS[2])) then return redis.error_reply('NO NODE TIME KEY') end

--========================================================================
-- UTILITY Functions
--========================================================================

local hexSearchSubjectCounts = function(redisKey, predicate, subject)
	local searchTerm = '[pso||'..predicate..'||'..subject..'||'
	return redis.call('zlexcount', redisKey, searchTerm, searchTerm..'\xff')
end

--========================================================================
-- CORE Functions
--========================================================================
local clientRoomName = KEYS[1]
local nodeTime = _tonumber(KEYS[2])

local rk = {
	roomInfo = 'rooms|'..KEYS[1]..'|info',
}

local maxIdleTime = 3000 --todo: add from config
local sessions, reserves, lastUpdate

--check if there are any subs via hexastore
sessions = hexSearchSubjectCounts('hex|sessions:rooms','is-sub-of',clientRoomName)
if(sessions > 0) then
	return redis.status_reply('SESSIONS')
end

--todo: check observers if needed to keep room for some reason here

--check if there are any reserves via hexastore
reserves = hexSearchSubjectCounts('hex|sessions:rooms','is-reserve-of',clientRoomName)
if(reserves > 0) then
	return redis.status_reply('RESERVES')
end

--check if last update time is past max idle time
lastUpdate = _tonumber(redis.call('hget', rk.roomInfo, 'updated'))
if((nodeTime - lastUpdate) <= maxIdleTime) then
	return redis.status_reply('ACTIVE')
end

return redis.status_reply('IDLE')
