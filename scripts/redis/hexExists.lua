-- KEYS[1] spo or some combo of it
-- KEYS[2] spo or some combo of it
-- KEYS[3-5] subject/predicate/object
local result = redis.call('zscore', KEYS[1].."||"..KEYS[2].."||"..KEYS[3].."||"..KEYS[4])
return result and result == 0
