local rk = {
    tick            = "tick|sessions",
    session         = "sessions|"..KEYS[1],
    sessionRooms    = "sessions|"..KEYS[1].."|rooms"
}
local sessionId = KEYS[1]

local isExpired = redis.call('hsetnx',rk.session, 'expired', true)
if(isExpired == 1) then
    redis.call('zadd',rk.tick, 'XX', 10, sessionId)
    return redis.status_reply('OK')
else
    return redis.error_reply('FAIL')
end