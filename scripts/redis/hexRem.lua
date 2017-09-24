local _stringformat = string.format
local _unpack = unpack

--create single hexastore
local createHexastore = function(subject,predicate,object)
    return {
        0,_stringformat("spo||%s||%s||%s",subject,predicate,object),
        0,_stringformat("sop||%s||%s||%s",subject,object,predicate),
        0,_stringformat("osp||%s||%s||%s",object,subject,predicate),
        0,_stringformat("ops||%s||%s||%s",object,predicate,subject),
        0,_stringformat("pos||%s||%s||%s",predicate,object,subject),
        0,_stringformat("pso||%s||%s||%s",predicate,subject,object)
    }
end

return redis.call('zadd',KEYS[1],_unpack(createHexastore(ARGV[1], ARGV[2], ARGV[3])))