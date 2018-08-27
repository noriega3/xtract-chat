local _tonumber			= tonumber

local clientRoomName 	= KEYS[1]
local sessionId 		= KEYS[2]
local rawParams			= ARGV[1]
local params 		= rawParams and cjson.decode(rawParams) or false
if(not params) then
	return redis.error_reply('INVALID OPT IN PARAMETERS')
end
local currentTime       = _tonumber(redis.call('get', 'serverTime'))
if(not currentTime) then
	return redis.error_reply('NO SERVERTIME')
end
local rk = {
	tickRooms      	= "tick|rooms",
	roomName       	= "rooms|"..KEYS[1],
	roomInfo       	= "rooms|"..KEYS[1].."|info",
	roomMatchList   = "rooms|"..KEYS[1].."|match",
}
local optIns = {}
local doesRoomExist, gameInfo, nextMatchId, matchId, matchState
local turnExpiration, isOptInState
local session, seats,seat, numOptIns, optInSeats, newMatchState

--check if room exists
doesRoomExist = redis.call('exists', rk.roomName) == 1
if(not doesRoomExist) then
	return redis.error_reply('NOT EXIST')
end

--check if match list exists
if(redis.call('exists', rk.roomMatchList) == 0) then
	return redis.error_reply('NOT EXIST MATCH LIST')
end

--check if matchId exists
matchId = _tonumber(redis.call('lindex', rk.roomMatchList, 0))
if(not matchId) then
	return redis.error_reply('INVALID MATCH')
end

rk.roomMatch = rk.roomMatchList..":"..matchId
rk.roomMatchLive = rk.roomMatch..":live"
rk.roomMatchTurn = rk.roomMatch..":turn"
rk.roomMatchState = rk.roomMatch..":state"
rk.roomMatchSessions = rk.roomMatch..":sessions"

--check if room state is right (OPT_IN)
matchState = redis.call('lindex', rk.roomMatchState, 0)
isOptInState = matchState and matchState == "OPT_IN"
if(not matchState) then
	return redis.error_reply('INVALID STATE')
end

--check if match opt ins is not live
if(redis.call('exists', rk.roomMatchLive) == 1) then
	return redis.error_reply('MATCH IS ALREADY LIVE')
end

--check if room has seats and optIns key has values
seats = redis.call('zrangebylex', rk.roomName, '[taken:seat:', '[taken:seat:\xff')
if(not seats or #seats <= 0) then
	return redis.error_reply('INVALID ROOM')
end

--update to global room ticker with a grace period of 5 seconds
redis.call('zadd',rk.tickRooms,currentTime+5000,clientRoomName)

optInSeats = redis.call('hvals', rk.roomMatch)
numOptIns = 0

--check if session already is opted in and if we need to update params for opt in
--===================================================
local function validateOptIn(sid)
	local isValid = false
	local optInData
	for o=1, #optInSeats do
		optInData = cjson.decode(optInSeats[o])
		if(optInData and optInData.sessionId and optInData.sessionId==sid) then

			if(optInData.params ~= params) then
				--we want to update our params within existing optIn
				redis.call('hset', rk.roomMatch, seat, cjson.encode({
					sessionId=session,
					seat=seat,
					matchId=matchId,
					time=currentTime,
					seatProps=params
				}))
			end

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
		matchId=redis.call('lindex', rk.roomMatchList, 0)
		redis.call('hset', rk.roomMatch, seat, cjson.encode({
			sessionId=session,
			seat=seat,
			matchId=matchId,
			time=currentTime,
			seatProps=params

		}))
		--also add an association table by match
		redis.call('hset', rk.roomMatchSessions, seat, session )
	end

	if(isOptIn) then
		numOptIns = numOptIns+1
	end
end

if(numOptIns >= _tonumber(redis.call('hget', rk.roomInfo, 'maxSubscribers'))) then
	return redis.status_reply('FULL')
end

return redis.status_reply('OK')
