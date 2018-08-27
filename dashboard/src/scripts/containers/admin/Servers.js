import PropTypes from 'prop-types'
import React, {Component} from 'react'
import { connect } from 'react-redux'
import moment from 'moment'
import Panel from 'muicss/lib/react/panel'
import Button from 'muicss/lib/react/button'
import Container from 'muicss/lib/react/container'
import Col from 'muicss/lib/react/col'
import Row from 'muicss/lib/react/row'

import {
	dataRequest,
	dataRequestProgress,
	dataRequestDownload
} from '../actions/apiProfileActions'

import {
	websocket,
	dataRequestReady,
	dataRequestTime,F
} from '../reducers'

class Servers extends Component {

	constructor(props){
		super(props)
		const { history } = props
		this.state = {
			isRegisterInProcess: false,
			history,
			input: ''
		}

		this.updateHistory = this.updateHistory.bind(this)
		this.onMessageReceived = this.onMessageReceived.bind(this)
		this.onSendMessage = this.onSendMessage.bind(this)
	}

	componentDidMount(){
		this.props.registerHandler(this.onMessageReceived)
	}

	componentDidUpdate(){
		this.scrollHistoryToBottom()
	}

	componentWillUnmount() {
		this.props.unregisterHandler()
	}

	updateHistory(entry) {
		this.setState({ history: this.state.history.concat(entry) })
	}

	onMessageReceived(entry) {
		this.updateHistory(entry)
	}

	onSendMessage() {
		if (!this.state.input)
			return

		this.props.onSendMessage(this.state.input, (err) => {
			if (err)
				return console.error(err)

			return this.setState({ input: '' })
		})
	}
	render() {
		return (
			<div>

			</div>
		)
	}
}

Servers.defaultProps = {

}
Servers.propTypes = {

}

const mapStateToProps = state => ({
	websocket:  websocket(state),
	requestReady:  dataRequestReady(state),
	requestReadyTime:  dataRequestTime(state)
})

const mapDispatchToProps = {

}
export default connect(mapStateToProps, mapDispatchToProps)(Servers)
