local _tonumber = tonumber

--VALIDATION
if(not _tonumber(ARGV[1])) then return redis.error_reply('INVALID MIN TICK VALUE') end
if(not _tonumber(ARGV[2])) then return redis.error_reply('INVALID MAX TICK VALUE') end
if(ARGV[3] and not _tonumber(ARGV[3])) then return redis.error_reply('INVALID LIMIT VALUE') end

--========================================================================
-- CORE Functions
--========================================================================

local minIdleTime 	= _tonumber(ARGV[1])
local maxIdleTime 	= _tonumber(ARGV[2])
local limit 		= _tonumber(ARGV[3]) or 25

return redis.call('zrangebyscore','tick|rooms', '('..minIdleTime, maxIdleTime, 'LIMIT', 0, limit)
