local _tonumber = tonumber
local _unpack = unpack
local _stringformat = string.format
local _tostring = tostring
local _type = type

--VALIDATION
if(not KEYS[1] or not _tostring(KEYS[1])) then return redis.error_reply('NO SESSION KEY') end
if(not KEYS[2] or not _tostring(KEYS[2])) then return redis.error_reply('NO ROOM PATH KEY') end
if(not KEYS[3] or not _tonumber(KEYS[3])) then return redis.error_reply('NO NODE TIME KEY') end
if(not cjson.decode(ARGV[1])) then return redis.error_reply('NO SUB DATA') end

--========================================================================
-- UTILITY Functions
--========================================================================

local removeHexReserve = function(subject,predicate,object)
	return redis.call('zrem', 'hex|sessions:rooms',
	_stringformat("spo||%s||%s||%s", subject, predicate, object),
	_stringformat("sop||%s||%s||%s", subject, object, predicate),
	_stringformat("osp||%s||%s||%s", object, subject, predicate),
	_stringformat("ops||%s||%s||%s", object, predicate, subject),
	_stringformat("pos||%s||%s||%s", predicate, object, subject),
	_stringformat("pso||%s||%s||%s", predicate, subject, object))
end

local addHexReserve = function(subject,predicate,object)
	return redis.call('zadd', 'hex|sessions:rooms',
	0,_stringformat("spo||%s||%s||%s", subject, predicate, object),
	0,_stringformat("sop||%s||%s||%s", subject, object, predicate),
	0,_stringformat("osp||%s||%s||%s", object, subject, predicate),
	0,_stringformat("ops||%s||%s||%s", object, predicate, subject),
	0,_stringformat("pos||%s||%s||%s", predicate, object, subject),
	0,_stringformat("pso||%s||%s||%s", predicate, subject, object))
end

