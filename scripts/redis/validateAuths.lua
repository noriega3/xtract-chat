local rk = {
    tickSessions            = "tick|sessions",
    session                 = "sessions|"..KEYS[1]
}
local sessionId = KEYS[1]
local apiAuth = redis.call('hget', 'user|auths', sessionId)
local sessionAuth = ARGV and ARGV[1] or redis.call('hget', rk.session, 'auth')
if(apiAuth and sessionAuth and apiAuth == sessionAuth) then
    return redis.status_reply('OK')
else
    --return redis.error_reply('Auths do not match') --TODO: uncomment this line to enable auth checks
    return redis.status_reply('OK') --TODO: remove this line to enable auth checks
end