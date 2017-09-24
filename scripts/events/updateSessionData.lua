local _unpack = unpack
local rk = {
    tickSessions            = "tick|sessions",
    session                 = "sessions|"..KEYS[1],
}
local sessionId         = KEYS[1]
local currentTime       = KEYS[2]
redis.call('zadd',rk.tickSessions, 'XX', currentTime,sessionId)

return redis.call('hmset', rk.session, _unpack(ARGV))
