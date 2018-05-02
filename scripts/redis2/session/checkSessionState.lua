local _tostring = tostring
local _tonumber = tonumber

--VALIDATION
if(not KEYS[1] or not _tostring(KEYS[1])) then return redis.error_reply('NO SESSION KEY') end
if(not KEYS[2] or not _tonumber(KEYS[2])) then return redis.error_reply('NO NODE TIME KEY') end
if(ARGV[1] and not cjson.decode(ARGV[1])) then return redis.error_reply('NO VALID PARAMS') end

--========================================================================
-- UTILITY Functions
--========================================================================

--========================================================================
-- CORE Functions
--========================================================================
local sessionId         = KEYS[1]
local nodeTime			= KEYS[2]
local params            = ARGV[1] and cjson.decode(ARGV[1]) or {}
local skipInitCheck		= params.skipInitCheck
local isTest			= params.isTest

if(isTest) then return redis.status_reply('ONLINE') end

local rk = {
    tickSessions            = "tick|sessions",
    session                 = "sessions|"..KEYS[1],
    sessionSubs             = "sessions|"..KEYS[1].."|rooms",
}

--will return error if not existing
--update session or return error when doesnt exist
if(redis.call('zadd', rk.tickSessions, 'XX', 'CH', 'INCR', nodeTime, sessionId) == 0) then
	return redis.error_reply('NO SESSION')
end

--check if session has init-ed
if(not skipInitCheck and redis.call('hget', rk.session, 'initConfirm') ~= sessionId) then
	return redis.error_reply('SESSION NOT INIT')
end

if(redis.call('hget', rk.session, 'online') == '1') then
	return redis.status_reply('ONLINE')
else
	return redis.error_reply('OFFLINE')
end
