import React, { Component } from 'react'
import ReactDOM from 'react-dom'
import PropTypes from 'prop-types'
import LazyLoad, { forceCheck } from "react-lazyload"
import Button from 'muicss/lib/react/button'
import Panel from 'muicss/lib/react/panel'
import Textarea from 'muicss/lib/react/textarea'
import Divider from 'muicss/lib/react/divider'
import Form from 'muicss/lib/react/form'
import Input from 'muicss/lib/react/input'
import Tabs from 'muicss/lib/react/tabs';
import Tab from 'muicss/lib/react/tab';
import {toString} from 'lodash/string'

import BoldHighlighter from "./BoldHighlighter" //AutoComplete

const KEY_ENTER = 13

/**
 * These are the components that will render the list based on 'data' prop fed in
 *
 * 		Order of Components:	(General -> Specifics)
 *
 * 		1) App
 * 		2) AutoComplete
 * 	 	3) SearchInput
 * 	>>	4) ResultList
 * 		5) BoldHighlighter - (Item text modifier)
 *
 */
export class ResultList extends Component {
	constructor(props) {
		super(props)
		this.onClick = this.onClick.bind(this)
		this.handleKeyDown = this.handleKeyDown.bind(this)
	}

	shouldComponentUpdate(nextProps, nextState) {
		if (this.props.isSearching !== nextProps.isSearching) {
			return true
		}

		if(this.props.isSearching){
			return false
		}

		if(this.props.query !== nextProps.query){
			return true
		}

		if(this.props.data !== nextProps.data){
			return true
		}

		if(this.props.cursor > 1 && this.props.cursor !== nextProps.cursor){
			return true
		}

		return false
	}

	componentDidUpdate() {

		//scrolls to the element when is active
		if(this.props.cursor > 1 && this.listItem){
			console.log(this.listItem)
			ReactDOM.findDOMNode(this.listItem).scrollIntoView()
			this.listItem.focus()
		}
 	}

 	//transfers click to AutoComplete
	onClick(event){
		event.preventDefault()
		console.log(event.currentTarget)
		this.props.onSelect(event.currentTarget.textContent, event.currentTarget.tabIndex)
	}

	//transfer key events to list to AutoComplete except when enter.
	handleKeyDown(event) {
		const charCode = event.which || event.charCode || event.keyCode || 0

		if (charCode === KEY_ENTER) {
			this.props.onSelect(event.currentTarget.textContent)
			return
		}
		this.props.onKeyDown(event)
	}

	render() {
		const {data, query, fieldName, isSearching, searchingText, emptyResultText, emptyQueryText, cursor} = this.props

		console.log(data)
		if(isSearching){
			//Currently searching
			return (<Panel>{searchingText}</Panel>)
		}

		if(query.length <= 0){
			//User has an input of null or empty
			return (<Panel>{emptyQueryText}</Panel>)
		}

		if(data.length <= 0) {
			return ( <Panel>{emptyResultText}</Panel>)
		}

/*		if(data.length === 1) {
			console.log(data[0]._emailAddress)
			console.log(data[0])

		}*/

		//Generate the list and using lazy load to ensure some performance with large sets
		const renderList = data.map((name, index) => {
			return (<LazyLoad key={index} height={40} throttle={100}>
				<div key={index} tabIndex={index+1} onKeyDown={this.handleKeyDown} onClick={this.onClick} className={"scrollItem"} ref={index+1 === cursor ? (dv) => this.listItem = dv : null }>

					<Button variant="flat" >
						<BoldHighlighter fullText={name[fieldName]}  matchText={query} isSearching={isSearching} />
					</Button>
					<Divider />
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

ResultList.defaultProps = {
	emptyQueryText: "Start typing to search",
	emptyResultText: "No Results Found",
	searchingText: "Searching..",
}

ResultList.propTypes = {
	fieldName: PropTypes.string.isRequired,
	isSearching: PropTypes.bool.isRequired,
	data: PropTypes.array.isRequired,
	query: PropTypes.string.isRequired,
	onSelect: PropTypes.func.isRequired,
	onKeyDown: PropTypes.func.isRequired,
	cursor: PropTypes.number.isRequired,

	emptyQueryText: PropTypes.string,
	emptyResultText: PropTypes.string,
	searchingText: PropTypes.string,
}


export default ResultList

