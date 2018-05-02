local _type = type
local key               = KEYS[1]
local isExact		    = KEYS[2] == "true" --is exact(aka append delimiter at end
local relation          = KEYS[3] --some variation of sop (ie. sop poe pso..)
local searchTerm        = KEYS[4] --need at least once, so make it required as a key
local min               = '['..relation..'||'..searchTerm..'||'
local formattedResult   = {}
local max, searchVal, result, argType
local isSingle = #ARGV == 0
local delimiter 	= "||"
local newResult,from,delimFrom,delimTo

for x=1, #ARGV do
    argType = _type(ARGV[x])
    if(argType == "string" or argType == "number") then
        min = min..ARGV[x]..(isExact and delimiter or "")
    end
end
max         = min..'\xff' --add end
result      = redis.call('zrangebylex',key,min,max)

searchVal   = min:sub(2) --remove [ from above
--check if one result, that's the same val as search
if(result and #result == 1 and result[1] == searchVal) then
    return {ARGV[#ARGV-1], ARGV[#ARGV]}
end

searchVal 	= searchVal:gsub("%-", "%%-") --escape the hyphen from results
if(result) then
    for x=1, #result do
        newResult = result[x]:gsub(searchVal, "")
        if(isSingle) then
            from=1
            delimFrom, delimTo = newResult:find(delimiter, from)
            while delimFrom do
                formattedResult[#formattedResult+1] = newResult:sub(from, delimFrom-1)
                from = delimTo+1
                delimFrom,delimTo = newResult:find(delimiter,from)
            end
            formattedResult[#formattedResult+1] = newResult:sub(from)
        else
            from=1
            delimFrom, delimTo = newResult:find(delimiter, from)
            while delimFrom do
                formattedResult[#formattedResult+1] = newResult:sub(from, delimFrom-1)
                from = delimTo+1
                delimFrom,delimTo = newResult:find(delimiter,from)
            end
            formattedResult[#formattedResult+1] = newResult:sub(from)
            --formattedResult[x] = newResult
        end
    end
end
return formattedResult