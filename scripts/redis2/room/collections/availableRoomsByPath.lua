local _tonumber = tonumber
local _tostring = tostring
local _type = type

--VALIDATION
if(not KEYS[1] or not _tostring(KEYS[1])) then return redis.error_reply('NO ROOM KEY') end
if(ARGV[1] and not cjson.decode(ARGV[1])) then return redis.error_reply('INVALID PARAMS DATA') end

--"GLOBALS" to this module
local availableRooms = {}
local minReturn = 10

--========================================================================
-- UTILITY Functions
--========================================================================

local findRoomsByPriority = function(arr, priority, roomPath, limit)
	if(_type(roomPath)~='string') then return false end
	if(_type(arr)~='table') then arr = {} end --default to empty array
	if(_type(priority)~='string') then priority = 'high' end --default to high
	if(_type(limit)~='number') then limit = 10 end --default to 10

	local searchTermPriority = priority..'::'
	local searchTerm = searchTermPriority..roomPath
	local response

	if(redis.call('zlexcount', 'open|rooms', '['..searchTerm, '['..searchTerm..'\xff') > 0) then
		response = redis.call('zrangebylex', 'open|rooms', '['..searchTerm, '['..searchTerm..'\xff', 'LIMIT', 0, limit)
		if(not response) then return arr end

		for x=1, #response do
			arr[#arr+1] = response[x]:sub(#searchTermPriority+1)
		end
		return arr
	end
end

--========================================================================
-- CORE Functions
--========================================================================

--high priority takes precedence
findRoomsByPriority(availableRooms, 'rhigh', KEYS[1], minReturn)

if(#availableRooms >= minReturn) then
	return availableRooms
end

--no high priority rooms or under minimum then add additional low priority rooms
minReturn = minReturn-#availableRooms
findRoomsByPriority(availableRooms, 'rlow', KEYS[1], minReturn)

return availableRooms