local retrieveSeatFromHexResult = function(result, strRemoval)
	if(_type(result) ~= 'table' or _type(strRemoval) ~= 'string') then return false end
	if(#result <= 0 or not result[1]) then return false end
	if(_type(result[1]) ~= 'string') then return false end
	return _tonumber(result[1]:sub(#strRemoval+1)) --+1 because sub starts @ 0
end

local function isValidGameType(type)
	return type and (type == 'gameRoom' or type == 'system' or type == 'standard') --todo: add different types here or reference table
end

local function _stringStarts(str,start)
	return string.sub(str,1,string.len(start))==start
end

local function _isSeatOpen(roomName, seatIndex)
	return redis.call('zscore','rooms|'..roomName, 'open:seat:'..seatIndex)
end

local function isValidPrevRoom(prevGameRoom, prevGameSeat, newRoomPath)
	if(not prevGameRoom) then return false end
	if(not _tonumber(prevGameSeat) or not _tostring(prevGameRoom)) then return false end
	if(not _stringStarts(prevGameRoom, newRoomPath)) then return false end
	if(not _isSeatOpen(prevGameRoom, _tonumber(prevGameSeat))) then return false end
	return true
end
	if(prevGameRoom and _stringStarts(prevGameRoom, roomPath) and prevGameSeat) then
		local memberIndex = redis.call('zrangebylex', roomName, '[open:seat:', '[open:seat:\xff', 'LIMIT', 0, 1)

	else
end

--========================================================================
-- CORE Functions
--========================================================================

local sessionId             = KEYS[1]
local roomPath              = KEYS[2]
local nodeTime              = KEYS[3]
local reserveParams			= cjson.decode(ARGV[1])
local strAppendResponse		= cjson.decode(ARGV[2])

--configs
local reserveExpireTime
local rk = {
	countsRooms             = "counts|rooms", --for dashboard
	roomPathCounts          = "counts|"..roomPath, --for reserve searching rooms
}
local userId, roomType, isClientBot
local isGameRoom,seatKey, seat, searchTerm, hexastore
local prevGameRoom, prevGameSeat, isReconnecting
--NOTE: this does not check if rooms found has reservationsFlag on it
userId = strAppendResponse and strAppendResponse.userId or redis.call('hget', rk.session, 'userId')
isClientBot = redis.call('hexists', rk.session, 'bot') == 1


--check if session was or is currently in a room similar to the path
searchTerm = 'open:seat:'
prevGameRoom = redis.call('hget', rk.session, 'prevGameRoom')
prevGameSeat = redis.call('hget', rk.session, 'prevGameSeat')
if(isValidPrevRoom(prevGameRoom, prevGameSeat, roomPath)) then
	seat = retrieveSeatFromHexResult(hexastore, searchTerm)
	isReconnecting = true
else

	local roomsList = redis.call('zrangebyscore', rk.roomPathCounts, 0, "("..maxSubscribers, 'LIMIT', 0, 9)
	local roomReserved

	if(#roomsList > 0) then
		for x=1, #roomsList do
			local seat = reserveRoom(roomsList[x])
			if(result) then
				roomReserved = result
				--break out and give the result
				return result
			end
		end
	end

	if(roomReserved) then return reserveRoom end

	--make reservation to a new room
	local roomId = redis.call('incr', 'ids|rooms')
	local newRoomName = roomPath..":"..roomId
	return reserveRoom(newRoomName)

	hexastore = redis.call('zrangebylex', rk.roomName, '['..searchTerm, '['..searchTerm..'\xff', 'LIMIT', 0, 1)
	seat = retrieveSeatFromHexResult(hexastore, searchTerm)
end

if(not seat) then return redis.error_reply('NO SEAT NUMBER - '..roomPath) end

--set reservation
redis.call('zadd', rk.roomName, 0, 'reserved:seat:'..seat)
redis.call('zrem', rk.roomName, searchTerm..seat)
if(not addHexReserve(sessionId,'is-reserve-of',rk.roomName)) then
	removeHexReserve(sessionId,'is-reserve-of',rk.roomName)
	return redis.error_reply('INVALID HEX RESERVATION - '..roomPath)
end

--add sessionId to reserves list
redis.call('zadd',rk.roomReserves,expireTime,sessionId)
redis.call('pexpire',rk.roomReserves,reserveExpireTime)

local publishConnecting = function(roomName, seatIndex)
	rk = {
		roomName                = "rooms|"..roomName,
		roomHistory             = "rooms|"..roomName.."|history",
		roomMessages            = "rooms|"..roomName.."|messages",
		roomInfo                = "rooms|"..roomName.."|info",
		roomReserves            = "rooms|"..roomName.."|reserves" --will hold expiration time
	}
	local roomExists = redis.call('exists', 'rooms|'..roomName..'|info') == 1
	local response = strAppendResponse and strAppendResponse or {}
	local dataToSend = {
		sessionId = nil,
		sessionIds = nil,
		message = {
			phase = isReconnecting and "userReconnecting" or "userConnecting",
			room = roomName,
			response = response
		}
	}
	local sessionIds, subscribers, numSubscribers

	--overwrite or set to default some the message.response (to prevent meddling)
	response.room 		= clientRoomName
	response.sessionId 	= sessionId
	response.userId 	= userId
	response.bot 		= isClientBot or nil
	response.isNewRoom 	= true
	response.expireAt 	= nodeTime+reserveExpireTime
	response.expireTime	= reserveExpireTime

	if(roomExists) then
		response.roomType 	= redis.call('hget', rk.roomInfo, 'roomType')
		response.isGameRoom = isGameRoom(response.roomType)
		response.isNewRoom 	= false

		sessionIds = {}
		searchTerm = '[pos||is-sub-of||'..roomName..'||'
		subscribers = redis.call('zrangebylex', 'hex|sessions:rooms', searchTerm, searchTerm..'\xff')

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

		--add the person who is connecting to the list so they get the message too
		sessionIds[#sessionIds+1] = sessionId

		--set sessionIds to list of ids in the room
		dataToSend.sessionIds = sessionIds
	end

	--encode message for redis
	local encoded = cjson.encode(dataToSend)

	--https://redis.io/commands/eval#available-libraries
	redis.call('publish', rk.roomName, encoded)

	return redis.status_reply('RESERVED OK - '.._tostring(seat))
end

local reserveRoom = function(roomName)

	rk = {
		countsRooms             = "counts|rooms", --for dashboard
		roomPathCounts          = "counts|"..roomPath, --for reserve searching rooms
		hexSessionsToRooms      = "hex|sessions:rooms",
		tickRooms               = "tick|rooms",
		tickSessions            = "tick|sessions",
		tickReserves            = "tick|reserves",
		session                 = "sessions|"..KEYS[1],
		sessionReserves         = "sessions|"..KEYS[1].."|reserves",
		roomName                = "rooms|"..roomName,
		roomHistory             = "rooms|"..roomName.."|history",
		roomMessages            = "rooms|"..roomName.."|messages",
		roomInfo                = "rooms|"..roomName.."|info",
		roomReserves            = "rooms|"..roomName.."|reserves" --will hold expiration time
	}

	--update session or return error when doesnt exist
	redis.call('zadd', rk.tickSessions, 'XX', currentTime, sessionId)
	local isRoomExist = redis.call('exists', rk.roomName) == 1
	local searchTerm = '[pos||is-sub-of||'..roomName..'||'

	--check if room counts are valid if we add this person into the reserves
	local numSubscribers = redis.call('zlexcount', 'hex|sessions:rooms', searchTerm, searchTerm..'\xff')
	if(numSubscribers >= maxSubscribers) then return false end

	if(isRoomExist) then
		local seatIndex = getOpenSeatIndex(sessionId, rk.roomName) --added v2
		if(not seatIndex) then return false end

		--add update tickers for room
		redis.call('zadd',rk.tickRooms, 'XX', currentTime, roomName)

		--Publish connecting message
		publishConnecting(roomName, seatIndex)
	end

	--add sessionId to reserves list
	redis.call('zadd',rk.roomReserves,expireTime,sessionId)
	redis.call('pexpire',rk.roomReserves,reserveExpireTime)

	return roomName
end

local findAndReserveAvailableRoom = function(roomPath)

	local roomsList = redis.call('zrangebyscore', rk.roomPathCounts, 0, "("..maxSubscribers, 'LIMIT', 0, 9)

	local roomReserved
	if(#roomsList > 0) then
		for x=1, #roomsList do
			local result = reserveRoom(roomsList[x])
			if(result) then
				roomReserved = result
				--break out and give the result
				return result
			end
		end
	end

	if(roomReserved) then return reserveRoom end

	--make reservation to a new room
	local roomId = redis.call('incr', 'ids|rooms')
	local newRoomName = roomPath..":"..roomId
	return reserveRoom(newRoomName)
end

return findAndReserveAvailableRoom(roomPath)

