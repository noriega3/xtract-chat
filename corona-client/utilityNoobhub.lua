local _type = type
local string = string
local _ipairs = ipairs
local _osdate = os.date
local _ostime = os.time
local _osdifftime = os.difftime
local _mathceil = math.ceil
local _mathfloor = math.floor
local socket = require("socket")
local json = require("json")
local composer = require("composer")
local clientVersion = require("configNetwork").clientVersion
local jwt = require('util.jwt')

local isDebug = true
local print = isDebug and Runtime._G.print or function() end
composer.setVariable("pubSubRoomLatency",-1)
--[[ implementation					-- from gamesparks
 on __init__						-- We send a packet with our client’s local timestamp to the server.
 from server 						-- The server takes this timestamp and adds new data with their own local time to a packet, and sends this back to the original sender.
 roundTripTime						-- The client receives this packet and compares their original sent time to their current time to get the round-trip time.
 clientLatency						-- Half the round-trip calculates the latency.
 serverDelta				 		-- Subtract the server-time from the client’s local time to get the difference between server’s time and client’s time (that is: serverDelta).
 trueTime							-- We can then use the serverDelta plus the latency to find and adjust any time coming from the server to what it is when we received it, therefore syncing all clients to the same time.
]]
local console = { log = print}

local function hasSessionId(self)
    return type(self._sessionId) == 'string' and (#self._sessionId > 10) --and has at least 10 chars in there.
end

local function disconnect(self, disconnectType, cb)
    disconnectType = disconnectType or 'unknown'
    cb = cb or function() end

    if self.sock then
        self.sock:close()
    end
    self.sock = nil
    self.buffer = ''
    self.startConnection = nil

    if(disconnectType) then
        local room = "Server"
        if(	disconnectType == "closed" and composer.getVariable('playerIdleTime') and composer.getVariable('playerIdleTime') > 0 and not composer.getVariable('isGameIdle')) then
            room = nil
        end
    end

    self.paused = true
    self.state = "init"
    cb(nil, true)
end

local function connect(self, params, cb)
    params = params or {}
    local instance = self
    local hadSocket = false

    if(not params.forced and instance.state ~= "init" and instance.state == "connecting") then cb('SOCKET INVALID STATE'); return false end

    --disconnect any existing sockets and then connect
    if(instance.sock) then
        hadSocket = true
        instance:disconnect('init', function() connect(self, params,cb) end)
        instance = nil
        return false
    end

    instance.paused = false

    local connectStatus = socket.protect(function()
        local serverIP = instance.server
        local serverPort = instance.port
        local isValid = true
        local token

        instance.state = "connecting"
        instance.startConnection = system.getTimer()

        cb(nil, {status="CONNECTING", message="Preparing..", timeout=5000})

        -- connect somewhere
        local client = socket.try(socket.tcp())
        --todo: this may need to be adjusted depending on how much lag could be caused on reconnection.
        socket.try(client:settimeout(10000,'t')) --set to 4000 miliseconds for overall timeout (t)
        socket.try(client:settimeout(100,'b')) --set to 100 miliseconds for blocking timeout (b)
        -- create a try function that closes 'client' on error
        local try = socket.newtry(function(err)

            client:close()

            if(instance) then
                instance:disconnect('reconnect')
            end

            isValid = false

            cb('CONNECT FAIL')

        end)

        try(client:connect(serverIP, serverPort))
        try(client:setoption('tcp-nodelay', true))
        try(client:setoption('keepalive', true))
        try(client:setoption('reuseaddr', true))
        try(client:settimeout(0,'b'))
        local _, output = try(socket.select(nil,{ client }, 4))

        instance.needHandshake = true --handshake it

        --v1, theres no way to verify the init was recieved, processed, and sent back
        for i,v in _ipairs(output) do
            --set delay to 0 to not be blocking anymore.
            --add client timestamp
            params.clientTime = socket.gettime()

            --set token to verify authenticity
            token = jwt.encode(params, 'lasjdflkasdfjkasdjfl') --TODO: use user id or user auth for first init
            params.jwt = token

            print('token is', token)
            cb(nil, {status="CONNECTED", message="Sending..", timeout=5000})

            self._callbacks[token] = cb

            try(v:send("__INIT__"..json.encode(params).."__ENDINIT__"));
        end

        instance.sock = client

        return isValid

    end)
    local status = connectStatus()
    status = _type(status) == "boolean" and status or false
    return status
end

local function publish(self, message, cb, attempts)
    local token, send_result, send_resp, num_bytes
    cb = cb or function() end
    attempts = attempts and attempts or 0

    if(not hasSessionId(self)) then cb('NO SESSION'); return false end

    if(attempts > 0) then print('[RETRY ATTEMPT] #', attempts) end --print attempt number
    if(attempts >= 5) then cb('MAX ATTEMPTS FAILURE'); return false end --check max attempts
    if (not self.sock) then cb('SOCKET DISCONNECTED'); return false end --check socket exists

    if(not message.sessionId) then message.sessionId = self._sessionId end    --add current sessionId if not passed in
    if(message.params) then message.params.clientTime = socket.gettime() end    --add client time to sync if has 'params' field

    token = jwt.encode(message, message.sessionId) --set token to verify authenticity

    print('token publish is', token, 'for publish', message)
    message.jwt = token
    self._callbacks[token] = cb    --use token to also figure out the callback to call when server sends a response back

    send_result, send_resp, num_bytes = self.sock:send("__JSON__START__"..json.encode(message).."__JSON__END__") --send message

    if(not send_result or send_result == 0) then

        print("Server publish error: "..message..'  sent '..num_bytes..' bytes')

        return publish(self,message,cb, attempts+1) --retry
    end
    return send_result and send_result > 0
end

local function destroy(self)
    self:disconnect('destroyed')

    if(self.responseHandler) then
        timer.cancel(self.responseHandler)
        self.responseHandler = nil
    end
    self = nil
end

local function clientError(error)
    return {

    }
end

local receiving = false
local function enterFrame(self, event)
    if(composer.getVariable("isExiting") or receiving) then return end

    if(self and self.paused) then return end

    --check for init timeout
    if(self.state == "connecting" and (self.startConnection and (system.getTimer() - self.startConnection) > 320000)) then
        print('TIMED OUT WHILE CONNECTING')
        self.state = 'fail'
        Runtime:dispatchEvent({name = "rawServerResponse", phase = "error", response = { error = "Problem with connecting to server" }})
        if(self.callback) then self.callback({ error = "Problem with connecting to server"}) end
        receiving = false
        self:disconnect('timeout')
        return
    end


    receiving = true
    local input,output = socket.select({ self.sock },nil, 0) -- this is a way not to block runtime while reading socket. zero timeout does the trick

    for i,v in _ipairs(input) do

        local got_something_new = false
        while true  do
            local skt, e, p = v:receive()
            if (skt) then  self.buffer = self.buffer .. skt;  got_something_new=true;  end
            if (p) then  self.buffer = self.buffer .. p;  got_something_new=true;  end
            if (not skt or e) then
                if(e and e == "closed") then self:disconnect('closed') end
                break
            end
        end -- /while-do

        -- now, checking if a message is present in buffer...
        while got_something_new do  --  this is for a case of several messages stocker in the buffer
            local start = string.find(self.buffer,'__JSON__START__')
            local finish = string.find(self.buffer,'__JSON__END__')
            if (start and finish) then -- found a message!
                local message = string.sub(self.buffer, start+15, finish-1)
                self.buffer = string.sub(self.buffer, 1, start-1)  ..   string.sub(self.buffer, finish + 13 ) -- cutting our message from buffer
                local data = json.decode(message)

                if(data) then

                    local req = data.req
                    local jwt = data.jwt
                    local room = data.room
                    local phase = data.phase
                    local serverTime = data.serverTime and tonumber(data.serverTime) or false
                    local response = data.response
                    local clientTime = (response and response.clientTime) and tonumber(response.clientTime) or false

                    if(not serverTime) then
                        if(clientVersion > 1) then
                            print('WARNING: invalid server time')
                        end
                        serverTime = -1
                    end

                    --account for serverDelta and latency

                    if(clientTime) then

                        --update the latency and serverDelta
                        print('response update latency serverDelta')
                        print('response.clienttime', socket.gettime(), response.clientTime, socket.gettime()-response.clientTime)
                        self.roundTripTime = socket.gettime() - response.clientTime
                        self.latency = self.roundTripTime*.5 --half rtt is the latency
                        --convert time to seconds from server (miliseconds)
                        self.serverDelta = socket.gettime() - serverTime

                        composer.setVariable('serverDelta', self.serverDelta)
                        composer.setVariable('latency', self.latency)

                        composer.setVariable("pubSubRoomLatency", _mathceil(self.latency * 1000))

                        print('latency', self.latency)
                        print('serverDelta', self.serverDelta)
                        print('roundTripTime', self.roundTripTime)

                    end

                    local adjustedTime = serverTime + self.serverDelta + self.latency

                    if(adjustedTime > socket.gettime()) then
                        --possible out of sync
                        print('adjustedTime', adjustedTime)
                        print('serverTime', serverTime)
                        print('socketTime', socket.gettime())
                    end

                    if(phase and phase == 'init') then

                        print(data)
                        self.state = "connected"
                        self._sessionId = response.sessionId
                    end

                    self.state = (phase and phase == "init") and "connected" or self.state

                    local serverMsg = {
                        name = self.eventName,
                        room = room,
                        phase = phase,
                        rawTime = adjustedTime,
                        time = _mathfloor(adjustedTime),
                        response = response
                    }


                    if(req and self._callbacks[req]) then
                        if(data.error) then
                            self._callbacks[req](data.error, serverMsg)
                        else
                            self._callbacks[req](nil, serverMsg)
                        end
                        self._callbacks[req] = nil
                    end
                    self.callback(data)
                end
                self.callback({error = 'no message'})
            else
                break
            end
        end -- /while-do
    end -- / for-do
    receiving = false
end -- /enterFrame

local function checkIfActive(self, timeout)
    local instance = self
    local input, output = socket.select(nil,{ instance.sock }, 0.5)
    return input,output

end

local Server = {

    new = function(params) -- constructor method
        params = params or {}
        if (not params.server  or not  params.port) then
            print("Server requires server and port to be specified");
            return false
        end

        local instance = {}
        instance.needHandshake = false
        instance.state = "init"
        instance.buffer = ''
        instance.server =  params.server
        instance.port = params.port
        instance.latency = 0
        instance.roundTripTime = 0
        instance.serverDelta = 0
        instance.eventName = params.eventName or "rawServerResponse"
        instance._callbacks = {}
        instance.callback = params.callback
        instance.enterFrame = enterFrame
        instance.connect = connect
        instance.publish = publish
        instance.destroy = destroy
        instance.disconnect = disconnect
        instance.checkIfActive = checkIfActive

        local onResponse = function(event)
            if(not instance or not instance.enterFrame) then event.source = nil end
            instance:enterFrame(event)
        end
        instance.responseHandler = timer.performWithDelay(5,onResponse,-1)
        return instance
    end -- /new
}

return Server
