local _tonumber = tonumber
local _tostring = tostring
local _unpack = unpack

local clientRoomName 	= KEYS[1]
local currentTime       = _tonumber(redis.call('get', 'serverTime'))
if(not currentTime) then
	return redis.error_reply('NO SERVERTIME')
end
local rk = {
	tickRooms      		= "tick|rooms",
	roomName       		= "rooms|"..KEYS[1],
	roomInfo       		= "rooms|"..KEYS[1].."|info",
	roomOptIns	 		= "rooms|"..KEYS[1].."|optIns",
	roomMatchState   	= "rooms|"..KEYS[1].."|matchState",
	roomTurnState 		= "rooms|"..KEYS[1].."|turnState",
}
local optIns, turnValues = {}, {}
local matchState, newMatchState, doesRoomExist, turnExpiration, newTurnExpiration
local seats,seat, session, numOptIns, optInSeats, nextMatchId

--check if room exists
doesRoomExist = redis.call('exists', rk.roomName) == 1
if(not doesRoomExist) then
	return redis.error_reply('NOT EXIST')
end

--check if room state is right
matchState = redis.call('lindex', rk.roomMatchState, 0)
if(not matchState or matchState ~= "OPT_IN") then
	return redis.error_reply('INVALID STATE')
end

--check if turn expiration is elapsed
turnExpiration = _tonumber(redis.call('hget', rk.roomInfo, 'turnExpireAt')) or -1
if(not turnExpiration or (turnExpiration > currentTime)) then
	return redis.status_reply('TURN NOT EXPIRED - '..matchState)
end

--check if optIns key exists
rk.roomOptInsMatch = redis.call('lindex', rk.roomOptIns, 0)
if(not rk.roomOptInsMatch) then
	return redis.error_reply('NO OPT INS')
end

--check if room has seats and optIns key has values
numOptIns = redis.call('hlen', rk.roomOptInsMatch)
seats = redis.call('zrangebylex', rk.roomName, '[taken:seat:', '[taken:seat:\xff')
if(not seats or #seats <= 0) then
	return redis.error_reply('INVALID ROOM')
end

--update global room ticker to keep room alive
redis.call('zadd',rk.tickRooms,currentTime+10000,clientRoomName)

--check if we can change to active state
if(numOptIns and numOptIns > 0) then
	optInSeats = redis.call('hvals', rk.roomOptInsMatch)

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

		local matchSession = seat and redis.call('hget', rk.roomOptInsMatch, seat) or false
		local isOptIn = matchSession and matchSession == session
		if(isOptIn) then
			numOptIns = numOptIns+1
			--used to create temp zset
			turnValues[#turnValues+1] = seat
		end
	end

	if(numOptIns > 0) then
		--increment next matchId in case someone opts in during this time
		nextMatchId = redis.call('hincrby', rk.roomInfo, "nextMatchId", 1)

		--add next optIn key name
		redis.call('lpush', rk.roomOptIns, rk.roomOptIns..":"..nextMatchId)

		rk.roomMatchOptInsActive = rk.roomOptInsMatch..":locked"

		--add :locked to optIn for current matchId
		redis.call('rename', rk.roomOptInsMatch, rk.roomMatchOptInsActive)

		--sort the turnValues by seat value
		local function compare(a,b)
			return a < b
		end
		table.sort(turnValues, compare)

		redis.call('del', rk.roomTurnState)

		redis.call('rpush', rk.roomTurnState, _unpack(turnValues))

		--change expiration if needed
		newMatchState = redis.call('rpoplpush', rk.roomMatchState, rk.roomMatchState)
		newTurnExpiration = currentTime+10000

		--update state, reset seat index and turn expiration
		return redis.call('hmset', rk.roomInfo,
			'matchState', newMatchState,
			'turnSeatIndex', _tonumber(redis.call('lindex', rk.roomTurnState, 0)),
			'turnStartAt', currentTime,
			'turnExpireAt', newTurnExpiration
		)

	end
end

--just update the turn expiration
newTurnExpiration = currentTime+15000
redis.call('hset', rk.roomInfo,
	'turnStartAt', currentTime,
	'turnExpireAt', newTurnExpiration
)

return redis.status_reply('OK')
