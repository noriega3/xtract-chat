local msg = {}
local _sessionId

return {
    new = function(sessionId) _sessionId = sessionId end
}

function msg.event(eventId, initEventId)

end
