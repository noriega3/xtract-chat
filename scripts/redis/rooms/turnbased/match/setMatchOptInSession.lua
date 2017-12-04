local _tonumber			= tonumber

local clientRoomName 	= KEYS[1]
local sessionId 		= KEYS[2]
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
}
local optIns = {}
local doesRoomExist, gameInfo, nextMatchId, matchState
local turnExpiration, isOptInState
local session, seats,seat, numOptIns, optInSeats, newMatchState

--check if room exists
doesRoomExist = redis.call('exists', rk.roomName) == 1
if(not doesRoomExist) then
	return redis.error_reply('NOT EXIST')
end

--check if room state is right
matchState = redis.call('lindex', rk.roomMatchState, 0)
isOptInState = matchState and matchState == "OPT_IN"
if(not matchState) then
	return redis.error_reply('INVALID GAME STATE')
end

--update to global room ticker with a grace period of 5 seconds
redis.call('zadd',rk.tickRooms,currentTime+5000,clientRoomName)

--check optIns and current match state
rk.roomOptInsMatch = redis.call('lindex', rk.roomOptIns, 0)
if(not rk.roomOptInsMatch) then
	return redis.error_reply('NO OPT INS')
end

--check if turn expiration is elapsed for the match state (if opt_in)
turnExpiration = _tonumber(redis.call('hget', rk.roomInfo, 'turnExpireAt')) or -1
if((turnExpiration < currentTime) and matchState == "OPT_IN") then
	--turn is expired and is on OPT_IN state

	--retrieve the next match id
	nextMatchId = redis.call('hget', rk.roomInfo, 'nextMatchId')

	--set them to the next match id
	rk.roomOptInsMatch = rk.roomOptIns..":"..nextMatchId
end

--check if room has seats and optIns key has values
optInSeats = redis.call('hvals', rk.roomOptInsMatch)
seats = redis.call('zrangebylex', rk.roomName, '[taken:seat:', '[taken:seat:\xff')
if(not seats or #seats <= 0) then
	return redis.error_reply('INVALID ROOM')
end


numOptIns = 0

--check if session already is opted in
--===================================================
local function validateOptIn(sid)
	local isValid = false
	for o=1, #optInSeats do
		if(optInSeats[o]==sid) then
			isValid = true
		end
	end
	return isValid
end
--===================================================

--loop through optIn db, check if each user opted in is valid
for x=1, #seats do
	seat, session = seats[x]:match("taken:seat:(%d+):(.+)")
	seat = _tonumber(seat)
	local isOptIn = validateOptIn(session)
	local isValidSession = (_tonumber(redis.call('zscore', 'tick|sessions', session)+60000) > currentTime) --5 sec grace
	local isThisSession = isValidSession and session == sessionId

	--opt in this session if this is the sessionId requesting it
	if(isThisSession and not isOptIn) then
		isOptIn = true
		redis.call('hset', rk.roomOptInsMatch, seat, session)
	end

	optIns[#optIns+1] = {
		optIn 		= isValidSession and isOptIn,
		seat 		= seat,
		sessionId 	= session,
	}

	if(isOptIn) then
		numOptIns = numOptIns+1
	end
end

if(numOptIns >= 4) then
	return redis.status_reply('FULL')
end



return redis.status_reply('OK')
