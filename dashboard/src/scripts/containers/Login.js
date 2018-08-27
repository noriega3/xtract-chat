import PropTypes from 'prop-types'
import React, {Component} from 'react'
import {Link, Redirect} from 'react-router-dom'
import { connect } from 'react-redux'

import _get from 'lodash/get'
import _isEmpty from 'lodash/isEmpty'
import _isEqual from 'lodash/isEqual'

import Panel from 'muicss/lib/react/panel'
import Container from 'muicss/lib/react/container'
import Col from 'muicss/lib/react/col'
import Row from 'muicss/lib/react/row'

import { toast } from 'react-toastify'
import {login as sendLogin} from '../actions/apiAuthActions'
import LoginForm from '../components/LoginForm'
import {authBusy, authErrors, isAuthenticated, isRefreshTokenExpired, refreshToken, didLogout} from '../reducers'

import queryString from 'query-string'
import _ from 'lodash'

class Login extends Component {

	constructor(props){
		super(props)
		this.state = {}
	}
/*	shouldComponentUpdate(nextProps){
		if(!_isEqual(nextProps.isAuthenticated, this.props.isAuthenticated))
			return true
		else if(!_isEqual(nextProps.isRefreshTokenExpired, this.props.isRefreshTokenExpired))
			return true
		else if(!_isEqual(nextProps.query, this.props.query))
			return true
		else if(!_isEqual(nextProps.errors, this.props.errors))
			return true
		else if(!_isEqual(nextProps.apiBusy, this.props.apiBusy))
			return true

		console.log(this.props, nextProps)
		return false
	}*/

	componentDidMount(){
		if(!this.props.isAuthenticated && this.props.isRefreshTokenExpired && this.refreshToken)
			toast.warn('Session Expired. Please login again')
		if(this.props.didLogout && !this.props.isAuthenticated){
			toast.success('Successfully logged out')
		}
	}

	render() {
		if(this.props.isAuthenticated && _isEmpty(this.props.errors)) {
			toast.success('Successfully logged in.')
			return (
				<Redirect to='/' />
			)
		} else {
			return (
				<Panel>
					{this.props.isRefreshTokenExpired && this.props.refreshToken && !this.props.isAuthenticated ? <Panel className="mui--bg-danger">Session Expired. Please Login Again.</Panel> : ''}
					{!_isEmpty(this.props.errors) ? <Panel className="mui--bg-danger mui--text-light-secondary"><i className={"fa fa-exclamation-triangle"} title={"Server Error. Please try again later."} /> {_get(this, 'props.errors.error', _get(this, 'props.errors.global_error.statusText', 'An unknown error occurred, please try again later.'))}</Panel> : ''}
					<Container>
						<Row>
							<Col md={7}>
								<h1>Privacy Center</h1>
								<Link to={'https://localhost/privacy.html'} target="_self">Privacy Policy</Link>
							</Col>
							<Col md={5}>
								<LoginForm autoFill={this.props.query} onSubmit={(e) => this.props.sendLogin(e)} disabled={this.props.apiBusy} />
							</Col>
						</Row>
					</Container>
				</Panel>
			);
		}
	}
}

Login.defaultProps = {
	query: {}
}
Login.propTypes = {
	sendLogin: PropTypes.func,
	isAuthenticated: PropTypes.bool,
	apiBusy: PropTypes.bool,
	didLogout: PropTypes.bool,
	query: PropTypes.object,
	errors: PropTypes.object
}

const mapStateToProps = state => ({
	errors: authErrors(state),
	apiBusy: authBusy(state),
	isAuthenticated: isAuthenticated(state),
	didLogout: didLogout(state),
	isRefreshTokenExpired: isRefreshTokenExpired(state),
	refreshToken: refreshToken(state),
	auth: state.auth,
	query: queryString.parse(state.router.location.search)
})

const mapDispatchToProps = {
	sendLogin
}
export default connect(mapStateToProps,mapDispatchToProps)(Login)
