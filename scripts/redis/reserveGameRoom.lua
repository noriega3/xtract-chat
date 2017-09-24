local _tonumber = tonumber
local _unpack = unpack
local _stringformat = string.format

local sessionId             = KEYS[1]
local clientRoomName        = KEYS[2]
local currentTime           = KEYS[3]
local maxSubscribers        = _tonumber(KEYS[4])
local roomArr               = cjson.decode(KEYS[5])
local roomPath				= roomArr.roomPath
local expireTime            = currentTime+30000
local rk = {
	countsRooms             = "counts|rooms", --for dashboard
	roomPathCounts          = "counts|"..roomPath, --for reserve searching rooms
}

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

local getOpenSeatIndex = function()
	--find available seat and remove open seat
	local memberIndex = redis.call('zrangebylex', rk.roomName, '[open:seat:', '[open:seat:\xff', 'LIMIT', 0, 1)
	if(memberIndex and memberIndex[1]) then
		local seat = memberIndex[1]:gsub("open:seat:", "")
		redis.call('zadd', rk.roomName, 0, 'reserved:seat:'..seat)
		redis.call('zrem', rk.roomName, memberIndex[1])
		addHexReserve(sessionId,'is-reserve-of',clientRoomName)
		return seat
	end
	removeHexReserve(sessionId,'is-reserve-of',clientRoomName)
	return false
end

local publishConnecting = function(seatIndex)
	local searchTerm = '[pos||is-sub-of||'..clientRoomName
	local response = cjson.decode(ARGV[1])
	local isReSub = redis.call('zscore', rk.roomName, sessionId) --if user is already in the room, we dont need another userConnecting message
	local searchResults = redis.call('zrangebylex', 'hex|sessions:rooms', searchTerm, searchTerm..'\xff')
	local subscribers = {}
	for x=1, #searchResults do
		subscribers[x] = searchResults[x]:sub(#searchTerm)
	end
	if(not subscribers or #subscribers <= 0 or isReSub) then return end

	local dataToSend = {
		sessionIds = subscribers,
		message = {
			phase = "userConnecting",
			room = clientRoomName,
			response = response
		}
	}

	--add overwites here for message.response
	response.sessionId = sessionId
	response.userId = redis.call('hget', rk.session, 'userId')
	response.isGameRoom = true --added v2
	response.seatIndex = seatIndex

	--encode message for redis
	local encoded = cjson.encode(dataToSend)

	--increment message id
	local nextId = redis.call('hincrby', rk.roomInfo, "nextMessageId", 1)

	--send user connecting to room message list to be processed by room queue
	redis.call('zadd', rk.roomMessages, nextId, cjson.encode(dataToSend.message))

	--add user to the history, but set it to retrieve messages after their connecting message
	redis.call('zadd', rk.roomHistory, nextId, sessionId)

	--https://redis.io/commands/eval#available-libraries
	return redis.call('publish', rk.roomName, encoded)
end

local reserveRoom = function()

    rk = {
        countsRooms             = "counts|rooms", --for dashboard
        roomPathCounts          = "counts|"..roomPath, --for reserve searching rooms
        hexSessionsToRooms      = "hex|sessions:rooms",
        tickRooms               = "tick|rooms",
        tickSessions            = "tick|sessions",
        tickReserves            = "tick|reserves",
        session                 = "sessions|"..KEYS[1],
        sessionReserves         = "sessions|"..KEYS[1].."|reserves",
        roomName                = "rooms|"..clientRoomName,
        roomHistory             = "rooms|"..clientRoomName.."|history",
        roomMessages            = "rooms|"..clientRoomName.."|messages",
        roomInfo                = "rooms|"..clientRoomName.."|info",
        roomReserves            = "rooms|"..clientRoomName.."|reserves" --will hold expiration time
    }

    --update session or return error when doesnt exist
    redis.call('zadd', rk.tickSessions, 'XX', currentTime, sessionId)
	local isRoomExist = redis.call('exists', rk.roomName) == 1
    local searchTerm = '[pos||is-sub-of||'..clientRoomName..'||'

    --check if room counts are valid if we add this person into the reserves
    local numSubscribers = redis.call('zlexcount', 'hex|sessions:rooms', searchTerm, searchTerm..'\xff')

	--refresh the amount of users in roomPath (just an update does not add the reserve)
	redis.call('zadd', rk.countsRooms, numSubscribers, clientRoomName)
	redis.call('zadd', rk.roomPathCounts, numSubscribers, clientRoomName)
	if(numSubscribers >= maxSubscribers) then return false end

	--refresh and cleanup expired reservations
	local expiredReserves = redis.call('zrangebyscore', rk.roomReserves, 0, currentTime)
	for x=1, #expiredReserves do
		removeHexReserve(expiredReserves[x], 'is-reserve-of', clientRoomName)
	end
	redis.call('zremrangebyscore', rk.roomReserves, 0, currentTime)

	--count number of reservations after cleanup
	local numReserves = _tonumber(redis.call('zcard', rk.roomReserves)) or 0
	if((numReserves+numSubscribers) >= maxSubscribers) then return false end

	if(isRoomExist) then
		local seatIndex = getOpenSeatIndex() --added v2
		if(not seatIndex) then return false end

		--add update tickers for room
		redis.call('zadd',rk.tickRooms, 'XX', currentTime,clientRoomName)

		--Publish connecting message
		publishConnecting(seatIndex)
	end

    --add sessionId to reserves list
    redis.call('zadd',rk.roomReserves,expireTime,sessionId)

    return clientRoomName
end

return reserveRoom()
