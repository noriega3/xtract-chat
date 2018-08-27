local _tostring = tostring
local _type = type

--VALIDATION
if(not KEYS[1] or not _tostring(KEYS[1])) then return redis.error_reply('NO SESSION KEY') end
if(not KEYS[2] or not _tostring(KEYS[2])) then return redis.error_reply('NO ROOM KEY') end

--========================================================================
-- UTILITY Functions
--========================================================================
local checkSessionExistence = function(sessionId)
	return redis.call('exists', 'sessions|'..sessionId) == 1 and
		redis.call('hexists', 'sessions|'..sessionId, 'destroying') == 0
end

local isSubOf = function(sessionId, roomName)
	local searchTerm = 'pos||is-sub-of||'..roomName..'||'..sessionId
	return redis.call('zscore', 'hex|sessions:rooms', searchTerm)
end
--========================================================================
-- CORE Functions
--========================================================================

local sessionId = KEYS[1]
local clientRoomName = KEYS[2]

--check if session and it's properties exist
if(not checkSessionExistence(sessionId)) then
	return redis.error_reply('SESSION NO EXIST')
end

if(isSubOf(sessionId, clientRoomName)) then
	return redis.status_reply('SUBSCRIBED')
end

return redis.status_reply('NOT SUBSCRIBED')
