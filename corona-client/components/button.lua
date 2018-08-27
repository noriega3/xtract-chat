local widget = require('widget')
local button = {}
local baseX = 65
local baseY = 355

function button.new(...)
    local options = ... or {}
    if(baseY > 355) then
        if(baseY > 500) then
            baseX = baseX + 100
            baseY = 355
        end
    end

    local tmp = widget.newButton({
        x = options.x or baseX,
        y = options.y or baseY,
        id = options.label,
        label = options.label,
        onRelease = options.onRelease,
        emboss = false,
        -- Properties for a rounded rectangle button
        shape = "roundedRect",
        fontSize=9,
        width=85,
        height=15,
        cornerRadius = 1,
        labelColor = { default={0,0,0,1}, over={1,0.1,0.7,0.4} },
        fillColor = { default={0,1,0,1}, over={1,0.1,0.7,0.4} },
        strokeColor = { default={0,1.4,0,1}, over={0.8,0.8,1,1} },
        strokeWidth = 2
    })
    tmp.anchorX = .5
    tmp.anchorY = .5
    baseY = baseY+25

    return tmp
end

return button
