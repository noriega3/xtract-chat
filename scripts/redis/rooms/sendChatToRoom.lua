local _tonumber = tonumber
local rk = {
    countsRooms             = "counts|rooms",
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
local clientRoomName        = KEYS[2]
local message               = KEYS[3]
local eventId               = KEYS[4]
local currentTime           = _tonumber(redis.call('get', 'serverTime'))

if(not currentTime) then
	return redis.error_reply('NO SERVERTIME')
end
local userId                = redis.call('hget', rk.session, 'userId')
local username              = redis.call('hget', rk.session, 'username')

--========================================================================
-- Functions
--========================================================================

local searchTerm = '[pos||is-sub-of||'..clientRoomName..'||'
local searchResults = redis.call('zrangebylex', 'hex|sessions:rooms', searchTerm, searchTerm..'\xff')
local subscribers = {}
for x=1, #searchResults do
    subscribers[x] = searchResults[x]:sub(#searchTerm)
end
local dataToSend = {
    sessionIds = subscribers,
    message = {
        phase = "sendChatToRoom",
        room = clientRoomName,
        response = {
            timestamp = currentTime,
            userId = userId,
            username = username,
            sessionId = sessionId,
            message = message,
            eventId = eventId
        }
    }
}

--increment message id
local nextId = redis.call('hincrby', rk.roomInfo, "nextMessageId", 1)

--add message id to ensure ordered messages by the time it reaches node
dataToSend.messageId = nextId

--encode message for redis
local encoded = cjson.encode(dataToSend)

--add message to room queue
redis.call('zadd', rk.roomMessages, nextId, encoded)

--publish message
redis.call('publish', rk.roomName, encoded)

return redis.status_reply('OK')
