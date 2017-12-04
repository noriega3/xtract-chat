import React, { Component } from 'react'
import PropTypes from 'prop-types'
import Button from 'muicss/lib/react/button'
import Tabs from 'muicss/lib/react/tabs'
import Tab from 'muicss/lib/react/tab'
import Input from 'muicss/lib/react/input'
import Panel from 'muicss/lib/react/panel'
import Form from 'muicss/lib/react/form'
import _ from 'lodash'
import { getRoomPlayers, getRoomHistory, getRoomBots, getRoomMessages } from '../resources/roomListResource'
import RoomMessages from './roomTabs/RoomMessages'
import RoomHistory from "./roomTabs/RoomHistory";
import RoomPlayers from "./roomTabs/RoomPlayers";


export class RoomDetails extends Component {
	constructor(props){
		super(props)
		this.state = {
			details: [],
			tab: 'summary'
		}

		this.handleIncomingData = this.handleIncomingData.bind(this)
		this.onChange = this.onChange.bind(this)
	}

	shouldComponentUpdate(nextProps, nextState){
		if(nextProps.roomName !== this.props.roomName){
			return true
		}
		if(nextState.details !== this.state.details){
			return true
		}
		if(nextState.tab !== this.state.tab){
			return true
		}
		return false
	}

	handleIncomingData(result){
		this.setState((prev) => ({details: result}))
		//this.props.onData(result)
	}

	componentDidMount(){

		this.props.searchFunc(this.props.roomName, this.handleIncomingData)
	}

	componentDidUpdate(prevProps, prevState){
		if(this.props.roomName !== prevProps.roomName){
			this.props.searchFunc(this.props.roomName, this.handleIncomingData)
		}
	}

	onChange(i, value, tab, ev) {
		console.log(arguments);
		this.setState((prev) => ({...prev, tab: value}))
	}

	render(){

		const toArrayWithKey = (obj) => _.values(_.mapValues(obj, (value, key) => {
			return {label: key,value:value}
		}))

		const {roomName} = this.props
		const {details, tab} = this.state
		const summary = toArrayWithKey(details)

		if(details.length <= 0){
			return(<Panel>No Details Found for {roomName} </Panel>)
		}

		const showMessages = ()=>{
			if(tab === "messages"){
				return(<RoomMessages roomName={roomName} />)
			}
			return(<Panel>Loading Messages..</Panel>)
		}

		const showHistory = ()=>{
			if(tab === "history"){
				return(<RoomHistory roomName={roomName} />)
			}
			return(<Panel>Loading History..</Panel>)
		}

		const showBots = ()=>{
			if(tab === "bots"){
				return(<RoomMessages roomName={roomName} />)
			}
			return(<Panel>Loading Players..</Panel>)
		}

		const showPlayers = ()=>{
			if(tab === "players"){
				return(<RoomPlayers roomName={roomName} />)
			}
			return(<Panel>Loading Players..</Panel>)
		}

		return(<Panel key={roomName}>
			<Tabs defaultSelectedIndex={0} justified={true} onChange={this.onChange}>
				<Tab value="summary" label="Summary">
					<Panel>
						<Form>
							{summary.map((values, index) => {
								if(_.isArray(values.value)){
									return <Panel key={index}>value</Panel>
								} else {
									return <Input key={index} floatingLabel={true} name={values.label} label={_.startCase(values.label)} defaultValue={values.value} />
								}
							})}
						</Form>
					</Panel>
				</Tab>

				<Tab value="players" label={"Players"}>
					{showPlayers()}
				</Tab>
				<Tab value="bots" label={"Bots"}>
					{showBots()}

				</Tab>
				<Tab value="history" label={"History"}>
					{showHistory()}

				</Tab>
				<Tab value="messages" label={"Messages"}>
					{showMessages()}
				</Tab>
			</Tabs>
		</Panel>)
	}
}

RoomDetails.defaultProps = {
	roomName: "",
}

RoomDetails.propTypes = {
	searchFunc: PropTypes.func.isRequired,
	//onData: PropTypes.func.isRequired,
	roomName: PropTypes.string.isRequired,
}

export default RoomDetails
