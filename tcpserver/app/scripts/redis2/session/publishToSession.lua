local _tonumber = tonumber

--VALIDATION
if(not KEYS[1]) then return redis.error_reply('NO SESSION KEY') end
if(not KEYS[2] and not _tonumber(KEYS[2])) then return redis.error_reply('NO NODE TIME KEY') end
if(not ARGV[1] or not cjson.decode(ARGV[1])) then return redis.error_reply('INVALID MESSAGE') end
if(ARGV[2] and not cjson.decode(ARGV[2])) then return redis.error_reply('INVALID OPTIONS') end

--========================================================================
-- UTILITY Functions
--========================================================================

--========================================================================
-- CORE Functions
--========================================================================
local sessionId    			= KEYS[1]
local currentTime    		= _tonumber(KEYS[2])
local sessionRoomName 		= "sessions:"..sessionId
local message           	= cjson.decode(ARGV[1])
--options
local publishOptions      	= ARGV[2] and cjson.decode(ARGV[2]) or {}
local skipChecks			= publishOptions.skipChecks

local rk = {
	tickSessions            = "tick|sessions",
	tickRooms               = "tick|rooms",
	session		            = "session|"..sessionId,
	roomName                = "rooms|"..sessionRoomName,
	roomMessages         	= "rooms|"..sessionRoomName.."|messages",
	roomInfo                = "rooms|"..sessionRoomName.."|info",
}
local sessionRoomExists		= redis.call('exists', rk.roomInfo) == 1
local isValidMessageTime	= currentTime >= (_tonumber(redis.call('hget', 'sessions|'..sessionId, 'updated')) or -1)
local reEncodedMessage, dataToSend, canUpdateTick

if(not isValidMessageTime and not skipChecks) then
	return redis.error_reply('INVALID MESSAGE, OLDER MESSAGE DATA RECEIVED')
end

if(not sessionRoomExists and not skipChecks) then
	return redis.error_reply('SESSION ROOM NOT FOUND '..sessionId)
end

--do validation on all non sub/unsub publish to room commands here
local searchTerm = '[pos||is-sub-of||'..sessionRoomName..'||'
local searchResults = redis.call('zrangebylex', 'hex|sessions:rooms', searchTerm, searchTerm..'\xff')
local subscribers = {}
for x=1, #searchResults do
	subscribers[x] = searchResults[x]:sub(#searchTerm)
end

if(#subscribers <= 0 and not skipChecks) then
	return redis.error_reply('SESSION ROOM EMPTY')
end

dataToSend = {
	sessionIds = subscribers,
	messageId = -1,
	message = message
}

if(sessionRoomExists) then

	canUpdateTick = redis.call('zscore',rk.tickRooms,sessionRoomName)
	canUpdateTick = canUpdateTick and _tonumber(canUpdateTick) > 0 or false --ensure that it isn't a system or standard room with tick disabled

	--add update tickers for room
	if(canUpdateTick) then
		redis.call('zadd',rk.tickRooms, 'XX', currentTime,sessionRoomName)
	end

	--increase message id
	local nextId = redis.call('hincrby', rk.roomInfo, 'nextMessageId', 1)

	--add message id to ensure ordered messages by the time it reaches node
	dataToSend.messageId = nextId

	--add to list of messages
	redis.call('zadd',rk.roomMessages, nextId, cjson.encode(dataToSend.message))

end

reEncodedMessage = cjson.encode(dataToSend)

redis.call('publish', rk.roomName, reEncodedMessage)

return redis.status_reply(reEncodedMessage)



