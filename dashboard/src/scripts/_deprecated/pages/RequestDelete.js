import React, {Component} from 'react'
import { connect } from 'react-redux'
import Panel from 'muicss/lib/react/panel'
import _ from 'lodash'
import Button from 'muicss/lib/react/button'

import {echo} from '../actions/apiEchoActions'
import {serverMessage} from '../reducers'
import Input from 'muicss/lib/react/input'
import Form from 'muicss/lib/react/form'

class RequestDelete extends Component {

	constructor(){
		super()
		this.state = {
			roomName: "",
			data: []
		}
	}

	componentDidMount() {
		this.props.fetchMessage('Hi!')
	}

	render() {
		return (
			<div>
				{this.props.message && <Panel><p>{this.props.message}</p></Panel>}
				<Panel>
					<div className="mui--text-body1">We will send a request on your device registered to this account. You will need to tap ACCEPT on the device to confirm deletion</div>
					<div>
						<Button color={"danger"}>Request Deletion</Button>
					</div>
				</Panel>
			</div>
		);
	}
}
export default connect(
	state => ({ message: serverMessage(state) }),
	{ fetchMessage: echo }
)(RequestDelete)
