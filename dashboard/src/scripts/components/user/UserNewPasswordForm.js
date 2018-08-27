import React, { Component } from 'react'
import PropTypes from 'prop-types'

import Appbar from 'muicss/lib/react/appbar'
import Panel from 'muicss/lib/react/panel'
import Form from 'muicss/lib/react/form'
import Input from 'muicss/lib/react/input'
import Button from 'muicss/lib/react/button'
import _ from 'lodash'
import _isEmpty from 'lodash/isEmpty'
import _isEqual from 'lodash/isEqual'

export class UserNewPasswordForm extends Component{
	constructor(props){
		super(props)
		this.state = {
			validationError: '',
			nextPassword: '',
			nextPasswordConfirm: ''
		}
	}

	componentDidUpdate(prevProps){
		if(!_isEqual(prevProps.processing, this.props.processing) && !this.props.processing){
			this.setState({nextPassword: ''})
		}
	}

	onNextPassChange(ev){
		this.setState({nextPassword: ev.currentTarget.value})
	}

	onNextPassConfirmChange(ev){
		this.setState({nextPasswordConfirm: ev.currentTarget.value})
	}

	onSubmit(ev){
		ev.preventDefault()
		if(!_isEqual(this.state.nextPassword, this.state.nextPasswordConfirm)){
			this.setState({validationError: 'New passwords do not match'})
			return
		}

		this.props.onSubmit({
			next: this.state.nextPassword,
			nextConfirm: this.state.nextPasswordConfirm
		})
		this.setState({validationError: '', nextPasswordConfirm: ''})
	}

	submitDisabled() {
		return _isEqual(this.state.password, this.state.nextPassword) || this.props.processing || _isEmpty(this.state.nextPassword) || _isEmpty(this.state.nextPasswordConfirm)
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
					<legend>
						{this.props.legend}
					</legend>
					<Input onChange={(e) => this.onNextPassChange(e)} pattern="[a-zA-Z0-9_-]{6,12}" title="must be alphanumeric in 6-12 chars" value={this.state.nextPassword} name={'nextPassword'} type={"password"} label={"New Password"} autoComplete={'off'} required/>
					<Input onChange={(e) => this.onNextPassConfirmChange(e)} pattern="[a-zA-Z0-9_-]{6,12}" title="must be alphanumeric in 6-12 chars" value={this.state.nextPasswordConfirm} name={'nextPasswordConfirm'} type={"password"} label={"Confirm New Password"} autoComplete={'off'} required/>
					<Button color={"primary"} size={this.props.submitSize} disabled={this.submitDisabled()}>{this.props.submitText}</Button>
					{this.props.onCancel && <Button color={"flat"} onClick={this.props.onCancel} disabled={this.props.processing}>Cancel</Button>}
				</Form>
			</div>
		)
	}
}

UserNewPasswordForm.defaultProps = {
	legend: 'Create a password',
	submitText: 'Set Password',
	submitSize: '',
	processing: false,
	onSubmit: () => {}
}

UserNewPasswordForm.propTypes = {
	legend: PropTypes.node,
	processing:PropTypes.bool,
	submitText:PropTypes.string,
	submitSize:PropTypes.oneOf(['', 'large', 'small']),
	onSubmit: PropTypes.func,
	onCancel: PropTypes.func
}

export default UserNewPasswordForm
