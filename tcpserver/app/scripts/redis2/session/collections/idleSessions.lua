local _tonumber = tonumber

--VALIDATION
if(not ARGV[1] or not _tonumber(ARGV[1])) then return redis.error_reply('NO NODE TIME KEY') end
if(ARGV[2] and not _tonumber(ARGV[2])) then return redis.error_reply('INVALID MAX IDLE VALUE') end
if(ARGV[3] and not _tonumber(ARGV[3])) then return redis.error_reply('INVALID LIMIT VALUE') end

--========================================================================
-- CORE Functions
--========================================================================

local nodeTime 		= _tonumber(ARGV[1])
local maxIdleTime 	= _tonumber(ARGV[2]) or 60000 --todo: settings based max idle
local limit 		= _tonumber(ARGV[3]) or 25
return redis.client('tick|sessions', '(0',nodeTime-maxIdleTime, 'LIMIT', 0, limit)
