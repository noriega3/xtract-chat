import PropTypes from 'prop-types'
import React from 'react'
import _ from 'lodash'

import Panel from 'muicss/lib/react/panel';
import {connect} from 'react-redux'
import {toast, cssTransition} from 'react-toastify'
import * as reducers from '../reducers'
import {register} from '../actions/websocketActions'

const shouldRegisterUser = (props) => (!props.isRegistering && !props.isRegistered && props.isConnected && props.isAuthenticated && props.userId)

class UserWebSocket extends React.Component {
	constructor(props) {
		super(props)
		this.state = {}
	}

	componentDidMount(){
		if(shouldRegisterUser(this.props)) this.props.register(this.props.userId)
	}

	componentDidUpdate(prevProps){
		if(!_.isEqual(prevProps.lastError, this.props.lastError) && this.props.lastError){
			toast.error('Socket Error: '+this.props.lastError)
		}
		if(shouldRegisterUser(this.props)) this.props.register(this.props.userId)
	}

	render() {
		const color = this.props.isReady ? 'green' : this.props.isConnected ? (this.props.isRegistering || this.props.isRegistered) ? 'yellow' : 'grey-400' : 'red'
		const title = this.props.isReady ? 'Ready' : this.props.isConnected ? (this.props.isRegistering || this.props.isRegistered) ? 'Connecting' : 'Connected, not ready' : 'Disconnected'
		return (<Panel><i className={`fa fa-circle mui--color-${color}`} title={title} /> Socket Status</Panel>)
	}
}

UserWebSocket.propTypes = {
	userId: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.bool]),
	register: PropTypes.func,
	isConnected: PropTypes.bool,
	isRegistering: PropTypes.bool,
	isReady: PropTypes.bool,
	isRegistered: PropTypes.bool,
	lastError: PropTypes.string,
}

const mapStateToProps = (state) => ({
	userId: reducers.userId(state),
	isAuthenticated: reducers.isAuthenticated(state),
	isReady: reducers.wsIsReady(state),
	isConnected: reducers.wsIsConnected(state),
	isRegistered: reducers.wsIsRegistered(state),
	isRegistering: reducers.wsIsRegistering(state),
	lastError: reducers.wsLastError(state),
})
const mapDispatchToProps = {
	register
}

export default connect(mapStateToProps, mapDispatchToProps)(UserWebSocket)

