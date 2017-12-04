import React, {Component} from 'react'
import _ from 'lodash'

import Logger from "../components/Logger"
import MatchDetails from "../components/matches/matchDetails"
import MatchList from "../components/matches/matchList"

import Tabs from 'muicss/lib/react/tabs'
import Tab from 'muicss/lib/react/tab'
import Input from 'muicss/lib/react/input'
import Panel from 'muicss/lib/react/panel'
import Button from 'muicss/lib/react/button'
import Container from 'muicss/lib/react/container'
import Row from 'muicss/lib/react/row'
import Col from 'muicss/lib/react/col'
import moment from 'moment'

function parseJson(str){
	return _.attempt(JSON.parse.bind(null, str));
}

class Server extends Component {

	constructor(){
		super()
		this.state = {
			connected:false,
			isLogging: false,
			isRefreshing: true,
			statuses: [],
			messages: [],
			matches: [],
			matchSelected: '',
			matchDetails: {},
			tabIndex: 0
		}

		this.sendMessageIntent = this.sendMessageIntent.bind(this)
		this.handleWsReconnect	= this.handleWsReconnect.bind(this)
		this.handleServerStart	= this.handleServerStart.bind(this)
		this.handleServerRestart	= this.handleServerRestart.bind(this)
		this.handleServerStop		= this.handleServerStop.bind(this)
		this.handleStopLogging = this.handleStopLogging.bind(this)
		this.handleStartLogging = this.handleStartLogging.bind(this)
		this.handleClearMessages = this.handleClearMessages.bind(this)
		this.handleRefreshStatus = this.handleRefreshStatus.bind(this)
		this.onTabChange = this.onTabChange.bind(this)
		this.handleGetMatchDetails = this.handleGetMatchDetails.bind(this)
	}

	getServerStatus(){
		this.setState((prev) => ({...prev, isServerOnline: true}))
	}
	componentDidMount(){
		this.handleWsReconnect()
	}

	componentWillUnmount() {
		this.ws.close()
	}

	sendMessageIntent(intent, serverName){
		if(this.state.connected && this.ws){
			return this.ws.send(JSON.stringify({intent, serverName}))
		} else {
			return false
		}
	}

	handleWsReconnect(e){

		if(!this.state.connected){
			this.ws = new WebSocket('ws://xxxxx') //TODO: change ws
			this.ws.onopen = e => {
				this.ws.send(JSON.stringify({intent: "pm2status"}))
				this.setState({connected:true, messages:[]})
			}
			this.ws.onmessage = e => {

				const message = parseJson(e.data)
				let response = message.response
				switch(message.event){
					case 'log':
						response = _.attempt(JSON.parse.bind(null, _.get(response, 'data')))
						if(response){
							return this.setState((prev) => {
								let data = prev.messages
								data.unshift(response)

								return {...prev, connected: true, messages: data}
							})
						}
						break
					case 'pm2status':
						return this.setState((prev) => {
							return {...prev, statuses: response, isRefreshing: false}
						})
					case 'matchList':
						return this.setState({matches: response})
					case 'matchdetails':

						console.log(message)

						return this.setState({matchDetails: response})
					default:
						console.log('message data is', event, e.data)
						break
				}
			}
			this.ws.onerror = e => this.setState({ connected:false, error: 'WebSocket error' })
			this.ws.onclose = e => !e.wasClean && this.setState({ connected:false, statuses: [], error: `WebSocket error: ${e.code} ${e.reason}` })
		}
		this.getServerStatus()
	}
	handleStopLogging(e){
		if(this.state.connected && this.ws && this.state.isLogging){
			this.setState((prev) => ({...prev, isLogging: false}))
			this.ws.send(JSON.stringify({intent: 'stopLog'}))
		}
	}
	handleStartLogging(e){
		if(this.state.connected && this.ws && !this.state.isLogging){
			this.setState((prev) => ({...prev, isLogging: true}))
			this.ws.send(JSON.stringify({intent: 'startLog'}))
		}
	}
	handleClearMessages(e){
		this.setState((prev)=>({...prev, messages: []}))
	}

	handleServerStart(e){
		if(this.sendMessageIntent('start', _.get(e, 'currentTarget.value'))){
			this.setState((prev) => ({...prev, isLogging: false, tabIndex:0}))
		}
	}
	handleServerRestart(e){
		if(this.sendMessageIntent('restart', _.get(e, 'currentTarget.value'))){
			this.setState((prev) => ({...prev, isLogging: false, tabIndex:0}))
		}
	}
	handleServerStop(e){
		if(this.sendMessageIntent('stop', _.get(e, 'currentTarget.value'))){
			this.setState((prev) => ({...prev, isLogging: false, tabIndex:0}))
		}
	}
	handleRefreshStatus(e) {
		this.setState({isRefreshing: true, tabIndex: 0})
		this.sendMessageIntent('pm2status')
	}

