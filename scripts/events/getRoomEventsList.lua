local rk = {
    roomInfo                = "rooms|"..KEYS[2].."|info"
}
return redis.call('hget', rk.roomInfo)
