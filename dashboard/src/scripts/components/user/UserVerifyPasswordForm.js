import React, { Component } from 'react'
import PropTypes from 'prop-types'

import Panel from 'muicss/lib/react/panel'
import Form from 'muicss/lib/react/form'
import Input from 'muicss/lib/react/input'
import Button from 'muicss/lib/react/button'
import _ from 'lodash'
import _isEmpty from 'lodash/isEmpty'
import _isEqual from 'lodash/isEqual'

export class UserVerifyPasswordForm extends Component{
	constructor(props){
		super(props)
		this.state = {
			validationError: '',
			password: ''
		}
	}

	onPassChange(ev){
		this.setState({password: ev.currentTarget.value})
	}

	onSubmit(ev){
		ev.preventDefault()
		this.props.onSubmit({
			current: this.state.password
		})
		this.setState({validationError: '', password: ''})
	}

	submitDisabled() {
		return this.props.processing
	}

	handleValidationError(){
		if(_isEmpty(this.state.validationError)) return null
		return <Panel className="mui--text-danger">{this.state.validationError}</Panel>
	}
	render(){
		return(
			<div>
				{this.handleValidationError()}
				<Form onSubmit={(e) => this.onSubmit(e)}>
					<legend>{this.props.legend}</legend>
					<Input onChange={(e) => this.onPassChange(e)} value={this.state.password} name={'password'} type={"password"} label={"Current Password"} autoComplete={'off'} required />
					<Button color={"primary"} size={this.props.submitSize} disabled={this.submitDisabled()}>{this.props.submitText}</Button>
					{this.props.onCancel && <Button color={"flat"} onClick={this.props.onCancel} disabled={this.props.processing}>Cancel</Button>}
				</Form>
			</div>
		)
	}
}

UserVerifyPasswordForm.defaultProps = {
	legend: 'Please verify your password',
	submitText: 'Verify Password',
	submitSize: '',
	processing: false,
	onSubmit: () => {}
}

UserVerifyPasswordForm.propTypes = {
	legend: PropTypes.node,
	processing:PropTypes.bool,
	submitText:PropTypes.string,
	submitSize:PropTypes.oneOf(['', 'large', 'small']),
	onSubmit: PropTypes.func,
	onCancel: PropTypes.func,
}

export default UserVerifyPasswordForm
