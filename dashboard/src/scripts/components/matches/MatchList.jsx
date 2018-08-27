import React, { Component } from 'react'
import PropTypes from 'prop-types'
import LazyLoad, { forceCheck } from "react-lazyload"
import Panel from 'muicss/lib/react/panel'

const KEY_ENTER = 13

export class MatchList extends Component {
	constructor(props) {
		super(props)
		this.onClick = this.onClick.bind(this)
		this.handleKeyDown = this.handleKeyDown.bind(this)
	}

	componentDidUpdate() {

	}

 	//transfers click to AutoComplete
	onClick(event){
		event.preventDefault()
		console.log('select', event.currentTarget.textContent)
		this.props.onSelect(event.currentTarget.textContent)
	}

	//transfer key events to list to AutoComplete except when enter.
	handleKeyDown(event) {
		const charCode = event.which || event.charCode || event.keyCode || 0

		if (charCode === KEY_ENTER) {
			this.props.onSelect(event.currentTarget.textContent)
			return
		}
	}

	render() {
		const {data, selected} = this.props

		const renderList = data.map((name, index) => {
			return (<LazyLoad key={index} height={40} throttle={100}>
				<div key={index} tabIndex={index+1} value={name} onKeyDown={this.handleKeyDown} onClick={this.onClick} className={"scrollItem"}>
					{name}
				</div>
			</LazyLoad>)
		})


		return (
			<Panel className="ScrollableContainer widget-list overflow">
				{renderList}
			</Panel>
		)
	}
}

MatchList.defaultProps = {
}

MatchList.propTypes = {
	data: PropTypes.array.isRequired,
	selected: PropTypes.string.isRequired,
	onSelect: PropTypes.func.isRequired,
}


export default MatchList

