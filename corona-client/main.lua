display.setStatusBar( display.HiddenStatusBar )
require('overwrites')
local utility = require("utility")
local restAPI = require("api.rest")
local socket = require("api.socket")
--local coreSubscribe = require("coreSubscribe")
local widget = require("widget")
local list = require("util.list")
local json = require("json")
local button = require("components.button")

local viewHeight = 0
local scrollView = widget.newScrollView({
	x = display.contentCenterX,
	y = display.contentCenterY + 100,
	width = display.contentWidth-10,
	height = display.contentHeight-100,
	backgroundColor = { 1, 1, 1 },
	hideBackground = false,
	horizontalScrollDisabled = true
})
scrollView.anchorX = .5
scrollView.anchorY = 1
local myInfo = display.newText("", scrollView.x, scrollView.y, scrollView.width - 10, scrollView.height - 10, "Courier New", 8)
myInfo:setFillColor( 0, 0, 0 )
scrollView:insert( myInfo )

local myTitle = display.newText("", display.contentCenterX, 15, native.systemFont, 20)
myTitle:setFillColor( 0, 0, 0 )
scrollView:insert( myTitle )

local myText = display.newText("", display.contentCenterX, 45, native.systemFont, 14)
myText:setFillColor( 0, 0, 0 )
scrollView:insert( myText )

local messages = list.new()
local addMessage = function(text, ...)
	local options = ... or {}
	local group = display.newGroup()
	local tmp = display.newText({
		parent = group,
		text = text or 'err',
		font = "Courier New",
		width = scrollView.width-25,
		fontSize = 8,
		x = 0,
		y = viewHeight
	})
	if(options.error) then
		tmp:setFillColor(1,0,0)
	else
		tmp:setFillColor(0,0,0)
	end
	tmp.anchorX = 0
	tmp.anchorY = 0
	scrollView:insert(group)
	viewHeight = viewHeight + tmp.contentHeight
end
local processMessage = function(event)
	local params = list.popleft(messages,'EMPTY')
	if(params == 'EMPTY') then
		timer.pause(event.source)
		scrollView:scrollTo("bottom", {time=500})
		return
	end

	if (params.isError) then
		addMessage(json.prettify(params),{error=true})
	else
		params.response = (type(params.response) == 'table') and params.response or json.decode(params.response)
		addMessage(json.prettify(params))
	end
end
local throttler = timer.performWithDelay(1000, processMessage , -1)

--event loop to throttle messages coming in
local function networkListener( event )
	list.pushright(messages, event)
	if(throttler._removed) then timer.resume(throttler) end
end
Runtime:addEventListener('pubsub', networkListener)
button.new({
	label = "Connect",
	onRelease = function()
		socket.connect(function(err, res) print('connect finished | err ', err, '| res ', res) end)
	end
})

button.new({
	label = "Disconnect",
	onRelease = function()
		socket.disconnect(function(err, res) print('d/c finished | err ', err, '| res ', res) end)
	end
})

button.new({
	label = "Join Game Room",
	onRelease = function()
		socket.join('source:random', {invited=false, type='game', turn=false}, function(err, res) print('join finished | err ', err, '| res ', res) end)
	end
})

button.new({
	label = "Join Game w/Reserve",
	onRelease = function()
		socket.join('source:slots:enchantedForest', {
			path=true,
			invited=false,
			roomProps = {
				isGameRoom = true,
				isSystem = false,
				isTurnBased = false
			}
		}, function(err, res) print('join finished | err ', err, '| res ', res) end)
	end
})

button.new({
	label = "Leave Room",
	onRelease = function()
		socket.leave('source:enchantedForest:20', function(err, res) print('leave finished | err ', err, '| res ', res) end)
	end
})

-- Update the app layout on resize event.
local function onResize( event )
	-- Update title.
	myTitle.x = display.contentCenterX
	myText.x = display.contentCenterX

	-- Update response field background.
	scrollView.x = display.contentCenterX
	scrollView.y = display.contentCenterY + 30
	scrollView.width = display.contentWidth - 20
	scrollView.height = display.contentHeight - 80

	-- Update response field. This does not update cleanly, and needs to be recreated.
	local myInfoText = myInfo.text
	myInfo:removeSelf()
	myInfo = display.newText(myInfoText, scrollView.x, scrollView.y, scrollView.width - 10, scrollView.height - 10, "Courier New", 8)
	myInfo:setFillColor( 0, 0, 0 )
	scrollView:insert( myInfo )
end
Runtime:addEventListener( "resize", onResize )

-- On tvOS, we want to make sure we stay awake.
-- We also want to ensure that the menu button exits the app.
if system.getInfo( "platformName" ) == "tvOS" then
	system.activate( "controllerUserInteraction" )
	system.setIdleTimer( false )
end
