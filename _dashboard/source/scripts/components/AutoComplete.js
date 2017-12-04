import React, { Component } from 'react'
import PropTypes from 'prop-types'
import SearchInput  from "./autoComplete/SearchInput"
import ResultList  from "./autoComplete/ResultList"
import {replace, escape} from "lodash/string"

const MS_IDLE = 500
const KEY_ENTER = 13
const KEY_UP = 38
const KEY_DOWN = 40

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
			query: "",
			fieldName: "",
			results: [],
			searching: false,
			cursor: 1
		}

		this.handleInputChange 	= this.handleInputChange.bind(this)
		this.handleSearchResult = this.handleSearchResult.bind(this)
		this.handleSelectItem 	= this.handleSelectItem.bind(this)
		this.handleKeyDown 		= this.handleKeyDown.bind(this)
		this.handleSearchQuery 	= this.handleSearchQuery.bind(this)
		this.handleOnUserIdle 	= this.handleOnUserIdle.bind(this)
	}

	componentWillMount() {
		//nil the idle timer
		this.timer = null
	}

	componentDidMount(){
		//Simulate a server hit on load
		this.handleInputChange(this.props.searchOnMount)
	}


	handleSearchQuery(){
		clearTimeout(this.timer)
		console.log('searching', this.state.searchText)
		let escaped = replace(this.state.searchText, /[^A-Z0-9.@\-_:' ]+/gi, "")
		escaped = replace(escaped, /[.]+/ig, "\\.")
		escaped = replace(escaped, /[-]+/ig, "\\-")
		escaped = escape(escaped).trim()

		//make it only search when 2 or more
		if(escaped.length < 1){
			this.setState((prev) => ({
				searchText: this.state.searchText,
				query: prev.query,
				results: prev.results,
				searching: false,
				cursor: 1
			}))
			return
		}

		this.setState((prev) => ({
			...prev,
			query: escaped,
			searching: true,
			cursor: 1
		}))
		this.props.searchFunc(escaped, this.handleSearchResult)
	}

	//handles the search result from "api"
	handleSearchResult(results){
		//this.props.onData(results)
		//localStorage.setItem(this.state.query, JSON.stringify(results))
		this.setState((previousState) => ({
			searchText: previousState.searchText,
			query: previousState.query,
			results: results,
			searching: false,
			cursor: 1
		}))
	}

	//handles to ensure user isn't already searching and to begin a search
	handleOnUserIdle(){
		if(this.state.searching) return
		this.handleSearchQuery()
	}

	//handles a small grace period when user is typing in the search bar
	handleInputChange(searchTerm, isSelect){
		clearTimeout(this.timer)
		if(isSelect){
			this.setState((previousState) => ({
				...previousState,
				searchText:searchTerm
			}))
		} else {
			this.setState((previousState) => ({
				query: "",
				searchText:searchTerm,
				searching: previousState.searching,
				results: previousState.results,
				cursor: 1
			}))
			this.props.onInputChange(this.state.searchText)
			this.timer = setTimeout(this.handleOnUserIdle, MS_IDLE)
		}
	}

	//handles when user presses enter on search and up/down for search bar/dropdown
	handleKeyDown(event) {
		const charCode = event.which || event.charCode || event.keyCode || 0
		const {results, cursor} = this.state

		if (charCode === KEY_ENTER) {
			if(cursor === 1){
				this.handleSearchQuery()
			}
		}
		if (charCode === KEY_UP && cursor > 1) {
			event.preventDefault()
			this.setState((previousState) => ({
				query: previousState.query,
				searchText:previousState.searchText,
				searching: previousState.searching,
				results: previousState.results,
				cursor: (cursor-1 < 1 || results.length <= 0) ? 1 : cursor-1  //check against results length and if cursor will be 0 or neg.
			}))
		}

		if (charCode === KEY_DOWN) {
			event.preventDefault()
			this.setState((previousState) => ({
				query: previousState.query,
				searchText:previousState.searchText,
				searching: previousState.searching,
				results: previousState.results,
				cursor: (cursor+1 > results.length) ? cursor : cursor+1 //check against results length and if cursor will be over the results length
			}))
		}
	}

	//Selects an item when users clicks on dropdown
	handleSelectItem(newQuery, tabIndex){

		if(this.props.selectedName !== newQuery){
			this.handleInputChange(newQuery, true)
		}

		//TODO: clean up
		if(tabIndex-1 >= 0 && this.state.results[tabIndex-1]) {
			this.props.onSelect(newQuery,this.state.results[tabIndex-1])
		} else {
			this.props.onSelect(newQuery,{})
		}

	}

	render() {
		const {name, label, placeholder, tabIndex, autoFocus, customClassName, fieldName, data} = this.props
		const {searchText, results, searching, query, cursor} = this.state
		return (
			<div className={customClassName}>
				<SearchInput
					name={name}
					tabIndex={tabIndex}
					label={label}
					placeholder={placeholder}
					autoFocus={autoFocus}
					searchText={searchText}
					onUserInput={this.handleInputChange}
					onKeyDown={this.handleKeyDown}
					cursor={cursor}
				/>

				<ResultList
					fieldName = {fieldName}
					data={results}
					isSearching={searching}
					query={query}
					onKeyDown={this.handleKeyDown}
					onSelect={this.handleSelectItem}
					cursor={cursor}
				/>

			</div>
		)
	}
}

AutoComplete.defaultProps = {
	customClassName: 'AutoComplete',
	name: 'autoCompleteField',
	label: "",
	tabIndex: 0,
	delay: MS_IDLE,
	autoFocus: false,
	placeholder: 'Enter a value',
	searchOnMount: ''
}

AutoComplete.propTypes = {
	searchOnMount: PropTypes.string,
	name: PropTypes.string,
	label: PropTypes.string,
	customClassName: PropTypes.string,
	tabIndex: PropTypes.number,
	delay: PropTypes.number,
	placeholder: PropTypes.string,
	autoFocus: PropTypes.bool,
	searchFunc: PropTypes.func.isRequired,
	onSelect: PropTypes.func.isRequired,
	onInputChange: PropTypes.func.isRequired,
	fieldName: PropTypes.string.isRequired
}


export default AutoComplete

