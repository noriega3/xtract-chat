local _tonumber = tonumber
local _tostring = tostring
local _unpack = unpack

local clientRoomName 	= KEYS[1]
local currentTime       = _tonumber(redis.call('get', 'serverTime'))
if(not currentTime) then
	return redis.error_reply('NO SERVERTIME')
end
local rk = {
	tickRooms		= "tick|rooms",
	roomName 		= "rooms|"..KEYS[1],
	roomInfo 		= "rooms|"..KEYS[1].."|info",
	roomMatchList   = "rooms|"..KEYS[1].."|match",
}
local optIns, turnValues = {}, {}
local matchState, newMatchState, doesRoomExist, turnExpiration, newTurnExpiration
local seats,seat, session, numOptIns, nextMatchId
local matchId
local function compare(a,b)	return a < b end

--check if room exists
doesRoomExist = redis.call('exists', rk.roomName) == 1
if(not doesRoomExist) then
	return redis.error_reply('NOT EXIST')
end

--check if turn expiration is elapsed
turnExpiration = _tonumber(redis.call('hget', rk.roomInfo, 'matchTurnExpire')) or -1
if(not turnExpiration or (turnExpiration > currentTime)) then
	return redis.status_reply('TURN NOT EXPIRED')
end

--check if matchId exists
matchId = _tonumber(redis.call('lindex', rk.roomMatchList, 0))
if(not matchId) then
	return redis.error_reply('INVALID MATCH')
end

--get current matchId to check
rk.roomMatch = rk.roomMatchList..":"..matchId
rk.roomMatchLive = rk.roomMatch..":live"
rk.roomMatchTurn = rk.roomMatch..":turn"
rk.roomMatchState = rk.roomMatch..":state"
rk.roomMatchSessions = rk.roomMatch..":sessions"

--check if room state is right (OPT_IN)
matchState = redis.call('lindex', rk.roomMatchState, 0)
if(not matchState or matchState ~= "OPT_IN") then
	return redis.error_reply('INVALID STATE')
end

--check if match is not live
if(redis.call('exists', rk.roomMatchLive) == 1) then
	return redis.error_reply('MATCH IS ALREADY LIVE')
end

--check if room has seats and optIns key has values
numOptIns = redis.call('hlen', rk.roomMatch)
seats = redis.call('zrangebylex', rk.roomName, '[taken:seat:', '[taken:seat:\xff')
if(not seats or #seats <= 0) then
	return redis.error_reply('INVALID ROOM')
end

--update global room ticker to keep room alive
redis.call('zadd',rk.tickRooms,currentTime+10000,clientRoomName)

--check if we can change to active state
if(numOptIns and numOptIns > 0) then
	--reuse
	numOptIns = 0
	--===================================================
	function string:split(sep)
		local sep, fields = sep or ":", {}
		local pattern = string.format("([^%s]+)", sep)
		self:gsub(pattern, function(c) fields[#fields+1] = c end)
		return fields
	end

	--===================================================

	--loop through optIn db, check if each user opted in is valid
	for x=1, #seats do
		local data = seats[x]:gsub("taken:seat:", ""):split(":")
		seat, session = data[1], data[2]
		seat = _tonumber(seat)
		session = _tostring(session)

		local optInData = seat and redis.call('hget', rk.roomMatch, seat) or false
		optInData = optInData and cjson.decode(optInData) or {}
		local matchSession = optInData.sessionId
		local isOptIn = matchSession and matchSession == session
		if(isOptIn) then
			numOptIns = numOptIns+1
			--used to create temp zset
			turnValues[#turnValues+1] = seat
		end
	end

	if(numOptIns > 0) then

		nextMatchId = redis.call('hget', rk.roomInfo, 'nextMatchId')
		--increment next matchId in case someone opts in during this time
		redis.call('lpush', rk.roomMatchList, rk.roomMatchList..":"..nextMatchId) --add nextId into match list

		--rename match 'opt in table' to :live for current match
		redis.call('rename', rk.roomMatch, rk.roomMatchLive)

		--add a 0 to top so it can send a signal (client side)
		turnValues[#turnValues+1] = 0

		--sort the turnValues by seat value
		table.sort(turnValues, compare)

		--create a :turn state-based table
		redis.call('rpush', rk.roomMatch..":turn", _unpack(turnValues))

		--Change match state to ACTIVE
		newMatchState = redis.call('rpoplpush', rk.roomMatchState, rk.roomMatchState)

		-- ACTIVE will give 1st player 30 seconds
		newTurnExpiration = currentTime+5000

		--update state, reset seat index and turn expiration
		redis.call('hmset', rk.roomInfo,
			'matchState', newMatchState,
			'matchTurn', _tonumber(redis.call('lindex', rk.roomMatchTurn, 0))
			'matchTurnStart', currentTime,
			'matchTurnExpire', newTurnExpiration
		)
		return redis.status_reply('ACTIVE')
	end
end

--just update the turn expiration
newTurnExpiration = currentTime+15000
redis.call('hset', rk.roomInfo,
	'matchTurnStart', currentTime,
	'matchTurnExpire', newTurnExpiration
)

return redis.status_reply('OPT_IN')
