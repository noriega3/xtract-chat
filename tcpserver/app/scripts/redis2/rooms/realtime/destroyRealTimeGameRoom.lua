local _unpack = unpack
local _stringformat = string.format
--create single hexastore
local createHexastore = function(subject,predicate,object)
    return
		_stringformat("spo||%s||%s||%s",subject,predicate,object),
		_stringformat("sop||%s||%s||%s",subject,object,predicate),
		_stringformat("osp||%s||%s||%s",object,subject,predicate),
		_stringformat("ops||%s||%s||%s",object,predicate,subject),
		_stringformat("pos||%s||%s||%s",predicate,object,subject),
		_stringformat("pso||%s||%s||%s",predicate,subject,object)
end

local hexSearchSubject = function(redisKey, predicate, object)
	local searchTerm = '[pos||'..predicate..'||'..object..'||'
	local results = redis.call('zrangebylex', redisKey, searchTerm, searchTerm..'\xff')
	local response = {}
	for x = 1,#results do
		response[#response+1] = results[x]:sub(#searchTerm)
	end
	return response
end

local hexSearchObject = function(redisKey, predicate, subject)
	local searchTerm = '[pso||'..predicate..'||'..subject..'||'
	local results = redis.call('zrangebylex', redisKey, searchTerm, searchTerm..'\xff')
	local response = {}
	for x = 1,#results do
		response[#response+1] = results[x]:sub(#searchTerm)
	end
	return response
end

--Room properties
local roomType = 1
local clientRoomName    = KEYS[1]
local roomArr           = cjson.decode(KEYS[2]) or {}
local sessionId, sessionRooms

local rk = {
    countsOverall           = "counts|overall",
    countsRooms             = "counts|rooms",
	countsRoomPath          = "counts|"..roomArr['roomPath'],
    tickRooms               = "tick|rooms",
    roomName                = "rooms|"..KEYS[1],
    roomInfo                = "rooms|"..KEYS[1].."|info",
    roomHistory             = "rooms|"..KEYS[1].."|history",
    roomMessages            = "rooms|"..KEYS[1].."|messages",
    roomReserves            = "rooms|"..KEYS[1].."|reserves",
    roomBots	            = "rooms|"..KEYS[1].."|bots"
}

--set a destroying flag to true
redis.call('hset', rk.roomInfo, 'destroying', 1)


local delList = {rk.roomName, rk.roomInfo, rk.roomHistory, rk.roomMessages, rk.roomBots, rk.roomReserves}

--gather all sessions in the room
local sessions 	= hexSearchSubject('hex|sessions:rooms','is-sub-of',clientRoomName)
local reserves 	= hexSearchSubject('hex|sessions:rooms','is-reserve-of',clientRoomName)
local gamerooms = hexSearchSubject('hex|sessions:rooms','has-gameroom-of',clientRoomName)
local hexRemovals 	= {}
local messages	 	= {}

local addToHexRemove = function(subject,predicate,object)
	hexRemovals[#hexRemovals+1] = _stringformat("spo||%s||%s||%s",subject,predicate,object)
	hexRemovals[#hexRemovals+1] = _stringformat("sop||%s||%s||%s",subject,object,predicate)
	hexRemovals[#hexRemovals+1] = _stringformat("osp||%s||%s||%s",object,subject,predicate)
	hexRemovals[#hexRemovals+1] = _stringformat("ops||%s||%s||%s",object,predicate,subject)
	hexRemovals[#hexRemovals+1] = _stringformat("pos||%s||%s||%s",predicate,object,subject)
	hexRemovals[#hexRemovals+1] = _stringformat("pso||%s||%s||%s",predicate,subject,object)
end

--unsub each session
for x = 1,#sessions do
    sessionId = sessions[x]
    sessionRooms = "sessions|"..sessionId.."|rooms"
    redis.call('zrem',sessionRooms,clientRoomName)

    --remove hexastores associating session and room
	addToHexRemove(sessionId, 'is-sub-of', clientRoomName)
end

--unsub each session reserves
for x = 1,#reserves do
	sessionId = reserves[x]
	--remove hexastores associating session and room
	addToHexRemove(sessionId, 'is-reserve-of', clientRoomName)
end

--unsub each session's current game room
for x = 1,#gamerooms do
	sessionId = gamerooms[x]

	--remove hexastores associating session and gameroom
	addToHexRemove(sessionId, 'has-gameroom-of', clientRoomName)

	--send a message that they unsubscribed
	local hexResponse = hexSearchObject('hex|sessions:users','is-user-id', sessionId)
	local userId = hexResponse and hexResponse[1] and hexResponse[1] or false
	local isBot = userId and redis.call('hget', 'sessions|'..sessionId, 'bot')
	isBot = isBot == "true"

	messages[#messages+1] = {
			phase = "unsubscribed",
			room = clientRoomName,
			response = {
				room = clientRoomName,
				sessionId = sessionId,
				isGameRoom = true,
				userId = userId,
				bot = isBot
			}
		}
end

--setup mass message send of unsubscribes if users are still connected to room
if(#gamerooms > 0) then
	--encode message for redis
	local encoded = cjson.encode({
		sessionIds = gamerooms,
		messages = messages
	})

	--send a message to redis
	redis.call('publish', rk.roomName, encoded)
end

--remove hexastores associating session and room
if(#hexRemovals > 0) then
	redis.call('zrem','hex|sessions:rooms', _unpack(hexRemovals))
end

--remove from global room ticker
redis.call('zrem',rk.tickRooms,clientRoomName)

--remove the room, info, history, and messages
redis.call('del',_unpack(delList))

--remove hexastores associating room properties
redis.call('zrem', 'hex|rooms:properties', createHexastore(clientRoomName, 'is-room-type', roomType))

--update counts
redis.call('zrem', rk.countsRooms, clientRoomName)
redis.call('zrem', rk.countsRoomPath, clientRoomName)

--add to log
redis.call('lpush', 'log|room:destroys', clientRoomName)

return function()
	local subCount = redis.call('zlexcount', 'hex|sessions:rooms', '[pos||is-sub-of||'..clientRoomName..'||', '[pos||is-sub-of||'..clientRoomName..'||\xff')
	local themeCount = redis.call('zlexcount', 'hex|sessions:rooms', '[pos||is-sub-of||'..roomArr['roomAppGameThemeName']..':', '[pos||is-sub-of||'..roomArr['roomAppGameThemeName']..':\xff')
	local gameCount = redis.call('zlexcount', 'hex|sessions:rooms', '[pos||is-sub-of||'..roomArr['roomAppGameName']..':', '[pos||is-sub-of||'..roomArr['roomAppGameName']..':\xff')
	redis.call('zadd', rk.countsRooms, subCount, clientRoomName)
	redis.call('zadd', rk.countsRoomPath, subCount, clientRoomName)
	redis.call('zadd', rk.countsGame, themeCount, roomArr['roomTheme'])
	redis.call('zadd', rk.countsOverall, gameCount, roomArr['roomGame'])
	return redis.status_reply('OK')
end


