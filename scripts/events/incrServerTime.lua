local increaseBy = ARGV[1] or 1
return redis.call('incrby', 'serverTime', increaseBy)
