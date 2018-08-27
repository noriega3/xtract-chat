import React, { Component } from 'react'
import PropTypes from 'prop-types'
import SearchInput  from "./autoComplete/SearchInput.jsx"
import ResultList  from "./autoComplete/ResultList.jsx"
import {replace, escape} from "lodash/string"

import Panel from 'muicss/lib/react/panel'

import {escapeSearchText} from "../utils"

import _debounce from "lodash/debounce"
import _isEqual from "lodash/isEqual"
import _isEmpty from "lodash/isEmpty"

const MS_IDLE = 500
const KEY_ENTER = 13
const KEY_UP = 38
const KEY_DOWN = 40
const MIN_CHARS = 2

/**
 * This is the main component that stores the search results, performs them, and handles the input field
 *
 * 		Order of Components:	(General -> Specifics)
 *
 * 		1) App
 * 	>>	2) AutoComplete
 * 	 	3) SearchInput
 * 	 	4) ResultList
 * 		5) BoldHighlighter - (Item text modifier)
 *
 */
export class AutoComplete extends Component {
	constructor(props) {
		super(props)
		this.state = {
			searchText: "",
			query: props.query || '',
			fieldName: "",
			selected: "",
			idle: true,
			searching: false,
			lastSearched: "",
			lastText: "",
			showResultList: true,
		}

		this.performSearch = this.performSearch.bind(this) //handles spam searching
		this.performSearch = _debounce(this.performSearch,1000) //handles spam searching

		this.handleInputChange 	= this.handleInputChange.bind(this)
		this.handleSearchResult = this.handleSearchResult.bind(this)
		this.handleSelectItem 	= this.handleSelectItem.bind(this)
		this.handleKeyDown 		= this.handleKeyDown.bind(this)
	}



	componentDidMount(){
		//Simulate a server hit on load
		//if(this.props.query && !this.props.searching) this.handleInputChange(this.props.query)
	}

	setSearchQuery(newTerm){
		console.log('new input after debounce', newTerm)
		//validate
		let trimmed = escapeSearchText(newTerm)
		//make it only search when 2 or more

		if(trimmed.length < MIN_CHARS){
			console.log('search term not valid')
			newTerm = ""
		}

		this.setState({	query: newTerm })
	}

	shouldComponentUpdate(nextProps, nextState){
		if(!_isEqual(nextProps.query, this.state.query)) return true
		else if(!_isEqual(nextState.query, this.state.query)) return true
		else if(!_isEqual(nextProps.results, this.props.results)) return true
		else if(!_isEqual(nextProps.searching, this.props.searching)) return true

		return false
	}

	componentDidUpdate(prevProps, prevState){
/*		if(!_isEqual(prevState.query, this.props.query) && !this.props.searching){
			this.performSearch()
		}*/
	}

	performSearch(term){
		if(_isEqual(term, this.props.query)) {
			if(this.props.nextCursor){
				console.log('next cursor')
				this.props.searchFunc({term, cursor: this.props.nextCursor})
			} else {
				console.log('same query being searched')
				return
			}
		}
		this.props.searchFunc({term})
	}

	//handles the search result from "api"
	handleSearchResult(results){
		//localStorage.setItem(this.state.query, JSON.stringify(results))
		this.setState({
			results: results,
			idle: true,
			cursor: 1
		})
		this.props.onData(results) //forward to parent
	}

	//handles a small grace period when user is typing in the search bar
	handleInputChange(searchTerm, isSelect){
		console.log('new input b4 debounce', searchTerm)

		this.performSearch(searchTerm)
	}

	//handles when user presses enter on search and up/down for search bar/dropdown
	handleKeyDown(event) {
		const charCode = event.which || event.charCode || event.keyCode || 0
		const {results, cursor} = this.state
		if (charCode === KEY_ENTER) {}
	}

	//Selects an item when users clicks on dropdown
	handleSelectItem(newValue){

		if(_isEqual(newValue, 'NEXT_PAGE')){
			console.log('go to next page', this.props.query, this.props.nextCursor)
			this.performSearch(this.props.query)
		} else {
			this.props.onResultSelect(newValue)
		}
	}

	handleResults(){
		if(this.props.searching){
			return 	(<Panel>Searching...</Panel>)
		}

		if(!_isEmpty(this.props.results)){
			return 	(<ResultList
				query = {this.props.query}
				fieldName = {this.props.fieldName}
				showResultList={this.state.showResultList}
				data={this.props.results}
				nextCursor={this.props.nextCursor}
				onKeyDown={this.handleKeyDown}
				onSelect={this.handleSelectItem}
			/>)
		} else {
			if(_isEmpty(this.props.query)){
				return (<Panel>Start typing to search..</Panel>)
			}
			return (<Panel>No Results Found</Panel>)
		}
	}

	render() {
		const {searching, name, label, placeholder, tabIndex, autoFocus, customClassName} = this.props
		return (
			<div className={customClassName}>
				<SearchInput
					disabled={searching}
					name={name}
					tabIndex={tabIndex}
					label={label}
					placeholder={placeholder}
					autoFocus={autoFocus}
					onUserInput={this.handleInputChange}
					onKeyDown={this.handleKeyDown}
				/>
				{this.handleResults()}
			</div>
		)
	}
}

AutoComplete.defaultProps = {
	customClassName: 'AutoComplete',
	query: '',
	results: [],

	name: 'autoCompleteField',
	label: "Enter a search term:",
	placeholder: '',

	cursor: 0,
	nextCursor: 0,

	tabIndex: 0,
	delay: MS_IDLE,
	autoFocus: false,
	searchOnMount: '',
	searching: false
}

AutoComplete.propTypes = {
	customClassName: PropTypes.string,
	name: PropTypes.string,

	query: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
	searching: PropTypes.any,
	results: PropTypes.array,

	nextCursor: PropTypes.number,

	label: PropTypes.string,
	placeholder: PropTypes.string,

	tabIndex: PropTypes.number,
	delay: PropTypes.number,
	autoFocus: PropTypes.bool,

	searchFunc: PropTypes.func.isRequired,
	onResultSelect: PropTypes.func.isRequired
}


export default AutoComplete

