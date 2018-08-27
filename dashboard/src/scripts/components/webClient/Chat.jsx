import React, {Component} from 'react'
import _ from 'lodash'
import Form from 'muicss/lib/react/form'
import Input from 'muicss/lib/react/input'
import Button from 'muicss/lib/react/button'
import {connect} from 'react-redux'
import {sendChatMessage} from '../../actions/wsSimulatorActions'

import Picker from '../Picker'
import ChatLog from './ChatLog'

/***
 * Connects a user to the pubsub server over web
 */
class Chat extends Component {

	constructor(){
		super()
		this.state = {
			selectedRoom: "Select a Room"
		}
		this.handleSelectChange	= this.handleSelectChange.bind(this)
	}

	handleSelectChange(selectedRoom){
		this.setState({selectedRoom})
	}



	render() {
		const {selectedRoom} = this.state
		const {sessionId,userId, subscriptions, messages, sendChatMessage} = this.props
		return (
			<div>
				<Picker value={selectedRoom} options={subscriptions} onChange={(e) => this.handleSelectChange(e) } />
				{selectedRoom && <ChatLog messages={messages[selectedRoom]} />}
				{selectedRoom && <ChatInput onSend={(msg) => { sendChatMessage(sessionId, userId, selectedRoom, msg)}}/>}
			</div>
		)
	}
}

//Code to associate redux 'state' to props of above component
const mapStateToProps = state => {
	return ({
		subscriptions: state.webClient.subscriptions,
		sessionId: state.webClient.sessionId,
		userId: state.webClient.userId,
		messages: state.webClient.chat,
		client: state.webClient
	})
}
const mapDispatchToProps = {
	sendChatMessage
}
export default connect(mapStateToProps, mapDispatchToProps)(Chat)


/***
 * Connects a user to the pubsub server over web
 */
class ChatInput extends Component {

	constructor(props){
		super(props)
		this.state = {
			message: ""
		}
	}

	handleValueChange(message){
		console.log('value change to ', message)
		this.setState({message})
	}

	handleFormSubmit(e){
		e.preventDefault()
		this.props.onSend(this.state.message)
	}

	render() {
		return (
			<Form onSubmit={(e)=> this.handleFormSubmit(e)} inline={true}>
				<Input value={this.state.message} type={"text"} onChange={(e) => this.handleValueChange(e.currentTarget.value)} placeholder={`Enter a message`}	required/>
				<Button>Send</Button>
			</Form>
		)
	}
}
