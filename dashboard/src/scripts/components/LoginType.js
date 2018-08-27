import PropTypes from 'prop-types'
import React, {Component} from 'react'

import _ from 'lodash'

import Form from 'muicss/lib/react/form';
import Input from 'muicss/lib/react/input';
import Radio from 'muicss/lib/react/radio';

import Button from 'muicss/lib/react/button';
import Panel from 'muicss/lib/react/panel'

export default class LoginType extends Component {
	state = {
		loginType: 'email',
	}
	handleInputChange = (event) => {
		const target = event.target,
			  value = target.type === 'checkbox' ? target.checked : target.value,
			  name = target.name
		this.setState({
			[name]: value
		});
	}
	handleSubmit = (event) => {
		event.preventDefault()
		this.props.onSubmit(this.state.username, this.state.password)
	}
	render() {
		const errors = this.props.errors || {}
		return (
			<Panel>
				{
					errors.non_field_errors?
						<Alert color="danger">
							{errors.non_field_errors}
						</Alert>:""
				}
				<Form onSubmit={this.handleSubmit}>
					<Radio name="loginType" label="Email/Password" defaultChecked={true} value="email" onChange={this.handleInputChange}/>
					<Radio name="loginType" label="Device Id" value="deviceId" onChange={this.handleInputChange}/>
					<Radio name="loginType" label="Facebook Id" value="facebook" onChange={this.handleInputChange}/>
					{(_.isEqual(this.state.loginType, 'email')) && (<Input name="email" label={"Email"} type="email" value={this.state.email} onChange={this.handleInputChange} autoComplete={"username"} floatingLabel required />)}
					{(_.isEqual(this.state.loginType, 'email')) && (<Input name="password" label={"Password"} type="password" value={this.state.password} onChange={this.handleInputChange} autoComplete={"current-password"} floatingLabel required />)}
					{(_.isEqual(this.state.loginType, 'deviceId')) && (<Input name="deviceId" label={"Device Id"} type="text" value={this.state.deviceId} onChange={this.handleInputChange} floatingLabel required />)}
					{(_.isEqual(this.state.loginType, 'facebook')) && (<Input name="facebook" label={"Facebook Id"} type="facebook" value={this.state.facebookId} onChange={this.handleInputChange} floatingLabel required />)}
					<Button variant="raised">Login</Button>
				</Form>
			</Panel>
		)
	}
}
