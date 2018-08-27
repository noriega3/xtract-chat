import React, { Component } from 'react'
import * as reducers from '../../reducers'
import {connect} from 'react-redux'

import wsAction from '../../actions/websocketActions'

export class JoinRoom extends Component {

	constructor(props){
		super(props)
	}

	componentDidMount(){
		wsAction(this.props.websocket, 'join', '_server:status')
	}

	render() {
		return (
			<div>
				Joining room..
			</div>
		)
	}
}

const mapStateToProps = (state) => ({
	isConnected: reducers.wsIsConnected(state),
})

export default connect(mapStateToProps)(JoinRoom)
