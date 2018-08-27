local msg = {}
local _sessionId

return {
    new = function(sessionId) _sessionId = sessionId end
}

function msg.confirmInit(eventId, initEventId)
    return {
        intent="confirmInit",
        sessionId=_sessionId,
        params={
            eventId = eventId,
            initEventId = initEventId
        }
    }

end


