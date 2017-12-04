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

--will return error if not existing
--update session or return error when doesnt exist
if(redis.call('zadd', rk.tickSessions, 'XX', 'CH', 'INCR', currentTime, sessionId) == 0) then
	return redis.error_reply('NO SESSION')
end
return redis.call('hget', rk.session, 'online')
