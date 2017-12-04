import React, { Component } from 'react'
import PropTypes from 'prop-types'
import Button from 'muicss/lib/react/button'
import Tabs from 'muicss/lib/react/tabs'
import Tab from 'muicss/lib/react/tab'
import Input from 'muicss/lib/react/input'
import Panel from 'muicss/lib/react/panel'
import Form from 'muicss/lib/react/form'
import _ from 'lodash'
import UserGameData from "./UserGameData";

export class UserDetails extends Component{
	constructor(props){
		super(props)
		this.state = {
			details: [],
			tab: 'summary',
			gameDataTab: ''
		}

		this.handleIncomingData = this.handleIncomingData.bind(this)
		this.onChange = this.onChange.bind(this)
		this.onGameDataTab = this.onGameDataTab.bind(this)
	}

	shouldComponentUpdate(nextProps, nextState){
		if(nextProps.userId !== this.props.userId){
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
		let gameData
		console.log('incoming data', result )
		if(result.gameData){
			gameData = _.keys(result.gameData)
		}

		this.setState((prev) => ({
			details: result,
			gameSaves: gameData,
			gameDataTab: gameData ? gameData[0] : ""
		}))
		//this.props.onData(result)
	}

	componentDidMount(){

		this.props.searchFunc(this.props.userId, this.handleIncomingData)
	}

	componentDidUpdate(prevProps, prevState){
		if(this.props.userId !== prevProps.userId){
			this.props.searchFunc(this.props.userId, this.handleIncomingData)
		}
	}
	onChange(i, value, tab, ev) {
		console.log(arguments);
		this.setState((prev) => ({...prev, tab: value}))
	}

	onGameDataTab(i, value, tab, ev) {
		console.log(arguments);
		this.setState((prev) => ({...prev, gameDataTab: value}))
	}

	render(){

		const toArrayWithKey = (obj) => _.values(_.mapValues(obj, (value, key) => {
			return {label: key,value:value}
		}))


		const {userId} = this.props
		const {details, tab, gameDataTab, gameSaves} = this.state
		const summary = toArrayWithKey(details)

		console.log(summary)

		if(details.length <= 0){
			return(<Panel>No Details Found {userId}</Panel>)
		}

		return(<Panel key={this.props.userId}>
			<Tabs defaultSelectedIndex={0} justified={true} onChange={this.onChange}>
				<Tab value="summary" label="Summary">
					<Panel>
						<Form>
							{summary.map((values, index) => {
								if(_.isArray(values.value)){

								} else if(_.isString(values.value)) {
									return <Input key={index} floatingLabel={true} name={values.label} label={_.startCase(values.label)} defaultValue={values.value} />
								} else if(_.isObject(values.value)){
									if(values.label === "gameSaves"){
										return(<Tabs key={index} onChange={this.onGameDataTab} >
											{_.map(gameSaves, (name, i) => (<Tab key={index-i} value={name} label={name} />))}
										</Tabs>)
									}

									if(values.label === "gameData" && gameDataTab.length > 0){
										return( <UserGameData key={index} data={values.value[gameDataTab]} index={gameDataTab} />)
									}
								}
							})}
						</Form>
					</Panel>
				</Tab>
			</Tabs>
		</Panel>)
	}
}

UserDetails.defaultProps = {
	userId: ""
}

UserDetails.propTypes = {
	searchFunc: PropTypes.func.isRequired,
	userId: PropTypes.string.isRequired
}

export default UserDetails
