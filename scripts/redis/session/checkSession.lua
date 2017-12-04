local _tonumber = tonumber

local rk = {
    tickSessions            = "tick|sessions",
    session                 = "sessions|"..KEYS[1],
    sessionSubs             = "sessions|"..KEYS[1].."|rooms",
    sessionHistory          = "sessions|"..KEYS[1].."|history",
}

local sessionId             = KEYS[1]
local currentTime           = _tonumber(redis.call('get', 'serverTime'))

if(not currentTime) then
	return redis.error_reply('NO SERVERTIME')
end

--========================================================================
-- Functions
--========================================================================
local response = cjson.decode(ARGV[1])
local dataToSend = {
    sessionId = sessionId,
    message = {
        phase = "pong",
        response = response
    }
}
response.sessionId      = sessionId
response.serverReqTime  = currentTime

--will return error if not existing
local sessionAlive = redis.call('zadd', rk.tickSessions, 'XX', currentTime, sessionId)

--encode message for redis
local encoded = cjson.encode(dataToSend)

--publish message
redis.call('publish', rk.session, encoded)

return sessionAlive and redis.status_reply('OK') or redis.error_reply('SESSION EXPIRED')
