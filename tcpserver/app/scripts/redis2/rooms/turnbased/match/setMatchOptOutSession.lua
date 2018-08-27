local _tonumber = tonumber

local clientRoomName 	= KEYS[1]
local sessionId 		= KEYS[2]
local rawParams			= ARGV[1]
local params 		= rawParams and cjson.decode(rawParams) or false
if(not params) then
	--assume opt out of all matches
end
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
	roomMatchList   = "rooms|"..KEYS[1].."|match",
}
local doesRoomExist, matchId, nextMatchId, prevMatchId, matchState
local turnExpiration, isOptInState
local optInSeats, optInData, optOutStatus

--check if room exists
doesRoomExist = redis.call('exists', rk.roomName) == 1
if(not doesRoomExist) then
	return redis.error_reply('NOT EXIST')
end

local function findSeat(sId, mId)
	--set keys
	rk.roomMatch = rk.roomMatchList..":"..mId
	rk.roomMatchSessions = rk.roomMatch..":sessions"
	return redis.call('hget', rk.roomMatchSessions, sId)
end

local function optOutByMatchId(mId)
	local seat = params.seat
	if(mId <= 0) then return false end

	--set keys
	rk.roomMatch = rk.roomMatchList..":"..mId
	rk.roomMatchLive = rk.roomMatch..":live"
	rk.roomMatchState = rk.roomMatch..":state"

	--simple check to see if match has already started/completed
	if(redis.call('exists', rk.roomMatchLive) == 1) then
		--match has already started/completed - can't opt out of that
		--TODO: send a message of some sort
		return false
	end

	--check prevMatchId flag as a precaution
	if(redis.call('hget', rk.roomInfo, 'prevMatchId') == mId) then
		--match has already started/completed - can't opt out of that
		--TODO: send a message of some sort
		return false
	end

	if(matchId == mId) then
		--current matchId also checks for matchState to be in OPT_IN
		matchState = redis.call('lindex', rk.roomMatchState, 0)
		isOptInState = matchState and matchState == "OPT_IN"
		if(not matchState) then	return false end
	end

	seat = not seat and findSeat(sessionId, mId)
	if(not seat) then return false end

	local seatData = redis.call('hget', rk.roomMatch, seat)
	seatData = seatData and cjson.decode(seatData)
	if(not seatData or not seatData.sessionId) then return false end
	if(seatData.sessionId ~= sessionId) then return false end
	redis.call('hdel', rk.roomMatch, seat)

	return true
end


matchId = _tonumber(redis.call('lindex', rk.roomMatchList, 0))
prevMatchId = _tonumber(redis.call('hget', rk.roomInfo, 'prevMatchId'))
nextMatchId = _tonumber(redis.call('hget', rk.roomInfo, 'nextMatchId'))
if(not matchId) then
	return redis.error_reply('INVALID MATCH')
end

--update to global room ticker with a grace period of 5 seconds
redis.call('zadd',rk.tickRooms,currentTime+5000,clientRoomName)

--check if passed in a matchId
if(params.matchId) then
	optOutStatus = optOutByMatchId(params.matchId)
else
	optOutStatus = optOutByMatchId(matchId) or optOutByMatchId(nextMatchId)
end

if(optOutStatus) then return redis.status_reply('OK') end
return redis.error_reply('NO SESSION')
