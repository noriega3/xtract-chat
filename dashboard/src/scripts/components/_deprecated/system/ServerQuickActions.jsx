import React, {Component, Fragment} from 'react'
import _ from 'lodash'
import WebClient from '../../pages/WebClient'
import WindowModal from '../templates/WindowModal'

import ServerLog from "./ServerLog.jsx"
import SystemInfo from "./SystemInfo.jsx"

import Panel from 'muicss/lib/react/panel'
import Button from 'muicss/lib/react/button'
import Container from 'muicss/lib/react/container'
import Row from 'muicss/lib/react/row'
import Col from 'muicss/lib/react/col'
import moment from 'moment'
import { connect } from 'react-redux'

import {
	sendMessageIntent as sendMessage,
	clearMessages,
	sendReconnect,
	sendClose
} from '../../actions/wsDashboardActions'

import { toast } from 'react-toastify'

function bytesToSize(bytes) {
	var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
	if (bytes == 0) return '0 Byte';
	var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
	return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
}

class ServerQuickActions extends Component{
	constructor(props){
		super(props)
		this.state = {}

		this.handleServerStart	= this.handleServerStart.bind(this)
		this.handleServerRestart	= this.handleServerRestart.bind(this)
		this.handleServerStop		= this.handleServerStop.bind(this)
		this.handleStopLogging = this.handleStopLogging.bind(this)
		this.handleStartLogging = this.handleStartLogging.bind(this)
		this.handleClearMessages = this.handleClearMessages.bind(this)
		this.handleRefreshStatus = this.handleRefreshStatus.bind(this)
		this.handleServerStartWatch = this.handleServerStartWatch.bind(this)
		this.handleServerStopWatch = this.handleServerStopWatch.bind(this)
	}

	handleStopLogging(e){
		toast.success("Stopped Logging !", {
			position: toast.POSITION.TOP_CENTER
		});
		this.props.sendMessage('stopLog')
	}
	handleStartLogging(e){
		toast.success("Started Logging !", {
			position: toast.POSITION.TOP_CENTER
		});
		this.props.sendMessage('startLog')
	}
	handleClearMessages(e){
		this.props.clearMessages()
	}
	handleServerStart(e){
		this.props.sendMessage('start', {serverName: _.get(e, 'currentTarget.value')})
	}
	handleServerRestart(e){
		this.props.sendMessage('restart', {serverName: _.get(e, 'currentTarget.value')})
	}
	handleServerStartWatch(e){
		this.props.sendMessage('watch', {serverName: _.get(e, 'currentTarget.value')})
	}
	handleServerStopWatch(e){
		this.props.sendMessage('unwatch', {serverName: _.get(e, 'currentTarget.value')})
	}
	handleServerStop(e) {
		this.props.sendMessage('stop', {serverName: _.get(e, 'currentTarget.value')})
	}
	handleRefreshStatus(e) {
		this.props.sendMessage('refreshAllStatuses')
	}

	render(){
		const {pm2Connect, pm2BusConnect, connected, servers, system, messages, tabIndex, matchSelected, isLogging, isRefreshing, matches, matchDetails} = this.props.serverInfo
		const {sendClose, clearMessages, sendReconnect} = this.props
		return(	<div>
			<div>{pm2Connect && "PM2 Connected"} {pm2BusConnect && "PM2 Bus Connected"}</div>
			{(!connected) && (<Button color={'primary'} onClick={() => sendReconnect()}>Connect</Button>)}
			{(connected) && <Button color={'primary'} onClick={this.handleServerRestart}>Restart All Servers</Button>}
			{(connected) && <Button color={'primary'} onClick={this.handleServerRestart}>Restart Pubsub Server</Button>}
			{(connected) && <Button color={'primary'} onClick={this.handleServerRestart}>Restart HTTP Server</Button>}
		</div>)
	}
}

const mapStateToProps = state => {
	return ({
		serverInfo: state.serverInfo
	})
}

//Code to send to access and send to websocket
const mapDispatchToProps = {
	sendReconnect,
	sendMessage,
	sendClose,
	clearMessages,
}
export default connect(mapStateToProps, mapDispatchToProps)(ServerQuickActions)
