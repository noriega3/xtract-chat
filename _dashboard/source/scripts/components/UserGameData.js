import React, { Component } from 'react'
import PropTypes from 'prop-types'
import Button from 'muicss/lib/react/button'
import Tabs from 'muicss/lib/react/tabs'
import Tab from 'muicss/lib/react/tab'
import Input from 'muicss/lib/react/input'
import Panel from 'muicss/lib/react/panel'
import Form from 'muicss/lib/react/form'
import _ from 'lodash'
import UserDataTree from "./UserDataTree";

export class UserGameData extends Component {
	constructor(props){
		super(props)
		this.state = {
			tab: 'summary'
		}

		this.onChange = this.onChange.bind(this)
	}

/*	shouldComponentUpdate(nextProps, nextState){
		if(nextState.tab !== this.state.tab){
			return true
		}
		return false
	}*/


	componentDidMount(){
		console.log('game data')
	}

	onChange(i, value, tab, ev) {
		console.log(arguments);
		this.setState((prev) => ({...prev, tab: value}))
	}

	render(){

		const toArrayWithKey = (obj) => _.values(_.mapValues(obj, (value, key) => {
			return {label: key,value:value}
		}))

		const {data} = this.props
		const {details, tab} = this.state

		if(_.keys(data).length <= 0){
			return(<Panel>No Game Data Found</Panel>)
		}
		return(<Panel>
			<Tabs defaultSelectedIndex={0} justified={true} onChange={this.onChange}>
				{_.map(_.keys(data), (name, i) => (<Tab key={"tab-"+i} value={name} label={name}>
						<UserDataTree key={"tree-"+i} parsed={data[name]} />
				</Tab>))}
			</Tabs>
		</Panel>)
	}
}

UserGameData.defaultProps = {}

UserGameData.propTypes = {
	data: PropTypes.object.isRequired,
	index: PropTypes.string,
}

export default UserGameData
