local rk = {
    eventsPending           = "events|pending",
    tickSessions            = "tick|sessions",
    session                 = "sessions|"..KEYS[1],
    sessionSubs             = "sessions|"..KEYS[1].."|rooms",
    sessionHistory          = "sessions|"..KEYS[1].."|history"
}

local sessionId             = KEYS[1]
local eventId               = KEYS[2]
local currentTime           = redis.call('get', 'serverTime')

if(not currentTime) then
	return redis.error_reply('NO SERVERTIME')
end

--========================================================================
-- Functions
--========================================================================
--check if room
--[[
    roomName                = "rooms|"..KEYS[2],
    roomHistory             = "rooms|"..KEYS[2].."|history",
    roomMessages            = "rooms|"..KEYS[2].."|messages",
    roomInfo                = "rooms|"..KEYS[2].."|info", ]]--

--update session or return error when doesnt exist
redis.call('zadd', rk.tickSessions, 'XX', currentTime, sessionId)

local eventResponse = redis.call('hget', rk.eventsPending, eventId)
local parsed = eventResponse and cjson.decode(eventResponse)

if(not eventResponse or not parsed) then
    return redis.error_reply('invalid event params for '..eventId)
end

if(parsed.expireTime and currentTime > parsed.expireTime) then
    return redis.error_reply('event expired for '..eventId)
end

rk.roomName         = "rooms|"..parsed.room
rk.roomInfo         = "rooms|"..parsed.room.."|info"
rk.roomMessages     = "rooms|"..parsed.room.."|messages"

local searchTerm = '[pos||is-sub-of||'..parsed.room..'||'
local searchResults = redis.call('zrangebylex', 'hex|sessions:rooms', searchTerm, searchTerm..'\xff')
local subscribers = {}
for x=1, #searchResults do
    subscribers[x] = searchResults[x]:sub(#searchTerm)
end
if(#subscribers > 0) then
    local dataToSend = {
        sessionIds = subscribers,
        message = parsed
    }

    local nextId = redis.call('hincrby', rk.roomInfo, "nextMessageId", 1)
    redis.call('zadd', rk.roomMessages, nextId, eventResponse)
    redis.call('publish', rk.roomName, cjson.encode(dataToSend))
end

return cjson.encode(eventResponse)
