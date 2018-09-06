import React, {Component, Fragment} from 'react'
import _ from 'lodash'
import WebClient from '../../pages/WebClient'
import WindowModal from '../templates/WindowModal'

import ServerLog from "./ServerLog.jsx"
import ServerQuickActions from './ServerQuickActions'
import SystemInfo from "./SystemInfo.jsx"

import Panel from 'muicss/lib/react/panel'
import Button from 'muicss/lib/react/button'
import Container from 'muicss/lib/react/container'
import Row from 'muicss/lib/react/row'
import Col from 'muicss/lib/react/col'
import Checkbox from 'muicss/lib/react/checkbox'
import moment from 'moment'
import { connect } from 'react-redux'

import {
	sendMessageIntent as sendMessage,
	clearMessages,
	sendReconnect,
	sendClose,
	toggleClearOnConnect,
	toggleLogOnConnect
} from '../../actions/wsDashboardActions'

import { toast } from 'react-toastify'

function bytesToSize(bytes) {
	var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
	if (bytes == 0) return '0 Byte';
	var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
	return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
}

class ServerInfo extends Component{
	constructor(props){
		super(props)
		this.state = {
			webClientModal: false
		}

		this.handleServerStart	= this.handleServerStart.bind(this)
		this.handleServerRestart	= this.handleServerRestart.bind(this)
		this.handleServerStop		= this.handleServerStop.bind(this)
		this.handleStopLogging = this.handleStopLogging.bind(this)
		this.handleStartLogging = this.handleStartLogging.bind(this)
		this.handleClearMessages = this.handleClearMessages.bind(this)
		this.handleRefreshStatus = this.handleRefreshStatus.bind(this)
		this.handleServerStartWatch = this.handleServerStartWatch.bind(this)
		this.handleServerStopWatch = this.handleServerStopWatch.bind(this)
		this.handleClearOnConnectToggle = this.handleClearOnConnectToggle.bind(this)
		this.handleLogOnConnectToggle = this.handleLogOnConnectToggle.bind(this)
	}

	componentDidUpdate(prevProps){
		if(!_.isEqual(prevProps.serverInfo.connected, this.props.serverInfo.connected) && this.props.serverInfo.connected){
			if(this.props.serverInfo.logOnConnect){
				this.handleStartLogging()
			}
		}
		if(!_.isEqual(prevProps.serverInfo.isLogging, this.props.serverInfo.isLogging) && this.props.serverInfo.connected && this.props.serverInfo.isLogging){
			if(this.props.serverInfo.clearOnConnect){
				this.handleClearMessages()
			}
		}
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
	handleClearOnConnectToggle(e){
		this.props.toggleClearOnConnect()
	}
	handleLogOnConnectToggle(e){
		this.props.toggleLogOnConnect()
	}
	handlePortalChange(){
		this.setState({webClientModal: !this.state.webClientModal})
	}

	showSimulatorClient(){
		if(!this.state.webClientModal) return null
		return <WindowModal path={'webclient'}><WebClient /></WindowModal>
	}

	render(){
		const {pm2Connect, pm2BusConnect, connected, servers, system, messages, clearOnConnect, tabIndex, matchSelected, isLogging, isRefreshing, matches, matchDetails, logOnConnect} = this.props.serverInfo
		const {sendClose, clearMessages, sendReconnect} = this.props
		return(
			<Container fluid={true}>
				<Row>
					<Col md={12}>
						<Button onClick={e => this.handlePortalChange(e)}>Launch Simulator</Button>
						{this.showSimulatorClient()}
						<div className="pull-right">
							<div>{pm2Connect && "PM2 Connected"} {pm2BusConnect && "PM2 Bus Connected"}</div>
							{(!connected) && (<Button color={'primary'} onClick={() => sendReconnect()}>Connect</Button>)}
							{(connected) && <Button color={'primary'} onClick={this.handleServerRestart}>Restart All Servers</Button>}
							{(connected) && <Button color={'primary'} onClick={this.handleRefreshStatus} disabled={isRefreshing}>Refresh</Button>}
							{(connected) && <Button color={'primary'} onClick={() => sendClose()} disabled={isRefreshing}>Disconnect</Button>}
						</div>
					</Col>
				</Row>
				<Row>
					<div className="mui--text-subhead">System Information</div>
					<Col md={12}>
						{(connected && system) && <SystemInfo data={system} />}
					</Col>
				</Row>
				<Row>
					<div className="mui--text-subhead">Server Information</div>
					{(servers.map((srv,i) => {
						return (<Col md={4} className="mui--text-dark" key={_.get(srv,'name')}>
							<Panel>
								<div className="mui--text-body2 mui--align-top">{_.startCase(_.get(srv,'name'))}</div>
								<div className={"mui--text-subhead"}>
									<div className={"mui--text-caption"}>{_.get(srv,'pm2_env.status')} for {moment(_.get(srv, 'pm2_env.pm_uptime')).toNow(true)}</div>
									<div className={"mui--text-caption"}>{bytesToSize(_.get(srv,'monit.memory'))}</div>
									<div className={"mui--align-bottom mui--text-right"}>
										{(_.get(srv,'pm2_env.status') === "stopped" && <Button size="small" color={'primary'} value={_.get(srv,'name')} variant={"flat"} disabled={!connected} onClick={this.handleServerStart}>Start</Button>)}
										{(_.get(srv,'pm2_env.status') !== "stopped" && <Button size="small" color={'primary'} value={_.get(srv,'name')} variant={"flat"} disabled={!connected}  onClick={this.handleServerRestart}>Restart</Button>)}
										{(_.get(srv,'pm2_env.status') === "online" && <Button size="small" color={'danger'} value={_.get(srv,'name')} variant={"flat"} disabled={!connected || _.get(srv,'name') === 'websocket-server'}  onClick={this.handleServerStop}>Stop</Button>)}
									</div>
								</div>
							</Panel>
						</Col>)
					}))}
				</Row>
				<Row>
					<div className="mui--text-subhead">Log Actions</div>
					<Col md={12}>
						<div className="pull-right">

							{(connected && isLogging) && (<Button color={'danger'} onClick={this.handleStopLogging}>Stop Logging</Button>)}
							{(connected && !isLogging) && (<Button color={'primary'} onClick={this.handleStartLogging}>Start Logging</Button>)}
							<Button color={'primary'} onClick={() => clearMessages()}>Clear Output</Button>
							<Checkbox name="clearOnConnect" label="Clear on Connect" checked={clearOnConnect} onChange={this.handleClearOnConnectToggle} />
							<Checkbox name="logOnConnect" label="Start Log on Connect" checked={logOnConnect} onChange={this.handleLogOnConnectToggle} />
						</div>
					</Col>
				</Row>
				<Row>
					<Col md={12}>
						<ServerLog messages={messages}/>
					</Col>
				</Row>
			</Container>)
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
	toggleLogOnConnect,
	toggleClearOnConnect,
}
export default connect(mapStateToProps, mapDispatchToProps)(ServerInfo)
