local _unpack = unpack
local _stringformat = string.format

local roomType = -1
local sessionId             = KEYS[1]
local clientRoomName        = KEYS[2]
local currentTime           = KEYS[3]
local response              = cjson.decode(ARGV[1])
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
local userId                = response and response.userId or redis.call('hget', rk.session, 'userId')
local roomExists            = redis.call('exists', rk.roomInfo) == 1
local isBot                 = redis.call('hget', rk.session, 'bot')

--========================================================================
-- UTILITY Functions
--========================================================================

--create creation string for hexastore
local createHexastore = function(subject,predicate,object)
    return
        0,_stringformat("spo||%s||%s||%s",subject,predicate,object),
        0,_stringformat("sop||%s||%s||%s",subject,object,predicate),
        0,_stringformat("osp||%s||%s||%s",object,subject,predicate),
        0,_stringformat("ops||%s||%s||%s",object,predicate,subject),
        0,_stringformat("pos||%s||%s||%s",predicate,object,subject),
        0,_stringformat("pso||%s||%s||%s",predicate,subject,object)
end

--========================================================================
-- CORE Functions
--========================================================================

local subscribeToRoom = function()

	if(roomExists) then

		--add session to room
		local memberIndex = redis.call('zrangebylex', rk.roomName, '[open:seat:', '[open:seat:\xff', 'LIMIT', 0, 1)
		if(not memberIndex or not memberIndex[1]) then return false, 'FULL' end
		local seat = memberIndex[1]:gsub("open:seat:", "")
		redis.call('zrem', rk.roomName, "open:seat:"..seat)
		redis.call('zadd', rk.roomName,0, "taken:seat:"..seat..":"..sessionId, 0, "taken:session:"..sessionId..":"..seat)
		redis.call('zadd', rk.sessionSubs,currentTime,clientRoomName)

		--add hex of user is subbed
		redis.call('zadd', 'hex|sessions:rooms', createHexastore(sessionId, 'is-sub-of', clientRoomName))

		--update tickers for room and session
		redis.call('zadd',rk.tickRooms,'XX',0,clientRoomName)
		redis.call('zadd',rk.tickSessions,'XX',currentTime,sessionId)
		redis.call('hset',rk.roomInfo,'updated',currentTime)
		redis.call('hincrby', rk.roomInfo, "subscribers", 1)

		if(isBot) then
			--update counts for bot field/key
			redis.call('sadd', rk.roomBots, sessionId)
			redis.call('hincrby', rk.roomInfo, "bots", 1)
		end
		return true
	end
	return false, 'NO EXIST'
end

local updateCounts = function()
	local subCount = redis.call('zlexcount', 'hex|sessions:rooms', '[pos||is-sub-of||'..clientRoomName..'||', '[pos||is-sub-of||'..clientRoomName..'||\xff')
	return redis.call('zadd', rk.countsRooms, subCount, clientRoomName)
end

local publishSubscribe = function()
	local dataToSend = {
		sessionId = nil,
		sessionIds = nil,
		message = {
			phase = "subscribed",
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
	if(roomExists) then --for subscribe, we always want to be sure room is still here
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

		--encode message and sessionId(s) for redis
		local encoded = cjson.encode(dataToSend)

		--https://redis.io/commands/eval#available-libraries
		redis.call('publish', rk.roomName, encoded)

		--return the sub message to retry if failure
		return cjson.encode(dataToSend.message)
	end
	return false, 'NO EXIST'
end

--=================================
-- Execute functions, and return the message
--=================================

local funct = {
	subscribeToRoom,
	updateCounts,
	publishSubscribe
}

local status, err
for x=1, #funct do
	status, err = funct[x]()
	if(not status) then	return redis.error_reply(status or err)  end
end

return redis.status_reply(status)
