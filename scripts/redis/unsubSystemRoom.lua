local _stringformat = string.format

local roomType = -1
local sessionId             = KEYS[1]
local clientRoomName        = KEYS[2]
local currentTime           = redis.call('get', 'serverTime')

if(not currentTime) then
	return redis.error_reply('NO SERVERTIME')
end
local response              = cjson.decode(ARGV[1]) or {}
local numSubscribers        = 0

local rk = {
	countsRooms             = "counts|rooms",
	tickRooms               = "tick|rooms",
    tickSessions            = "tick|sessions",
    session                 = "sessions|"..KEYS[1],
    sessionSubs             = "sessions|"..KEYS[1].."|rooms",
    sessionHistory          = "sessions|"..KEYS[1].."|history",
    roomName                = "rooms|"..KEYS[2],
    roomInfo                = "rooms|"..KEYS[2].."|info",
    roomHistory             = "rooms|"..KEYS[2].."|history",
    roomMessages            = "rooms|"..KEYS[2].."|messages",
	roomBots	            = "rooms|"..KEYS[2].."|bots"
}
local userId                = response.userId or redis.call('hget', rk.session, 'userId')
local roomExists            = redis.call('exists', rk.roomInfo) == 1
local isBot                 = redis.call('hget', rk.session, 'bot')

--========================================================================
-- UTILITY Functions
--========================================================================

--create removal string for hexastore
local createRemHexastore = function(subject,predicate,object)
    return
        _stringformat("spo||%s||%s||%s",subject,predicate,object),
        _stringformat("sop||%s||%s||%s",subject,object,predicate),
        _stringformat("osp||%s||%s||%s",object,subject,predicate),
        _stringformat("ops||%s||%s||%s",object,predicate,subject),
        _stringformat("pos||%s||%s||%s",predicate,object,subject),
        _stringformat("pso||%s||%s||%s",predicate,subject,object)

end

--========================================================================
-- CORE Functions
--========================================================================

local unSubscribeToRoom = function()

	--remove user from room regardless of existing or not
	redis.call('zrem',rk.roomName,sessionId)
	redis.call('zrem',rk.sessionSubs,clientRoomName)
	redis.call('srem',rk.roomBots, sessionId)

	--remove hexastores associating session and room
	redis.call('zrem', 'hex|sessions:rooms', createRemHexastore(sessionId, 'is-sub-of', clientRoomName))

	if(roomExists) then
		--update tickers for room and session
		redis.call('zadd',rk.tickSessions,'XX',currentTime,sessionId)
		redis.call('hset',rk.roomInfo,'updated',currentTime)
		redis.call('hincrby', rk.roomInfo, "subscribers", -1)

		if(isBot) then
			--update counts for bot field
			redis.call('hincrby', rk.roomInfo, "bots", -1)
		end
	end

	return true
end

local updateCounts = function()
	local subCount = redis.call('zlexcount', 'hex|sessions:rooms', '[pos||is-sub-of||'..clientRoomName..'||', '[pos||is-sub-of||'..clientRoomName..'||\xff')
	redis.call('zadd', rk.countsRooms, subCount, clientRoomName)
	return true
end

local publishUnSubscribe = function()

	local dataToSend = {
		sessionId = nil,
		sessionIds = nil,
		message = {
			phase = "unsubscribed",
			room = clientRoomName,
			response = response
		}
	}
	--overwite or set to default some the message.response (to prevent meddling)
	response.room = clientRoomName
	response.sessionId = sessionId
	response.isGameRoom = false
	response.userId = userId
	response.bot = isBot

	--set dataToSend.sessionIds
	if(roomExists) then --for unsubscribe, we will push the message to a user even if room is destroyed
		local sessionIds = {}
		local searchTerm = '[pos||is-sub-of||'..clientRoomName..'||'
		local subscribers = redis.call('zrangebylex', 'hex|sessions:rooms', searchTerm, searchTerm..'\xff')

		--store count of subs
		numSubscribers = #subscribers

		for x=1, #subscribers do
			sessionIds[x] = subscribers[x]:sub(#searchTerm)
		end

		--increment message id
		local nextId = redis.call('hincrby', rk.roomInfo, "nextMessageId", 1)

		--send user connecting to room message list to be processed by room queue
		redis.call('zadd', rk.roomMessages, nextId, cjson.encode(dataToSend.message))

		--add user to the history, but set it to retrieve messages after their connecting message
		redis.call('zadd', rk.roomHistory, nextId, sessionId)

		--set sessionIds to list of ids in the room
		dataToSend.sessionIds = sessionIds
	else
		--set dataToSend.sessionId only the requester will recieve even if room does not exist
		dataToSend.sessionId = sessionId
	end

	--encode message for redis
	local encoded = cjson.encode(dataToSend)

	--https://redis.io/commands/eval#available-libraries
	redis.call('publish', rk.roomName, encoded)

	--always return num subscribers so we can destroy or not
	return numSubscribers
end

--=================================
-- Execute functions, and return the message
--=================================

local funct = {
	unSubscribeToRoom,
	updateCounts,
	publishUnSubscribe
}

local status, err
for x=1, #funct do
	status, err = funct[x]()
	if(not status) then	return redis.error_reply(status or err)  end
end

return status
