import PropTypes from 'prop-types'
import React, {Component} from 'react'

import _isEmpty from 'lodash/isEmpty'
import _map from 'lodash/map'

import Panel from 'muicss/lib/react/panel'
import Button from 'muicss/lib/react/button'
import {Link} from 'react-router-dom'
import { connect } from 'react-redux'

import * as authActions from '../actions/apiAuthActions'

import * as reducers from '../reducers'

import {toast} from 'react-toastify'

class AdminToolbar extends Component {

	constructor(props){
		super(props)
		this.state = {
			hasError: false
		}
	}

	componentDidCatch(error, info) {
		this.setState({ hasError: true });
	}

	handleForceTokenRefresh(e){
		e.preventDefault();
		this.props.refresh({rtoken: this.props.refreshToken})
	}

	render() {
		return (
			<div>
				<div><Link to="/users" className={"mui-btn mui-btn--small mui-btn--primary mui-btn--flat"}>Edit A User</Link></div>
				<div><Link to="/server" className={"mui-btn mui-btn--small mui-btn--primary mui-btn--flat"}>Server Dashboard</Link></div>
				<div><Link to="/rooms" className={"mui-btn mui-btn--small mui-btn--primary mui-btn--flat"}>View Game Rooms</Link></div>
				<div><Button variant={"flat"} size={'small'} color={'primary'} onClick={(e) => this.handleForceTokenRefresh(e)}>Force Token Refresh</Button></div>
			</div>
		)
	}
}

AdminToolbar.defaultProps = {
	errors: [],
	processing: false
}
AdminToolbar.propTypes = {
	errors: PropTypes.array,
	refreshToken: PropTypes.string,
	refresh: PropTypes.func,
	processing: PropTypes.bool
}

const mapStateToProps = state => ({
	refreshToken: reducers.refreshToken(state),
	accessToken: reducers.accessToken(state),
	processing: reducers.apiBusy(state),
})

const mapDispatchToProps = {
	refresh: authActions.refresh,
}
export default connect(mapStateToProps, mapDispatchToProps)(AdminToolbar)
