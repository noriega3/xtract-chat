import PropTypes from 'prop-types'
import React, {Component} from 'react'
import { connect } from 'react-redux'
import * as reducers from '../../reducers'
import _ from 'lodash'
import {joinRoom, leaveRoom} from '../../actions/websocketActions'

class ApiLog extends Component {

	constructor(props){
		super(props)
		this.state = {

		}
		this.updateHistory = this.updateHistory.bind(this)
		this.onSendMessage = this.onSendMessage.bind(this)
		this.onMessageData = this.onMessageData.bind(this)
	}

	componentDidMount(){
		if(this.props.wsIsReady) this.props.joinRoom('_server:log:api')
	}

	componentDidUpdate(prevProps){
		if(!_.isEqual(prevProps.wsIsReady, this.props.wsIsReady) && this.props.wsIsReady){
			this.props.joinRoom('_server:log:api', this.onMessageData)
		}
		//this.scrollHistoryToBottom()
	}

	componentWillUnmount() {
		if(this.props.wsIsReady) this.props.leaveRoom('_server:log:api')
		//this.props.unregisterHandler()
	}

	updateHistory(entry) {
		//this.setState({ history: this.state.history.concat(entry) })
	}

	onMessageData(event, message){
		console.log('message for api')
		console.log(event, message)
		this.setState({
			messages: _.clone(this.state.messages).concat(message)
		})
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
				logs show up here for api
			</div>
		)
	}
}

ApiLog.defaultProps = {

}
ApiLog.propTypes = {

}

const mapStateToProps = (state) => ({
	wsIsReady: reducers.wsIsReady(state),
})

const mapDispatchToProps = {
	joinRoom,
	leaveRoom
}
export default connect(mapStateToProps, mapDispatchToProps)(ApiLog)
