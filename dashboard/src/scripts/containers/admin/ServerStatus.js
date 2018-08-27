import React, { Component } from 'react'
import _ from 'lodash'
import * as reducers from '../../reducers'
import {connect} from 'react-redux'

import {joinRoom, leaveRoom} from '../../actions/websocketActions'
import Row from 'muicss/lib/react/row'
import Col from 'muicss/lib/react/col'
import Container from 'muicss/lib/react/container'
import Panel from 'muicss/lib/react/panel';
import moment from 'moment';

export class ServerStatus extends Component {

	constructor(props){
		super(props)
		this.state = {
			servers: {},
		}
		this.onMessageData = this.onMessageData.bind(this)
	}

	componentDidMount(){
		if(this.props.wsIsReady) this.props.joinRoom('_server:status')
	}

	componentDidUpdate(prevProps){
		if(!_.isEqual(prevProps.wsIsReady, this.props.wsIsReady) && this.props.wsIsReady){
			this.props.joinRoom('_server:status', this.onMessageData)
		}
	}

	componentWillUnmount(){
		if(this.props.wsIsReady) this.props.leaveRoom('_server:status')
	}

	onMessageData(event, message){
		const servers = _.clone(this.state.servers)
		servers[message.name] = message
		this.setState({servers})
	}

	createColRows(arr, keys){
		return arr.map((val, i) => (<Col key={i} md={4}>{`${keys[i]}: ${_.round(val, 2)}`}</Col>))
	}

	createColRowObj(obj){
		return _.map(obj, (val, key) => {
			return <Col key={key} md={4}>{`${key}: ${Math.round(val / 1024 / 1024 * 100) / 100} MB`}</Col>
		})
	}

	render() {
		return (
			<Container fluid={true}>
				<Row>
				{_.keys(this.state.servers).map((name, index) => {
					return (
						<Col key={name} md={4}>
							<Panel>
								<Container>
									<Row><Col><strong>{this.state.servers[name].name}</strong></Col></Row>
									<Row><Col>{'uptime:'}</Col><Col>{moment.duration(this.state.servers[name].uptime, 'milliseconds').humanize()}</Col></Row>
									<Row><Col>{'os free mem:'}</Col><Col>{Math.round(this.state.servers[name].freemem / 1024 / 1024 * 100) / 100} MB</Col></Row>
									<Row><Col>{'os total mem:'}</Col><Col>{Math.round(this.state.servers[name].totalmem / 1024 / 1024 * 100) / 100} MB</Col></Row>
									<Row>{this.createColRows(this.state.servers[name].loadavg, ['1 min', '10 min', '15 min'])}</Row>
									<Row>{this.createColRowObj(this.state.servers[name].processmem)}</Row>
								</Container>
							</Panel>
						</Col>
					)
				})}
				</Row>
			</Container>
		)
	}
}

const mapStateToProps = (state) => ({
	wsIsReady: reducers.wsIsReady(state),
})

const mapDispatchToProps = {
	joinRoom,
	leaveRoom
}

export default connect(mapStateToProps, mapDispatchToProps)(ServerStatus)
