local _stringformat = string.format
local _tonumber = tonumber
local _tostring = tostring
local _type = type

--VALIDATION
if(not KEYS[1]) then return redis.error_reply('NO SESSION KEY') end
if(not KEYS[2]) then return redis.error_reply('NO ROOM NAME KEY') end
if(not _tonumber(KEYS[3])) then return redis.error_reply('NO NODE TIME KEY') end

--========================================================================
-- UTILITY Functions
--========================================================================

--create removal string for hexastore
local removeHexastore = function(key, subject,predicate,object)
	return redis.call('zrem', key,
		_stringformat("spo||%s||%s||%s",subject,predicate,object),
		_stringformat("sop||%s||%s||%s",subject,object,predicate),
		_stringformat("osp||%s||%s||%s",object,subject,predicate),
		_stringformat("ops||%s||%s||%s",object,predicate,subject),
		_stringformat("pos||%s||%s||%s",predicate,object,subject),
		_stringformat("pso||%s||%s||%s",predicate,subject,object))
end

local retrieveSeatFromHexResult = function(result, strRemoval)
	if(_type(result) ~= 'table' or _type(strRemoval) ~= 'string') then return false end
	if(#result <= 0 or not result[1]) then return false end
	if(_type(result[1]) ~= 'string') then return false end
	return _tonumber(result[1]:sub(#strRemoval+1)) --+1 because sub starts @ 0
end

local isSessionActive = function(id)
	local sessionKey = "sessions|"..id
	return redis.call('exists', sessionKey) == 1 and not redis.call('hget', sessionKey, 'destroying')
end

local function isValidRoomType(type)
	return type and (type == 'realtime' or type == 'turnbased' or type == 'system' or type == 'standard') --todo: add different types here or reference table
end

--========================================================================
-- CORE Functions
--========================================================================

local sessionId             = KEYS[1]
local clientRoomName        = KEYS[2]
local nodeTime              = _tonumber(KEYS[3])
local unSubParams           = cjson.decode(ARGV[1])
local strAppendResponse     = cjson.decode(ARGV[2])

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
	--roomReserves            = "rooms|"..KEYS[2].."|reserves"
}
local roomExists, userId, isClientBot, isGameRoom, isTurnBased
local seat, hexastore, searchTerm, isSystem, roomType

userId 			= strAppendResponse and strAppendResponse.userId or redis.call('hget', rk.session, 'userId')

--check if room exists
roomExists = redis.call('exists', rk.roomInfo) == 1 and redis.call('hexists',rk.roomInfo, 'destroying') == 0
if(not roomExists) then return redis.error_reply('ROOM NO EXIST - '..clientRoomName) end

--check if room is locked
if(not redis.call('exists', rk.roomName..':locked') == 0) then return redis.error_reply('ROOM LOCKED - '..clientRoomName) end

--check roomType
roomType = redis.call('hget', rk.roomInfo, 'roomType')
if(not isValidRoomType(roomType)) then return redis.error_reply('INVALID ROOM TYPE - '..clientRoomName) end

--remove seat of user
searchTerm = 'taken:session:'..sessionId..':'
hexastore = redis.call('zrangebylex', rk.roomName, '['..searchTerm, '['..searchTerm..'\xff', 'LIMIT', 0, 1)
seat = retrieveSeatFromHexResult(hexastore, searchTerm)
if(seat) then
	--remove that player seat and replace
	redis.call('zrem',rk.roomName,"taken:session:"..sessionId..":"..seat)
	if(redis.call('zrem',rk.roomName,"taken:seat:"..seat..":"..sessionId) == 1 and roomExists) then
		redis.call('zadd', rk.roomName, 'NX', 0,"open:seat:"..seat) --replace player seat
	end

	--remove observer seat and replace
	if(redis.call('zrem',rk.roomName,"taken:observer:"..seat..":"..sessionId) == 1 and roomExists) then
		redis.call('zadd', rk.roomName, 'NX', 0,"open:observer:"..seat) --replace player seat
	end
end

--remove user from room regardless of existing or not
redis.call('zrem',rk.roomName,sessionId)
redis.call('zrem',rk.sessionSubs,clientRoomName)
redis.call('srem', rk.roomBots, sessionId)

--remove hexastores associating session and room
removeHexastore('hex|sessions:rooms', sessionId, 'is-sub-of', clientRoomName)
removeHexastore('hex|sessions:rooms', sessionId, 'has-gameroom-of', clientRoomName)

--add a previous room to session if session still exists / not destroying (for reconnect logic)
if(isSessionActive(sessionId)) then
	redis.call('hset', rk.session, 'prevGameRoom', clientRoomName)
	if(seat) then redis.call('hset', rk.session, 'prevGameRoomSeat', seat) end
end

isClientBot = redis.call('hexists', rk.session, 'bot') == 1

--update tickers for room and session
redis.call('zadd',rk.tickRooms,'XX',nodeTime,clientRoomName)
redis.call('zadd',rk.tickSessions,'XX',nodeTime,sessionId)

if(roomExists) then
	isGameRoom = redis.call('hexists', rk.roomInfo, 'isGameRoom') == 1
	isTurnBased = redis.call('hexists', rk.roomInfo, 'isTurnBased') == 1
	isSystem = redis.call('hexists', rk.roomInfo, 'isSystem') == 1

	redis.call('hset',rk.roomInfo,'updated',nodeTime)
	redis.call('hincrby', rk.roomInfo, "subscribers", -1)

	if(isClientBot) then
		--update counts for bot field
		redis.call('hincrby', rk.roomInfo, "bots", -1)
	end
end

--TODO: add unsubparam to remove reservations

--send a message to existing sessions
local publishUnSubscribe = function()
	local response = strAppendResponse or {}
    local dataToSend = {
		sessionId = nil,
		sessionIds = nil,
		messageId = -1,
		message = {
            phase = "unsubscribed",
            room = clientRoomName,
            response = response
        }
    }
	local sessionIds, searchTerm, subscribers, numSubscribers

    --overwrite or set to default some the message.response (to prevent meddling)
	response.room = clientRoomName
    response.sessionId = sessionId
    response.roomType = redis.call('hget', rk.roomInfo, 'roomType')
    response.isGameRoom = isGameRoom or nil
    response.isTurnBased = isTurnBased or nil
    response.isSystem = isSystem or nil
	response.userId = userId
	response.bot = isClientBot or nil
	response.roomSubscribeType = redis.call('hget', rk.roomInfo, 'roomSubscribeType')

	--set dataToSend.sessionIds
	if(roomExists) then --for unsubscribe, we will push the message to a user even if room is destroyed
		sessionIds = {}
		searchTerm = '[pos||is-sub-of||'..clientRoomName..'||'
		subscribers = redis.call('zrangebylex', 'hex|sessions:rooms', searchTerm, searchTerm..'\xff')

		--store count of subs
		numSubscribers = #subscribers

		for x=1, numSubscribers do
			sessionIds[x] = subscribers[x]:sub(#searchTerm)
		end

		--increment message id
		local nextId = redis.call('hincrby', rk.roomInfo, "nextMessageId", 1)

		--add message id to ensure ordered messages by the time it reaches node
		dataToSend.messageId = nextId

		--send user connecting to room message list to be processed by room queue
		redis.call('zadd', rk.roomMessages, nextId, cjson.encode(dataToSend.message))

		--add user to the history, but set it to retrieve messages after their connecting message
		redis.call('zadd', rk.roomHistory, nextId, sessionId)

		--add the person who unsubscribed to the list so they get the message too
		sessionIds[#sessionIds+1] = sessionId

		--set sessionIds to list of ids in the room
		dataToSend.sessionIds = sessionIds
	else
		--set dataToSend.sessionId only the requester will receive even if room does not exist
		dataToSend.sessionId = sessionId
	end

	--encode message for redis
	local encoded = cjson.encode(dataToSend)

	--https://redis.io/commands/eval#available-libraries
	redis.call('publish', rk.roomName, encoded)

	--always return num subscribers so we can destroy or not
	return redis.status_reply('UNSUBSCRIBE OK')
end
return publishUnSubscribe()
