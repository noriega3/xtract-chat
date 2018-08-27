import PropTypes from 'prop-types'
import React, {Component, Fragment} from 'react'
import _ from 'lodash'
import Dropdown from 'muicss/lib/react/dropdown'
import DropdownItem from 'muicss/lib/react/dropdown-item'
import Panel from 'muicss/lib/react/panel'
import Button from 'muicss/lib/react/button'
import ToggleTextArea from '../components/templates/ToggleTextArea'

import UserMessageInit from "../components/webClient/msgTypes/UserMessageInit"
import UserJsonGenerator from "../components/webClient/msgTypes/UserJsonGenerator";



const messageTemplates = [
	{
		label: "CUSTOM",
		value: ""
	},
	{
		label: "INIT",
		isFavorite: true,
		IsComponent: UserMessageInit
	},
	{	label: "ENDCONNECTION",
		value: "__ENDCONNECTION__",
	},
	{	label: "STATUS",
		value: "__STATUS__"
	},
	{	label: "SUBSCRIBE",
		isFavorite: true,
		isJSON: {
			rootElements: [
				{field: "intent", type: "string", value: "subscribe", disabled:true},
				{field: "sessionId", type: "sessionid", value: "**SESSIONID**", required:true, lock: ['type', 'field']},
				{field: "room", type: "roomlist", value: "", required:true, lock: ['type', 'field']}
			],
			paramElements: [
				{field: "isGameRoom", type: "boolean", lock: ['type', 'field']},
				{field: "isTurnBasedRoom", type: "boolean", lock: ['type', 'field']}
			]
		}
	},
	{
		label: "UNSUBSCRIBE",
		isFavorite: true,

		isJSON: {
			rootElements: [
				{field: "intent", type: "string", value: "unsubscribe", disabled:true},
				{field: "sessionId", type: "sessionid", value: "**SESSIONID**", required:true, lock: ['type', 'field']},
				{field: "room", type: "roomlist", value: "", required:true, lock: ['type', 'field']}
			],
			paramElements: []
		},
	},
	{
		label: "SEND CHAT MESSAGE",
		isJSON: {
			rootElements: [
				{field: "eventId", type: "string", value: "**EVENTID**", disabled:true},
				{field: "intent", type: "string", value: "sendChatToRoom", disabled:true},
				{field: "sessionId", type: "sessionid", value: "**SESSIONID**", required:true, lock: ['type', 'field']},
				{field: "userId", type: "userid", value: "**USERID**", required:true, lock: ['type', 'field']},
				{field: "room", type: "roomlist", value: "", required:true, lock: ['type', 'field']},
				{field: "message", type: "string", value: "", required:true, lock: ['type', 'field']},

			],
			paramElements: []
		},
	}
]
const favoriteTemplates = _.filter(messageTemplates, {isFavorite: true})

/***
 * Connects a user to the pubsub server over web
 */
class MessageGenerator extends Component {
	constructor(props){
		super(props)
		this.state = {
			templateIndex: 0,
			message: "",
			jsonMessage: ""
		}

		this.generate = this.generate.bind(this)
		this.handleOnClick = this.handleOnClick.bind(this)
	}

	handleOnSelect(newIndex){
		//TODO: fix dropdown to select appropriate label, attach to webclient and fix up the rest
		this.setState({templateIndex: newIndex})
	}
	handleOnFavoriteSelect(label){
		console.log('_.findIndex(messageTemplates, {label})}', _.findIndex(messageTemplates, {label}))
		//get index based on message template
		//TODO: fix dropdown to select appropriate label, attach to webclient and fix up the rest
		this.setState({templateIndex: _.findIndex(messageTemplates, {label})})
	}

	shouldComponentUpdate(newProps, newState){
		if(newState.templateIndex !== this.state.templateIndex)	return true
		if(newState.message !== this.state.message)	return true
		return false
	}

	handleMessageChange(newMessage, jsonMessage){

		this.setState({message: newMessage, jsonMessage})
		//this.props.onMessageChange(newMessage)
	}

	generate(templateIndex = this.state.templateIndex){
		if(templateIndex < 0 || !messageTemplates[templateIndex]) return null
		const {value, isJSON, IsComponent} = messageTemplates[templateIndex]

		if(IsComponent) return <IsComponent key={templateIndex} message={this.state.message} onMessageChange={(msg, strjson) => this.handleMessageChange(msg, strjson)}/>
		if(isJSON) return <UserJsonGenerator key={templateIndex} rootElements={_.get(isJSON, 'rootElements', [])} paramElements={_.get(isJSON, 'paramElements')} onMessageChange={(msg, strjson) => this.handleMessageChange(msg, strjson)}/>
		if(value || templateIndex === 0) return <SimpleMessage key={templateIndex} value={value} onMessageChange={(e) => this.handleMessageChange(e)} />
	}

	handleOnClick(e){
		e.preventDefault()
		e.stopPropagation()
		this.props.onSubmit(this.state.message, this.state.jsonMessage)
	}
	render() {
		return (
			<div>
				<div>
					<span>
						<Dropdown color="primary" label="Message Templates" onSelect={(i) => this.handleOnSelect(i)}>
							{messageTemplates.map((template, i) => <DropdownItem key={i} value={i}>{template.label}</DropdownItem>)}
						</Dropdown>
						&nbsp;
					</span>
					<span className="mui--divider-left">
						{favoriteTemplates.map((template, i) => <Button key={i} size="small" color="primary" variant="flat" onClick={()=>this.handleOnFavoriteSelect(template.label)}>{template.label}</Button>)}
					</span>
				</div>
				{this.generate(this.state.templateIndex)}
				<Button color={"primary"} onClick={this.handleOnClick} disabled={_.isEmpty(this.state.message) || this.props.disabled}>Send</Button>
			</div>);
	}
}
export default MessageGenerator

class SimpleMessage extends Component {
	constructor(props){
		super(props)
		this.state = {
			value: props.value
		}
	}
	componentDidMount(){
		this.props.onMessageChange(this.state.value)
	}
	handleOnChange(newValue){
		this.setState({value: newValue})
		this.props.onMessageChange(newValue)
	}
	render(){
		return(<Fragment>
			<Panel>
				<ToggleTextArea autoFocus value={this.state.value} show={true} label={"Message"} onChange={(e) => this.handleOnChange(e.currentTarget.value)} />
			</Panel>
		</Fragment>)
	}

}
SimpleMessage.defaultProps = {
	value: "",
	onMessageChange: () => console.warn('Raw message was changed')
}
SimpleMessage.propTypes = {
  onMessageChange: PropTypes.func,
  value: PropTypes.any.isRequired
}


