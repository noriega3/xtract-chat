import React, { Component } from 'react'
import PropTypes from 'prop-types'
import {toString} from 'lodash/string'

import BoldHighlighter from "./BoldHighlighter.jsx" //AutoComplete

const KEY_ENTER = 13

/**
 * These are the components that will render the list based on 'data' prop fed in
 *
 * 		Order of Components:	(General -> Specifics)
 *
 * 		1) App
 * 		2) AutoComplete
 * 	 	3) SearchInput
 * 	>>	4) ResultList/ResultItem
 * 		5) BoldHighlighter - (Item text modifier)
 *
 */
class ResultItem extends Component {
	constructor(props) {
		super(props);

		this.state = {}
		this.onClick = this.onClick.bind(this)
		this.onKeyDown = this.onKeyDown.bind(this)
	}

	onClick(){
		const {value, id} = this.props
		this.props.onSelect(value, id)
	}
	onKeyDown(ev){
		const {value,id} = this.props
		const charCode = ev.which || ev.charCode || ev.keyCode || 0

		if (charCode === KEY_ENTER) {
			this.props.onSelect(value, label)
			return false
		}
	}

	render() {
		const {query, id} = this.props
		return(<div id={id} {...this.props} onKeyDown={this.onKeyDown} onClick={this.onClick} className={"scrollItem"} ref={(e) => this.resultList = e}>
			<BoldHighlighter fullText={id} matchText={query} />
		</div>)
	}
}
ResultItem.propTypes = {
	id: PropTypes.string.isRequired, //also known as the label
	value: PropTypes.string.isRequired,
	query: PropTypes.string.isRequired,
	onSelect: PropTypes.func.isRequired,
	onKeyDown: PropTypes.func
}

export default ResultItem

