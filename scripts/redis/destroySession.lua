local _unpack = unpack
local _stringformat = string.format

local createHexastore = function(subject,predicate,object)
    return {
        _stringformat("spo||%s||%s||%s",subject,predicate,object),
        _stringformat("sop||%s||%s||%s",subject,object,predicate),
        _stringformat("osp||%s||%s||%s",object,subject,predicate),
        _stringformat("ops||%s||%s||%s",object,predicate,subject),
        _stringformat("pos||%s||%s||%s",predicate,object,subject),
        _stringformat("pso||%s||%s||%s",predicate,subject,object)
    }
end

local rk = {
    tick            = "tick|sessions",
    tickBots        = "tick|bots",
    session         = "sessions|"..KEYS[1],
    sessionRooms    = "sessions|"..KEYS[1].."|rooms",
    sessionHistory  = "sessions|"..KEYS[1].."|history"
}
local sessionId 	= KEYS[1]
local isExpired 	= ARGV[1] == 'expired'
local currentTime   = redis.pcall('get', 'serverTime')
currentTime = not currentTime and -99 or currentTime

--set a destroying flag to true
redis.call('hset', rk.session, 'destroying', 1)

--Remove hexastores for session associated with user id or whatever
local isBot = redis.call('hexists', rk.session, 'bot') == 1
local userId = redis.call('hget', rk.session, 'userId')
if(userId) then
    redis.call('zrem', 'hex|sessions:users', _unpack(createHexastore(sessionId, 'is-user-id', userId)))
end

if(isBot) then
	redis.call('zrem',rk.tickBots,sessionId)
end

redis.call('zrem',rk.tick,sessionId)
redis.call('del',rk.session, rk.sessionRooms, rk.sessionHistory)
redis.call('lpush', 'log|session:destroys', sessionId.."|"..currentTime)

local dataToSend = {
    sessionId = sessionId,
    message = {
        phase = "disconnected",
        room = "sessions:"..sessionId,
        response = {
            sessionId = sessionId,
            isExiting = not isExpired,
            isExpired = isExpired
        }
    }
}

redis.call('publish', rk.session, cjson.encode(dataToSend))

return redis.status_reply('OK')
