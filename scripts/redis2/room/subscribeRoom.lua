local _stringformat = string.format
local _tonumber = tonumber
local _type = type

--VALIDATION
if(not KEYS[1]) then return redis.error_reply('NO SESSION KEY') end
if(not KEYS[2]) then return redis.error_reply('NO ROOM NAME KEY') end
if(not KEYS[3]) then return redis.error_reply('NO NODE TIME KEY') end
if(not cjson.decode(ARGV[1])) then return redis.error_reply('NO SUB DATA') end

--========================================================================
-- UTILITY Functions
--========================================================================

local createHexastore = function(key, subject,predicate,object)
    return redis.call('zadd', key,
		0,_stringformat("spo||%s||%s||%s",subject,predicate,object),
		0,_stringformat("sop||%s||%s||%s",subject,object,predicate),
		0,_stringformat("osp||%s||%s||%s",object,subject,predicate),
		0,_stringformat("ops||%s||%s||%s",object,predicate,subject),
		0,_stringformat("pos||%s||%s||%s",predicate,object,subject),
		0,_stringformat("pso||%s||%s||%s",predicate,subject,object))
end

--removes the hex reservation
local removeHexReserve = function(sessionId,clientRoomName)
	return redis.call('zrem', 'hex|sessions:rooms',
		_stringformat("sop||%s||%s||%s", sessionId, clientRoomName, 'is-reserve-of'),
		_stringformat("spo||%s||%s||%s", sessionId, 'is-reserve-of', clientRoomName),
		_stringformat("ops||%s||%s||%s", clientRoomName, 'is-reserve-of', sessionId),
		_stringformat("osp||%s||%s||%s", clientRoomName, sessionId, 'is-reserve-of'),
		_stringformat("pso||%s||%s||%s", 'is-reserve-of', sessionId, clientRoomName),
		_stringformat("pos||%s||%s||%s", 'is-reserve-of', clientRoomName, sessionId))
end