	handleGetMatchDetails(matchSelected) {
		this.setState({matchSelected})
		if(this.state.connected && this.ws){
			return this.ws.send(JSON.stringify({intent: 'matchdetails', roomName: matchSelected}))
		} else {
			return false
		}
	}


	onTabChange(i, value, tab, ev){

		switch(value){
			case 'matchdetails':
				this.sendMessageIntent('matches')
				break
			case 'log':
				this.handleStartLogging()
				break
		}


		this.setState((prev)=>({...prev, tabIndex: i}))
	}

	render() {
		const {connected, statuses, messages, tabIndex, matchSelected, isLogging, isRefreshing, matches, matchDetails} = this.state
		return (
			<Panel>
				<Tabs defaultSelectedIndex={tabIndex || 0} onChange={this.onTabChange}>
					<Tab value="options" label="Status">
						<Panel>
							<Container fluid={true}>
								<Row>
									<Col md={12}>
										<Panel className="mui--text-dark mui--clearfix">
											<div className="mui--text-subhead">All Servers Actions</div>
											<div className="pull-left">
												{(!connected) && (<Button color={'primary'} onClick={this.handleWsReconnect}>Reconnect?</Button>)}
												{(connected) && <Button color={'primary'} onClick={this.handleServerRestart}>Restart All Servers</Button>}
{/*
												<Button color={'danger'} disabled={(!connected || !isServerOnline)} onClick={this.handleServerStop}>Stop All Servers</Button>
*/}
											</div>
											<div className="pull-right">
												<Button color={'primary'} disabled={!connected || isRefreshing} onClick={this.handleRefreshStatus}>Refresh Status</Button>
											</div>
										</Panel>
									</Col>
									{(statuses.map((srv,i) => {
										return (<Col md={4} className="mui--text-dark" key={_.get(srv,'name')}>
											<Panel>
												<div className="mui--text-title">{_.startCase(_.get(srv,'name'))}</div>
												<div className={"mui--text-subhead"}>
													{_.get(srv,'pm2_env.status')} for {moment(_.get(srv, 'pm2_env.pm_uptime')).toNow(true)}
													<div>
														{(_.get(srv,'pm2_env.status') === "stopped" && <Button color={'primary'} value={_.get(srv,'name')} disabled={!connected} onClick={this.handleServerStart}>Start</Button>)}
														{(_.get(srv,'pm2_env.status') !== "stopped" && <Button color={'primary'} value={_.get(srv,'name')} disabled={!connected}  onClick={this.handleServerRestart}>Restart</Button>)}
														{(_.get(srv,'pm2_env.status') === "online" && <Button color={'danger'} value={_.get(srv,'name')} disabled={!connected}  onClick={this.handleServerStop}>Stop</Button>)}
													</div>
												</div>
											</Panel>
										</Col>)
									}))}
								</Row>
							</Container>
						</Panel>
					</Tab>
					<Tab value="log" label="Log">
						{(connected && messages) ? (
							<Panel>
								<Container fluid={true}>
									<Row>
										<Col md={12}>
											<Panel>
												<div className="mui--text-subhead">Log Actions</div>
												<div>
													{(connected && isLogging) && (<Button color={'danger'} onClick={this.handleStopLogging}>Stop Logging</Button>)}
													{(connected && !isLogging) && (<Button color={'primary'} onClick={this.handleStartLogging}>Start Logging</Button>)}
													<Button color={'primary'} onClick={this.handleClearMessages}>Clear Output</Button>
												</div>
											</Panel>
										</Col>
									</Row>
									<Row>
										<Col md={12}>
											<Logger sendMessageIntent={this.sendMessageIntent} messages={messages} />
										</Col>
									</Row>
								</Container>
							</Panel>
						) : (<Panel><span>Not Connected</span></Panel>)}
					</Tab>
					<Tab value="matchdetails" label="Match Watcher">
						{(connected && tabIndex === 2) ? (
							<Panel>
								<Container fluid={true}>
									<Col md={4}>
										<div className="mui--text-subhead">Select a Room</div>
										<MatchList data={matches} selected={matchSelected} onSelect={this.handleGetMatchDetails} />
									</Col>
									<Col md={8}>
										<div className="mui--text-subhead">Match Details</div>
										<MatchDetails key={matchSelected} roomName={matchSelected} matchDetails={matchDetails} />
									</Col>
								</Container>
							</Panel>
						) : (<Panel><span>Not Connected</span></Panel>)}
					</Tab>
				</Tabs>
			</Panel>
		);
	}
}
export default Server
