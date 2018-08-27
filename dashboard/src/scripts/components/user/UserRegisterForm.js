import React, { Component } from 'react'
import PropTypes from 'prop-types'
import Reaptcha from 'reaptcha'

import _ from 'lodash'

import Panel from 'muicss/lib/react/panel'
import Form from 'muicss/lib/react/form'
import Input from 'muicss/lib/react/input'
import Button from 'muicss/lib/react/button'
import _isEmpty from 'lodash/isEmpty'
import _isEqual from 'lodash/isEqual'

import {SITE_KEY} from '../../constants'

export class UserRegisterForm extends Component{
	constructor(props){
		super(props)
		this.state = {
			validationError: '',
			emailAddress: '',
			nextPassword: '',
			nextPasswordConfirm: ''
		}
		this.handleSubmit = this.handleSubmit.bind(this)
		this.captcha = null
	}

	componentDidUpdate(prevProps){
		if(!_isEqual(prevProps.processing, this.props.processing) && !this.props.processing){
			this.setState({nextPassword: ''})
		}
	}

	onEmailChange(ev){
		this.setState({emailAddress: ev.currentTarget.value})
	}

	onNextPassChange(ev){
		this.setState({nextPassword: ev.currentTarget.value})
	}

	onNextPassConfirmChange(ev){
		this.setState({nextPasswordConfirm: ev.currentTarget.value})
	}

	sendSubmit(){

		if(!_isEqual(this.state.nextPassword, this.state.nextPasswordConfirm)){
			this.setState({validationError: 'New passwords do not match'})
			return
		}

		this.captcha.reset()
		this.setState({verified: false}, () => this.props.onSubmit({
			emailAddress: this.state.emailAddress,
			next: this.state.nextPassword,
			nextConfirm: this.state.nextPasswordConfirm
		}))
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

	submitDisabled() {
		return this.props.processing || _isEmpty(this.state.nextPassword) || _isEmpty(this.state.emailAddress)  || _isEmpty(this.state.nextPasswordConfirm)
	}

	handleValidationError(){
		if(_isEmpty(this.state.validationError)) return null
		return <Panel className="mui--text-danger">{this.state.validationError}</Panel>
	}
	render(){
		return(
			<React.Fragment>
				{this.handleValidationError()}
				<Form onSubmit={(e) => this.onSubmit(e)}>
					<Input onChange={(e) => this.onEmailChange(e)} value={this.state.emailAddress} name={'emailAddress'} type={"email"} label={"Email Address"} autoComplete={'on'} required />
					<Input onChange={(e) => this.onNextPassChange(e)} pattern="[a-zA-Z0-9_-]{6,12}" title="must be alphanumeric in 6-12 chars" value={this.state.nextPassword} name={'nextPassword'} type={"password"} label={"New Password"} autoComplete={'off'} required/>
					<Input onChange={(e) => this.onNextPassConfirmChange(e)} pattern="[a-zA-Z0-9_-]{6,12}" title="must be alphanumeric in 6-12 chars" value={this.state.nextPasswordConfirm} name={'nextPasswordConfirm'} type={"password"} label={"Confirm New Password"} autoComplete={'off'} required/>
					<Reaptcha
						ref={e => this.captcha = e}
						sitekey={SITE_KEY}
						size="invisible"
						onVerify={(e) => this.onVerified(e)}
					/>
					<Button color={"primary"} disabled={this.submitDisabled()}>Register</Button>
				</Form>
			</React.Fragment>
		)
	}
}

UserRegisterForm.defaultProps = {
	processing: false,
	onSubmit: () => {}
}

UserRegisterForm.propTypes = {
	processing:PropTypes.bool,
	onSubmit: PropTypes.func
}

export default UserRegisterForm
