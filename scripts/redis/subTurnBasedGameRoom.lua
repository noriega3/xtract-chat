local _unpack = unpack
local _stringformat = string.format

local roomType = 2
local sessionId             = KEYS[1]
local clientRoomName        = KEYS[2]
local roomArr               = cjson.decode(KEYS[3])
local currentTime           = redis.call('get', 'serverTime')

if(not currentTime) then
	return redis.error_reply('NO SERVERTIME')
end
local response              = cjson.decode(ARGV[1])
local numSubscribers        = 0

local rk = {
    countsRooms             = "counts|rooms",
	countsRoomPath          = "counts|"..roomArr['roomPath'],
	countsGame              = "counts|"..roomArr['roomAppGameName'],
	countsGameTheme         = "counts|"..roomArr['roomAppGameThemeName'],
    tickRooms               = "tick|rooms",
    tickSessions            = "tick|sessions",
    session                 = "sessions|"..KEYS[1],
    sessionSubs             = "sessions|"..KEYS[1].."|rooms",
    sessionHistory          = "sessions|"..KEYS[1].."|history",
    roomName                = "rooms|"..KEYS[2],
	roomInfo                = "rooms|"..KEYS[2].."|info",
    roomHistory             = "rooms|"..KEYS[2].."|history",
    roomMessages            = "rooms|"..KEYS[2].."|messages",
    roomBots            	= "rooms|"..KEYS[2].."|bots",
    roomReserves            = "rooms|"..KEYS[2].."|reserves",
    roomOptIns            	= "rooms|"..KEYS[2].."|optIns"
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

	--removes the hex reservation
	local function removeHexReserve(subject,predicate,object)
	return redis.call('zrem', 'hex|sessions:rooms',
		_stringformat("sop||%s||%s||%s", sessionId, clientRoomName, 'is-reserve-of'),
		_stringformat("spo||%s||%s||%s", sessionId, 'is-reserve-of', clientRoomName),
		_stringformat("ops||%s||%s||%s", clientRoomName, 'is-reserve-of', sessionId),
		_stringformat("osp||%s||%s||%s", clientRoomName, sessionId, 'is-reserve-of'),
		_stringformat("pso||%s||%s||%s", 'is-reserve-of', sessionId, clientRoomName),
		_stringformat("pos||%s||%s||%s", 'is-reserve-of', clientRoomName, sessionId))
	end


    if(roomExists) then

        --add session to room
        local memberIndex = redis.call('zrangebylex', rk.roomName, '[reserved:seat:', '[reserved:seat:\xff', 'LIMIT', 0, 1)
        if(not memberIndex or not memberIndex[1]) then return false, 'NO RESERVATION' end
        local seat = memberIndex[1]:gsub("reserved:seat:", "")
        redis.call('zrem', rk.roomName, "open:seat:"..seat, "reserved:seat:"..seat)
        redis.call('zadd', rk.roomName,0, "taken:seat:"..seat..":"..sessionId, 0, "taken:session:"..sessionId..":"..seat)
        redis.call('zadd', rk.sessionSubs,currentTime,clientRoomName)

		--remove reservation
		if(not removeHexReserve()) then return false, 'HEX RESERVE ERR' end
		redis.call('zrem', rk.roomReserves, sessionId)

		--add hex of user is subbed
		redis.call('zadd', 'hex|sessions:rooms', createHexastore(sessionId, 'is-sub-of', clientRoomName))
		redis.call('zadd', 'hex|sessions:rooms', createHexastore(sessionId, 'has-gameroom-of', clientRoomName))

		--update tickers for room and session
		redis.call('zadd',rk.tickRooms,'XX',currentTime,clientRoomName)
		redis.call('zadd',rk.tickSessions,'XX',currentTime,sessionId)
		redis.call('hset',rk.roomInfo,'updated',currentTime)
		redis.call('hincrby', rk.roomInfo, "subscribers", 1)

		if(isBot) then
			--update counts for bot field/key
			redis.call('sadd', rk.roomBots, sessionId)
			redis.call('hincrby', rk.roomInfo, "bots", 1)
		end

		--TODO: this will be added to a network call
		--add them to opted in list
		local nextGameId 	= redis.call('hget', rk.roomInfo, 'gameId')
		rk.roomOptIns 	= rk.roomOptIns..":"..nextGameId
		redis.call('hset', rk.roomOptIns, seat, sessionId)

		return true
	end
	return false, 'NO EXIST'
end

local updateCounts = function()
	local subCount = redis.call('zlexcount', 'hex|sessions:rooms', '[pos||is-sub-of||'..clientRoomName..'||', '[pos||is-sub-of||'..clientRoomName..'||\xff')
    local themeCount = redis.call('zlexcount', 'hex|sessions:rooms', '[pos||is-sub-of||'..roomArr['roomAppGameThemeName']..':', '[pos||is-sub-of||'..roomArr['roomAppGameThemeName']..':\xff')
	redis.call('zadd', rk.countsRooms, subCount, clientRoomName)
	redis.call('zadd', rk.countsRoomPath, subCount, clientRoomName)
    redis.call('zadd', rk.countsGame, themeCount, roomArr['roomTheme'])
	return true
end

local publishSubscribe = function()
	local dataToSend = {
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
	response.isGameRoom = true
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

		--set sessionIds to list of ids in the room
		dataToSend.sessionIds = sessionIds

		--encode message and sessionId(s) for redis
		local encoded = cjson.encode(dataToSend)

		--increment message id
		local nextId = redis.call('hincrby', rk.roomInfo, "nextMessageId", 1)

		--send user connecting to room message list to be processed by room queue
		redis.call('zadd', rk.roomMessages, nextId, cjson.encode(dataToSend.message))

		--add user to the history, but set it to retrieve messages after their connecting message
		redis.call('zadd', rk.roomHistory, nextId, sessionId)

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