local retrieveSeatFromHexResult = function(result, strRemoval)
	if(_type(result) ~= 'table' or _type(strRemoval) ~= 'string') then return false end
	if(#result <= 0 or not result[1]) then return false end
	if(_type(result[1]) ~= 'string') then return false end
	return _tonumber(result[1]:sub(#strRemoval+1)) --+1 because sub starts @ 0
end

local function isValidRoomType(type)
	return type and (type == 'realtime' or type == 'turnbased' or type == 'system' or type == 'standard') --todo: add different types here or reference table
end

--========================================================================
-- CORE Functions
--========================================================================

local sessionId             = KEYS[1]
local clientRoomName        = KEYS[2]
local nodeTime 				= _tonumber(KEYS[3])
local subParams             = cjson.decode(ARGV[1])
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
	roomBots            	= "rooms|"..KEYS[2].."|bots",
	roomReserves            = "rooms|"..KEYS[2].."|reserves",
}
local roomExists, userId, roomType, roomSubscribeType, isClientBot
local isGameRoom,isTurnBased,seatKey, seat, searchTerm, hexastore, isSystem, reservesOnly

userId = strAppendResponse and strAppendResponse.userId or redis.call('hget', rk.session, 'userId')

--check if room exists
roomExists = redis.call('exists', rk.roomInfo) == 1 and redis.call('hexists',rk.roomInfo, 'destroying') == 0
if(not roomExists) then return redis.error_reply('ROOM NO EXIST - '..clientRoomName) end

--check if room is locked
if(not redis.call('exists', rk.roomName..':locked') == 0) then return redis.error_reply('ROOM LOCKED - '..clientRoomName) end

--check roomType
roomType = redis.call('hget', rk.roomInfo, 'roomType')
if(not isValidRoomType(roomType)) then return redis.error_reply('INVALID ROOM TYPE - '..clientRoomName) end

isGameRoom = redis.call('hexists', rk.roomInfo, 'isGameRoom') == 1
isTurnBased = redis.call('hexists', rk.roomInfo, 'isTurnBased') == 1
isSystem = redis.call('hexists', rk.roomInfo, 'isSystem') == 1

--todo: add check on subParams to return a hash

searchTerm = "open:seat:"

--check if reservations are required
roomSubscribeType	= redis.call('hget', rk.roomInfo, 'roomSubscribeType')
reservesOnly = roomSubscribeType and roomSubscribeType == 'reserves'
if(reservesOnly) then
	searchTerm = "reserved:seat:"
end

hexastore = redis.call('zrangebylex', rk.roomName, '['..searchTerm, '['..searchTerm..'\xff', 'LIMIT', 0, 1)
seat = retrieveSeatFromHexResult(hexastore, searchTerm)
if(not seat) then return redis.error_reply('NO SEAT NUMBER - '..clientRoomName) end

redis.call('zrem', rk.roomName, "open:seat:"..seat, "reserved:seat:"..seat)
redis.call('zadd', rk.roomName,0, "taken:seat:"..seat..":"..sessionId, 0, "taken:session:"..sessionId..":"..seat)
redis.call('zadd', rk.sessionSubs,nodeTime,clientRoomName)

--check if we need to remove/replace reservation with them
if(reservesOnly) then
	--remove reservation from base table
	redis.call('zrem', rk.roomReserves, sessionId)
	--remove reservation from hexastore and error if does not exist
	if(not removeHexReserve(sessionId, clientRoomName)) then return redis.error_reply('NO RESERVATION  - '..sessionId) end
end

--add hex of user is subbed
if(not createHexastore('hex|sessions:rooms', sessionId, 'is-sub-of', clientRoomName)) then
	return redis.error_reply('INVALID HEX RESPONSE')
end

--update tickers for room and session
redis.call('zadd',rk.tickRooms,'XX',nodeTime,clientRoomName)
redis.call('zadd',rk.tickSessions,'XX',nodeTime,sessionId)
redis.call('hset',rk.roomInfo,'updated',nodeTime)
redis.call('hincrby', rk.roomInfo, "subscribers", 1)

if(isGameRoom) then
	--additionally add hexastore value of has-gameroom-of
	if(not createHexastore('hex|sessions:rooms', sessionId, 'has-gameroom-of', clientRoomName)) then
		return redis.error_reply('INVALID HEX GAME ROOM SUB RESPONSE')
	end
end

isClientBot	= redis.call('hexists', rk.session, 'bot') == 1
if(isClientBot) then
	--update counts for bot field/key
	redis.call('sadd', rk.roomBots, sessionId)
	redis.call('hincrby', rk.roomInfo, "bots", 1)
end

--send a message to existing sessions
local publishSubscribe = function()
	local response = strAppendResponse or {}
	local dataToSend = {
		sessionIds = nil,
		messageId = -1,
		message = {
			phase = "subscribed",
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
	if(roomExists) then --for subscribe, we always want to be sure room is still here
		sessionIds = {}
		searchTerm = '[pos||is-sub-of||'..clientRoomName..'||'
		subscribers = redis.call('zrangebylex', 'hex|sessions:rooms', searchTerm, searchTerm..'\xff')

		--store count of subs
		numSubscribers = #subscribers

		for x=1, numSubscribers do
			sessionIds[x] = subscribers[x]:sub(#searchTerm)
		end

		--set sessionIds to list of ids in the room
		dataToSend.sessionIds = sessionIds

		--increment message id
		local nextId = redis.call('hincrby', rk.roomInfo, "nextMessageId", 1)

		--add message id to ensure ordered messages by the time it reaches node
		dataToSend.messageId = nextId

		--send user connecting to room message list to be processed by room queue
		redis.call('zadd', rk.roomMessages, nextId, cjson.encode(dataToSend.message))

		--add user to the history, but set it to retrieve messages after their connecting message
		redis.call('zadd', rk.roomHistory, nextId, sessionId)

		--encode message and sessionId(s) for redis
		local encoded = cjson.encode(dataToSend)

		--https://redis.io/commands/eval#available-libraries
		redis.call('publish', rk.roomName, encoded)

		--return the sub message to retry if failure
		return redis.status_reply('SUBSCRIBE OK')
	end
	return redis.error_reply('NO SUBSCRIBERS - '..clientRoomName)
end
return publishSubscribe()
