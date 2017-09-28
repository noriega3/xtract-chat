local rk = {
    eventsPending           = "events|pending",
    tickSessions            = "tick|sessions",
    session                 = "sessions|"..KEYS[1],
    sessionSubs             = "sessions|"..KEYS[1].."|rooms",
    sessionHistory          = "sessions|"..KEYS[1].."|history",
    roomName                = "rooms|"..KEYS[2],
    roomHistory             = "rooms|"..KEYS[2].."|history",
    roomMessages            = "rooms|"..KEYS[2].."|messages",
    roomInfo                = "rooms|"..KEYS[2].."|info",
}
local sessionId             = KEYS[1]
local userId                = redis.call('hget', rk.session, 'userId')
local clientRoomName        = KEYS[2]
local eventId               = KEYS[3]
local eventName             = KEYS[4]
local currentTime           = redis.call('get', 'serverTime')

if(not currentTime) then
	return redis.error_reply('NO SERVERTIME')
end
local eventResponse         = ARGV[1]
local verifyPhaseName       = ARGV[2] or "sendRoomEvent"
local verifiedPhaseName     = ARGV[3] or "receiveRoomEvent"

--========================================================================
-- Functions
--========================================================================

--update session or return error when doesnt exist
redis.call('zadd', rk.tickSessions, 'XX', currentTime, sessionId)

local dataToSendVerify = {
    sessionIds = {sessionId},
    message = {
        phase = verifyPhaseName,
        room = clientRoomName,
        response = {
            timestamp = currentTime, --v2
            eventId = eventId,
            userId = userId,
            sessionId = sessionId,
            event = eventName
        }
    }
}

local dataToSendVerified = {
    phase = verifiedPhaseName,
    room = clientRoomName,
    response = {
        timestamp = currentTime, --v2
        userId = userId,
        sessionId = sessionId,
        event = eventName,
        details = cjson.decode(eventResponse)
    }
}

--save response to publish when verify message is approved
redis.call('hset', rk.eventsPending, eventId, cjson.encode(dataToSendVerified))

--publish verify message
redis.call('publish', rk.roomName, cjson.encode(dataToSendVerify))

return redis.status_reply('OK')
