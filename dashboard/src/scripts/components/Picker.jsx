import React, {Component} from 'react'
import _ from 'lodash'
import PropTypes from 'prop-types'
import {sendConnect, sendClose, sendReconnect, sendMessage, sendConfirmInit} from '../actions/wsSimulatorActions'
import {connect} from 'react-redux'
import Dropdown from 'muicss/lib/react/dropdown'
import DropdownItem from 'muicss/lib/react/dropdown-item'

//component
export default class Picker extends Component {
	render() {
		const {value, onChange, options} = this.props
		return (
			<span>
				<Dropdown color="primary" label={value} onSelect={(e) => onChange(e)}>
					{_.map(options, (option) => {
						return (
							<DropdownItem key={option} value={option}>{option}</DropdownItem>
						)
					})}
				</Dropdown>
			</span>
		);
	}
}
Picker.propTypes = {
	options: PropTypes.arrayOf(PropTypes.string.isRequired).isRequired,
	value: PropTypes.string.isRequired,
	onChange: PropTypes.func.isRequired
}
