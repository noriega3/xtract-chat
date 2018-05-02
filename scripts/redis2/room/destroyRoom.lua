local _tonumber = tonumber
local _unpack = unpack
local _stringformat = string.format
local _tostring = tostring
local _type = type

--VALIDATION
if(not KEYS[1] or not _tostring(KEYS[1])) then return redis.error_reply('NO ROOM KEY') end
if(not KEYS[2] or not _tonumber(KEYS[2])) then return redis.error_reply('NO NODE TIME KEY') end
if(ARGV[1] and not cjson.decode(ARGV[1])) then return redis.error_reply('INVALID DESTROY DATA') end
if(ARGV[2] and not cjson.decode(ARGV[2])) then return redis.error_reply('INVALID APPEND DATA') end

--========================================================================
-- UTILITY Functions
--========================================================================

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

local convertValueType = function(value)
	local newVal, isNumeric, isString
	isNumeric = _tonumber(value)
	if(isNumeric) then
		return isNumeric
	else
		isString = _tostring(value)
		if(not isString) then
			return nil
		elseif(isString == 'true' or isString == 'false') then
			return isString == 'true'
		else
			return isString
		end
	end
end
--========================================================================
-- CORE Functions
--========================================================================

--Room properties
local clientRoomName    = KEYS[1]
local nodeTime    		= KEYS[2]
local destroyParams	    = cjson.decode(ARGV[1])
local appendResponse	= cjson.decode(ARGV[2]) or {}
local sessionId, sessionRooms, keyName

local rk = {
	countsRooms 			= 'counts|rooms',
	openRooms 				= 'open|rooms',
    countsOverall           = "counts|overall",
	countsRooms             = "counts|rooms",
	tickRooms               = "tick|rooms",
	matches      			= "matches|",
	roomName                = "rooms|"..KEYS[1],
    roomInfo                = "rooms|"..KEYS[1].."|info",
    roomHistory             = "rooms|"..KEYS[1].."|history",
    roomMessages            = "rooms|"..KEYS[1].."|messages",
    roomReserves            = "rooms|"..KEYS[1].."|reserves",
    roomBots	            = "rooms|"..KEYS[1].."|bots",
    roomMatchList           = "rooms|"..KEYS[1].."|match",
}
local roomProps = {}
if(redis.call('exists', rk.roomInfo) == 1) then
	if(redis.call('hexists',rk.roomInfo, 'destroying') == 1) then return redis.error_reply('ALREADY DESTROYING') end

	--get info from room if it exists
	local infoKeys = {'roomTypeId','roomPath','roomAppName','roomGame','roomTheme','roomId','roomAppGameName','roomAppGameThemeName','roomGameThemeName'}
	local roomInfo = redis.call('hmget', rk.roomInfo, _unpack(infoKeys))
	for x=1, #infoKeys do
		roomProps[infoKeys[x]] = convertValueType(roomInfo[x])
	end
	redis.call('hset', rk.roomInfo, 'destroying', 1)
end

--set a destroying flag to true
if(redis.call('renamenx', rk.roomName, rk.roomName..':locked') == 0) then
	return redis.error_reply('ALREADY DESTROYING ROOM')
end

local delList = {rk.roomName, rk.roomName..":locked", rk.roomInfo, rk.roomHistory, rk.roomMessages, rk.roomBots, rk.roomReserves}

--remove optIns and players from current game Id and next game id
local matches = redis.call('lrange', rk.roomMatchList, 0, -1)

if(matches and #matches > 0) then
	local matchKeys = {'', 'live', 'turn', 'props', 'state', 'sessions'}
	for x=1, #matches do
		for y=1, #matchKeys do
			keyName = rk.roomMatchList..":"..matches[x]..":"..matchKeys[y]
			if(redis.call('exists', keyName)) then
				delList[#delList+1] = keyName
			end
		end
	end
end

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

	local response = appendResponse

	response.room = clientRoomName
	response.sessionId = sessionId
	response.isGameRoom = true
	response.userId = userId
	response.bot = isBot

	messages[#messages+1] = {
			phase = "unsubscribed",
			room = clientRoomName,
			response = response
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
if(roomProps['roomTypeId']) then
	redis.call('zrem', 'hex|rooms:properties', createHexastore(clientRoomName, 'is-room-type', roomProps['roomTypeId']))
end

--remove from matches list
redis.call('srem',rk.matches,clientRoomName)

--remove from open rooms
redis.call('zrem', rk.openRooms, 'high::'..clientRoomName, 'low::'..clientRoomName, 'rhigh::'..clientRoomName, 'rlow::'..clientRoomName)

redis.call('zrem', rk.countsRooms, clientRoomName)

if(roomProps['roomPath'] and roomProps['roomPath'] ~= clientRoomName) then
	rk.countsRoomPath = 'counts|'..roomProps['roomPath']
	redis.call('zrem',rk.countsRoomPath, clientRoomName)
end

--update counts
if(roomProps['roomTheme'] and roomProps['appGameThemeName'] and roomProps['roomAppGameName']) then
	if(roomProps['roomAppGameName'] ~= clientRoomName) then
		rk.countsAppGameName = 'counts|'..roomProps['roomAppGameName']
		local themeCount = redis.call('zlexcount', 'hex|sessions:rooms', '[pos||is-sub-of||'..roomProps['appGameThemeName']..':', '[pos||is-sub-of||'..roomProps['appGameThemeName']..':\xff')
		redis.call('zadd', rk.countsAppGameName, themeCount, roomProps['roomTheme'])
	end
end

if(roomProps['roomGame'] and roomProps['roomAppGameName'] and roomProps['roomAppGameThemeName']) then
	if(roomProps['roomAppGameThemeName'] ~= clientRoomName) then
		rk.countsAppGameThemeName = 'counts|'..roomProps['roomAppGameThemeName']
		local gameCount = redis.call('zlexcount', 'hex|sessions:rooms', '[pos||is-sub-of||'..roomProps['roomAppGameName']..':', '[pos||is-sub-of||'..roomProps['roomAppGameName']..':\xff')
		redis.call('zadd', rk.countsAppGameThemeName, gameCount, roomProps['roomGame'])
	end
end

--add to log
redis.call('lpush', 'log|room:destroys', clientRoomName)

return redis.status_reply('OK')
