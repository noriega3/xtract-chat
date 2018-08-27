import PropTypes from 'prop-types'
import React, {Component} from 'react'
import Reaptcha from 'reaptcha'
import {toast} from 'react-toastify'

import _ from 'lodash'

import Form from 'muicss/lib/react/form';
import Input from 'muicss/lib/react/input';
import Radio from 'muicss/lib/react/radio';
import Checkbox from 'muicss/lib/react/checkbox';

import Button from 'muicss/lib/react/button';
import Panel from 'muicss/lib/react/panel'

const getType = (props) => {
	const valids = ['email', 'facebook', 'deviceId']
	let index = _.indexOf(valids, _.get(props, 'autoFill.loginType'))
	return index >= 0 ? valids[index] : valids[0]
}
import {SITE_KEY} from '../constants'

class LoginForm extends Component {
	constructor(props) {
		super(props)
		this.state = {
			verified: false,
			loginType: getType(props),
			email: _.escape(_.get(props, 'autoFill.email','')),
			password: '',
			deviceId: _.escape(_.get(props, 'autoFill.deviceId','')),
			facebookId: _.escape(_.get(props, 'autoFill.facebookId','')),
			authToken: _.escape(_.get(props, 'autoFill.authToken','')),
			dashboardToken: _.escape(_.get(props, 'autoFill.dashboardToken',''))
		}
		this.state.useToken = this.state.authToken || _.isEqual(this.state.loginType, 'deviceId') || _.isEqual(this.state.loginType, 'facebook')
		this.handleSubmit = this.handleSubmit.bind(this)
		this.captcha = null
	}
	componentDidCatch(error, info) {
		// Display fallback UI
		this.setState({ hasError: true });
		// You can also log the error to an error reporting service
		console.log('captured error', error, info)
	}

	componentDidUpdate(prevProps){
		if(prevProps.errors !== this.props.errors && !_.isEmpty(this.props.errors)){
			if(this.props.errors.non_field_errors){
				toast(this.props.errors.non_field_errors, { autoClose: 15000 })
			}
		}
	}

	handleInputChange(event){
		const target = event.target
		const value = _.isEqual(target.type, 'checkbox') ? target.checked : target.value
		const name = target.name

		if(_.isEqual(name, 'loginType'))
			this.setState({[name]: value, useToken: _.isEqual(value, 'deviceId') || _.isEqual(value, 'facebook')})
		else
			this.setState({[name]: value})
	}
	sendSubmit(ev){
		console.log('send submit', ev)
		this.captcha.reset()

		let loginData = {
			loginType: this.state.loginType,
			authToken: this.state.useToken && !_.isEmpty(this.state.authToken) ? this.state.authToken : undefined,
			dashboardToken: this.state.useToken && !_.isEmpty(this.state.dashboardToken) ? this.state.dashboardToken : undefined
		}
		//only send the data we need to the submit function
		switch(loginData.loginType){
			case 'facebook':
				loginData.email = this.state.email
				loginData.facebookId = this.state.facebookId
				break
			case 'email':
				loginData.email = this.state.email
				loginData.password = this.state.password
				break
			case 'deviceId':
				loginData.deviceId = this.state.deviceId
				break
			default:
				//invalid loginType
				return
		}
		this.setState({verified: false}, () => this.props.onSubmit(loginData))
	}

	handleSubmit(ev){
		ev.preventDefault()
		if(this.state.verified)
			this.sendSubmit()
		else
			this.captcha.execute()
	}

	onVerified(ev){
		this.setState({verified: true}, this.sendSubmit)
	}

	render() {
		let tokenRequired = _.isEqual(this.state.loginType, 'deviceId') || _.isEqual(this.state.loginType, 'facebook')
		return (
			<Panel>
				<Form onSubmit={this.handleSubmit}>
					<Radio checked={_.isEqual(this.state.loginType, 'email')} name="loginType" label="Email/Password" value="email" onChange={this.handleInputChange.bind(this)}/>
					<Radio checked={_.isEqual(this.state.loginType, 'deviceId')} name="loginType" label="Device Id" value="deviceId" onChange={this.handleInputChange.bind(this)}/>
					<Radio checked={_.isEqual(this.state.loginType, 'facebook')} name="loginType" label="Facebook Id" value="facebook" onChange={this.handleInputChange.bind(this)}/>
					{(_.isEqual(this.state.loginType, 'email') || _.isEqual(this.state.loginType, 'facebook')) && (<Input name="email" label={"Email"} type="text" value={this.state.email} onChange={this.handleInputChange.bind(this)} autoComplete={"email"} floatingLabel required />)}
					{(_.isEqual(this.state.loginType, 'email')) && (<Input name="password" label={"Password"} type="password" value={this.state.password} onChange={this.handleInputChange.bind(this)} autoComplete={"password"} floatingLabel required />)}
					{(_.isEqual(this.state.loginType, 'deviceId')) && (<Input name="deviceId" label={"Device Id"} type="text" value={this.state.deviceId} onChange={this.handleInputChange.bind(this)} floatingLabel required />)}
					{(_.isEqual(this.state.loginType, 'facebook')) && (<Input name="facebookId" label={"Facebook Id"} type="text" value={this.state.facebookId} onChange={this.handleInputChange.bind(this)} floatingLabel required />)}
					<Checkbox name="useToken" label="I have a security token" checked={this.state.useToken || tokenRequired} disabled={tokenRequired} onChange={this.handleInputChange.bind(this)} />
					{(this.state.useToken || tokenRequired) && (<Input name="authToken" label={"Security Token"} type="text" value={this.state.authToken} onChange={this.handleInputChange.bind(this)} floatingLabel required />)}
					{(this.state.useToken || tokenRequired) && (<Input name="dashboardToken" label={"Application Token"} type="text" value={this.state.dashboardToken} onChange={this.handleInputChange.bind(this)} floatingLabel required />)}
					<Reaptcha
						ref={e => this.captcha = e}
						sitekey={SITE_KEY}
						size="invisible"
						onVerify={(e) => this.onVerified(e)}
					/>
					<Button variant="raised" disabled={!this.state.loginType}>Login</Button>
				</Form>
			</Panel>
		)
	}
}

LoginForm.propTypes = {
	errors: PropTypes.object,
	disabled: PropTypes.bool,
	autoFill: PropTypes.shape({
		loginType: PropTypes.oneOf(['email', 'deviceId', 'facebook']),
		email: PropTypes.string,
		deviceId: PropTypes.string,
		facebookId: PropTypes.string,
		authToken: PropTypes.string,
		dashboardToken: PropTypes.string,
	}).isRequired,
	onSubmit: PropTypes.func,
}
export default LoginForm
