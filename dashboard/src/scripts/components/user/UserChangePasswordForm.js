import React, { Component } from 'react'
import PropTypes from 'prop-types'
import Reaptcha from 'reaptcha'

import Panel from 'muicss/lib/react/panel'
import Form from 'muicss/lib/react/form'
import Input from 'muicss/lib/react/input'
import Button from 'muicss/lib/react/button'
import _ from 'lodash'
import _isEmpty from 'lodash/isEmpty'
import _isEqual from 'lodash/isEqual'

import {SITE_KEY} from '../../constants'

export class UserChangePasswordForm extends Component{
	constructor(props){
		super(props)
		this.state = {
			validationError: '',
			password: '',
			nextPassword: '',
			nextPasswordConfirm: '',
			loaded: false
		}

		this.handleSubmit = this.handleSubmit.bind(this)
		this.captcha = null
	}

	onPassChange(ev){
		this.setState({validationError: '', password: ev.currentTarget.value})
	}

	onNextPassChange(ev){
		this.setState({validationError: '', nextPassword: ev.currentTarget.value})
	}

	onNextPassConfirmChange(ev){
		this.setState({validationError: '', nextPasswordConfirm: ev.currentTarget.value})
	}

	sendSubmit(ev){

		if(_isEqual(this.state.nextPassword, this.state.password)){
			this.setState({validationError: 'Your new password matches your old one. Please change.'})
			return
		}
		if(!_isEqual(this.state.nextPassword, this.state.nextPasswordConfirm)){
			return this.setState({validationError: 'New passwords do not match'})
		}

		console.log('pass state',this.state)
		this.captcha.reset()
		this.setState({verified: false}, () => this.props.onSubmit({
			current: this.state.password,
			next: this.state.nextPassword,
			nextConfirm: this.state.nextPasswordConfirm
		}))
	}

	submitDisabled() {
		return _isEqual(this.state.password, this.state.nextPassword) || this.props.processing || _isEmpty(this.state.nextPassword) || _isEmpty(this.state.nextPasswordConfirm)
	}

	handleValidationError(){
		if(_isEmpty(this.state.validationError)) return null
		return <Panel className="mui--text-danger">{this.state.validationError}</Panel>
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

	render(){
		return(
			<div>
				{this.handleValidationError()}
				<Form onSubmit={this.handleSubmit}>
					{this.props.showLegend && <legend>{this.props.hasCurrent ? 'Change Password' : 'Set Password'}</legend>}
					{this.props.hasCurrent && <Input onChange={(e) => this.onPassChange(e)} value={this.state.password} name={'password'} type={"password"} label={"Current Password"} autoComplete={'off'} required />}
					<Input onChange={(e)=>this.onNextPassChange(e)} pattern="[a-zA-Z0-9_-]{6,50}" title="must be alphanumeric in 6-50 chars" value={this.state.nextPassword} name={'nextPassword'} type={"password"} label={"New Password"} autoComplete={'off'} required/>
					<Input onChange={(e)=>this.onNextPassConfirmChange(e)} pattern="[a-zA-Z0-9_-]{6,50}" title="must be alphanumeric in 6-50 chars" value={this.state.nextPasswordConfirm} name={'nextPasswordConfirm'} type={"password"} label={"Confirm New Password"} autoComplete={'off'} required/>
					<Button color={"primary"} disabled={this.submitDisabled()}>{this.props.hasCurrent ? 'Change Password' : 'Set Password'}</Button>
					<Reaptcha
						ref={e => this.captcha = e}
						sitekey={SITE_KEY}
						size="invisible"
						onVerify={(e) => this.onVerified(e)}
					/>
				</Form>
			</div>
		)
	}
}

UserChangePasswordForm.defaultProps = {
	showLegend: true,
	processing: false,
	onSubmit: () => {}
}

UserChangePasswordForm.propTypes = {
	hasCurrent:PropTypes.bool,
	processing:PropTypes.bool,
	onSubmit: PropTypes.func,
	showLegend: PropTypes.bool
}

export default UserChangePasswordForm
