local _tostring = tostring

--VALIDATION
if(not KEYS[1] or not _tostring(KEYS[1])) then return redis.error_reply('NO SESSION KEY') end

--========================================================================
-- UTILITY Functions
--========================================================================
local checkSessionExistence = function(sessionId)
	return redis.call('exists', 'sessions|'..sessionId) == 1 and
		redis.call('hexists', 'sessions|'..sessionId, 'destroying') == 0
end

--========================================================================
-- CORE Functions
--========================================================================

local sessionId = KEYS[1]
local rk = {
	session 			= "sessions|"..sessionId,
	tickBots 			= "tick|bots",
	tickSessions		= "tick|sessions"
}

--check if session and it's properties exist
if(not checkSessionExistence(sessionId)) then
	return redis.error_reply('SESSION NO EXIST')
end

if(redis.call('hexists', rk.session, 'bot') == 1) then
	return redis.status_reply('IS BOT')
end

return redis.status_reply('NOT BOT')
