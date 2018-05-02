--- Called by itself to setup a new match or on state 'COMPLETE'
local _unpack = unpack
local _tonumber = tonumber
local _mathrandom = math.random
local _tostring = tostring

local clientRoomName 	= KEYS[1]
local setPrevMatch 	= ARGV[1]
local currentTime       = _tonumber(redis.call('get', 'serverTime'))
if(not clientRoomName) then return redis.error_reply('NO ROOM') end
if(not currentTime) then
	return redis.error_reply('NO SERVERTIME')
end
local rk = {
	tickRooms      	= "tick|rooms",
	roomName       	= "rooms|"..KEYS[1],
	roomInfo       	= "rooms|"..KEYS[1].."|info",
	roomMatchList   = "rooms|"..KEYS[1].."|match",
}
local matchState, doesRoomExist, turnExpiration
local isNumeric, keyToRemove
local roomInfo, infoKeys, matchIdAppends
local newTurnExpiration = currentTime+5000
local info = {}

--check if room exists
doesRoomExist = redis.call('exists', rk.roomName) == 1 and redis.call('exists', rk.roomInfo) == 1
if(not doesRoomExist) then
	return redis.error_reply('NOT EXIST')
end

--check if turn expiration is elapsed
turnExpiration = _tonumber(redis.call('hget', rk.roomInfo, 'matchTurnExpire')) or -1
if(not turnExpiration or turnExpiration > currentTime) then
	return redis.status_reply('TURN NOT EXPIRED')
end

--retrieve current values for match in a room
infoKeys = {'nextMessageId', 'matchId', 'matchHash', 'matchTimeStart', 'matchMessageIdStart', 'nextMatchId', 'nextMatchHash'}
roomInfo = redis.call('hmget', rk.roomInfo, _unpack(infoKeys))
for x=1, #info do
	isNumeric = _tonumber(roomInfo[x])
	info[infoKeys[x]] = isNumeric and isNumeric or _tostring(roomInfo[x])
end

--check if matchId exists
if(not info.matchId) then
	return redis.error_reply('INVALID MATCH')
end

--set redis key to current matchId
rk.roomMatch = rk.roomMatchList..":"..info.matchId

--check if room state is right (COMPLETE)
matchState = redis.call('lindex', rk.roomMatch..":state", 0)
if(not matchState) then
	return redis.error_reply('INVALID STATE')
end
if(matchState ~= "COMPLETE") then
	if(matchState ~= "NEW_MATCH") then
		return redis.error_reply('INVALID STATE')
	end
end

--update to global room ticker with a grace period of 5 seconds
redis.call('zadd',rk.tickRooms,newTurnExpiration,clientRoomName)

--set previous if set to true coming like 'COMPLETE' from a match
if(setPrevMatch and matchState == "COMPLETE") then

	--set values of last id
	redis.call('hmset', rk.roomInfo,
			'prevMatchId', info.matchId,
			'prevMatchHash', info.matchHash,
			'prevMatchProps', cjson.encode(redis.call('hget', rk.roomMatchList..":"..info.matchId..":props")),
			'prevMatchTimeStart', info.matchTimeStart,
			'prevMatchTimeEnd', currentTime,
			'prevMessageIdStart', info.matchMessageIdStart,
			'prevMessageIdEnd', info.nextMessageId,
	)
end

--remove last match's tables
matchIdAppends = {'locked', 'turn', 'props', 'state'}
for x=1, #matchIdAppends do
	keyToRemove = rk.roomMatch..matchIdAppends[x]
	if(redis.call('exists', keyToRemove) == 1) then redis.call('unlink',keyToRemove) end
end

--=================================================================
-- setup new match tables

--set roomMatch to new matchId
rk.roomMatch = rk.roomMatchList..":"..info.nextMatchId

--create new :state
redis.call('rpush', rk.roomMatch..":state", "OPT_IN", "ACTIVE", "COMPLETE")

--create new :props (if needed)
if(redis.call('exists', rk.roomMatch..":props") == 0) then
	--retrieve the match template for matches in this room and decode the json
	local matchPropsTemplate = redis.call('hget', rk.roomInfo, 'matchTemplate')
	matchPropsTemplate = matchPropsTemplate and cjson.decode(matchPropsTemplate)
	if(not matchPropsTemplate) then return redis.error_reply('INVALID MATCH PROP TEMPLATE') end
	local props = {}
	for k,v in pairs(matchPropsTemplate) do	props[#props+1], props[#props+1] = k,v end
	redis.call('hmset', rk.roomMatch..":props", _unpack(props))
end

--shift current roomInfo properties to the 'next.. values'
redis.call('hmset',
		'matchId', info.nextMatchId,
		'matchHash', info.nextMatchHash,
		'matchMessageIdStart', info.nextMessageId,
		'matchTimeStart', currentTime,
		'nextMatchId', redis.call('hincrby', rk.roomInfo, 'nextMatchId', 1),
		'nextMatchHash', _mathrandom(currentTime, currentTime+info.nextMatchId+1)
		'matchState', 'OPT_IN',
		'matchTurn', -1,
		'matchTurnStart', currentTime,
		'matchTurnExpire', newTurnExpiration
)

--push to |match
if(redis.call('lindex', rk.roomMatchList, -1) ~= info.nextMatchId) then
	redis.call('rpush', rk.roomMatchList, info.nextMatchId)
end

--check if we need to pop off the previous matchId from list
if(redis.call('lindex', rk.roomMatchList, 0) == info.matchId) then
	redis.call('lpop', rk.roomMatchList)

	--ensure the one after the pop or whatever is first is the new matchId
	if(redis.call('lindex', rk.roomMatchList, 0) ~= info.nextMatchId) then
		return redis.error_reply('NEXT MATCH ID INVALID')
	end
end



return redis.status_reply('OK')
