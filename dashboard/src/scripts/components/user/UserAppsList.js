import PropTypes from 'prop-types'
import React, { Component } from 'react'
import { connect } from 'react-redux'

import _map from 'lodash/map'
import _isEqual from 'lodash/isEqual'

import Select from 'muicss/lib/react/select'
import Option from 'muicss/lib/react/option'
import Panel from 'muicss/lib/react/panel'
import {editUserAppSelect} from '../../reducers'

export class UserAppsList extends Component{
	constructor(props){
		super(props)
		this.state = {
			value: props.value || ''
		}
	}

	componentDidUpdate(prevProps){
		if(!_isEqual(this.props.value, this.state.value)){
			this.setState({value: this.props.value})
		}
	}

	onChange(ev){
		this.setState({value: ev.target.value})
		this.props.onSelect(ev.target.value)
	}

	render(){
		return(
			<Select name="_appSavesList" label={"Select An App To Show Saved Data"} value={this.state.value} onChange={this.onChange.bind(this)} >
				<Option value={-1} label={"Select an App"} />
				{_map(this.props.data, (name, i) => (<Option key={i-1} value={name} label={name} />))}
			</Select>
		)
	}
}

UserAppsList.defaultProps = {
	data: {},
	onSelect: () => {}
}

UserAppsList.propTypes = {
	value: PropTypes.string,
	data: PropTypes.object.isRequired,
	userId:PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
	onSelect:PropTypes.func,
}

export default UserAppsList
