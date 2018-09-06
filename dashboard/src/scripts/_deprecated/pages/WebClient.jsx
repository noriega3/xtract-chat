import React, {Component} from 'react'
import _ from 'lodash'
import {sendConnect, sendClose, sendReconnect, sendMessage, sendConfirmInit, sendConfirmEventId} from '../actions/wsSimulatorActions'
import {connect} from 'react-redux'
import ServerQuickActions from '../components/system/ServerQuickActions'
import Chat from '../components/webClient/Chat'
import ConnectionDetails from '../components/webClient/ConnectionDetails'

import ConnectionLog from "../components/webClient/ConnectionLog.jsx"
import SendMessageLog from "../components/webClient/SendMessageLog.jsx"

import Panel from 'muicss/lib/react/panel'
import Button from 'muicss/lib/react/button'
import Textarea from 'muicss/lib/react/textarea'

import TogglePanel from "../components/templates/TogglePanel"

import UserMessageInit from "../components/webClient/msgTypes/UserMessageInit"
import UserJsonGenerator from "../components/webClient/msgTypes/UserJsonGenerator";
import {WS_REQ_CONNECT} from '../middleware/websocket'
import MessageGenerator from './MessageGenerator'

function parseJson(str){
	return _.attempt(JSON.parse.bind(null, str));
}
function isJSON(str) {
	return !_.isError(_.attempt(JSON.parse, str));
}
/***
 * Connects a user to the pubsub server over web
 */
class WebClient extends Component {

	constructor(){
		super()
		this.state = {
			autoConfirmEventId: true,
			onConnectSendInitReq: true,
			autoConfirmInit: true,
			pendingMessage: "",
		}

		this.handlePublishMessage	= this.handlePublishMessage.bind(this)
	}

	componentDidMount(){
		const {sendConnect} = this.props
		document.title = "Web Client Simulator"
		sendConnect()
	}

	componentWillUnmount() {
		sendClose()
	}

	componentDidUpdate(prevProps){
		const {autoConfirmEventId, onConnectSendInitReq, autoConfirmInit} = this.state
		const {sendMessage, sendConfirmInit} = this.props
		const {initRequest, sessionId, isInited, connected, lastEventId, initEventId} = this.props.client

		//check if we need to reconnect when initRequest changes but server is not connected
		if(!_.isEqual(prevProps.client.initRequest, initRequest) && !connected){
			return sendReconnect()
		}

		//now that we've updated, check if we need to send the initRequest
		if(onConnectSendInitReq && !_.isEqual(prevProps.client.connected, connected) && _.isEqual(connected, true) && !_.isEmpty(initRequest)){
			sendMessage(initRequest)
		}

		//now that we've updated, check if we need to send the initConfirm
		//TODO: use last message along with comparing sessionId
		if(autoConfirmInit && !_.isEqual(prevProps.client.sessionId, sessionId) && _.isEqual(isInited, false) && initEventId){
			sendConfirmInit(sessionId, initEventId)
		}

		//check if we need to automatically send a eventId confirmation
		if(autoConfirmEventId && !_.isEqual(prevProps.client.lastEventId, lastEventId)){
			sendConfirmEventId(sessionId, lastEventId)
		}
	}

	handlePublishMessage(rawMsg, rawJson){
		const {connecting, connected, initRequest, sessionSubList, messagesRec, messagesSent, sending, selectedRoom, lastMessageSent, lastInitMessage, lastInitTemplateSet, lastTemplateSet, showRoomSelection} = this.props.client
		let eventId
		const json = parseJson(rawJson)
		let formatted = _.replace(rawMsg, '"**SESSIONID**"', `"${_.get(this, 'props.client.sessionId', '**SESSIONID**')}"`)
		formatted = _.replace(formatted, '"**USERID**"', `"${_.get(this, 'props.client.userId', '**USERID**')}"`)
		if(json){
			eventId = `${_.get(this,'props.client.userId')}|${_.get(parseJson(rawJson),'intent')}|${Date.now()}`
			formatted = _.replace(formatted, '"**EVENTID**"', `"${eventId}"`)
		}
		this.setState({pendingMessage: formatted})
		this.props.sendMessage(formatted, rawJson)
	}

	render() {
		const {sessionId, connecting, connected, initRequest, sessionSubList, messagesRec, messagesSent, sending, selectedRoom, lastMessageSent, lastInitMessage, lastInitTemplateSet, lastTemplateSet, showRoomSelection} = this.props.client
		const {sendClose, sendReconnect} = this.props
		return (
			<div>
				<Panel>
					<ServerQuickActions />
				</Panel>
				{connected && <Panel>
					<Button color="danger" onClick={()=>sendClose()} disabled={connecting}>Disconnect</Button>
				</Panel>}
				{(!connected && initRequest) && <Panel><Button color="danger" onClick={e => sendReconnect()}>Reconnect</Button></Panel>}
				<TogglePanel title={"Connection Details"}>
						<ConnectionDetails />
				</TogglePanel>
				<TogglePanel title={"Send Options"}>
					<MessageGenerator onSubmit={this.handlePublishMessage} disabled={connecting || sending} />
				</TogglePanel>
				<TogglePanel title={"Send Chat"}>
					<Chat />
				</TogglePanel>
				<TogglePanel title={"Sending Log"}>
					<SendMessageLog messages={messagesSent}/>
				</TogglePanel>
				<TogglePanel title={"Connection Log"}>
					<ConnectionLog messages={messagesRec}/>
				</TogglePanel>
			</div>
		);
	}
}

//Code to associate redux 'state' to props of above component
const mapStateToProps = state => {
	return ({
		client: state.webClient
	})
}

//Code to send to access and send to websocket (web simulator)
const mapDispatchToProps = {
	sendConnect,
	sendReconnect,
	sendClose,
	sendMessage,
	sendConfirmInit
}
export default connect(mapStateToProps, mapDispatchToProps)(WebClient)
