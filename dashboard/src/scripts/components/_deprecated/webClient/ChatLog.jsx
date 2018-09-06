import React, {Component, Fragment} from 'react'
import PropTypes from 'prop-types'
import _ from 'lodash'
import ReactTable from 'react-table'
import 'react-table/react-table.css'
import Panel from 'muicss/lib/react/panel'
import ToggleTextArea from '../templates/ToggleTextArea'
import treeTableHOC from 'react-table/lib/hoc/treeTable'
import ReactHtmlParser, { processNodes, convertNodeToElement, htmlparser2 } from 'react-html-parser';
import moment from 'moment'
import matchSorter from 'match-sorter'
import Modal from "../templates/Modal.js";
const TreeTable = treeTableHOC(ReactTable)
import Convert from 'ansi-to-html'
const convert = new Convert({
	newline: true,
	escapeXML: false,
	stream: false
})
const convertSummary = new Convert({
	newline: false,
	stream: true
})
import ReactDataGrid from 'react-data-grid'
import {Toolbar, Filters } from 'react-data-grid-addons';
const { SingleSelectFilter } = Filters;

export class ChatLog extends Component {
	constructor(props) {
		super(props)

		this.createRows = this.createRows.bind(this)
		this.getRows = this.getRows.bind(this)
		this.handleFilterChange = this.handleFilterChange.bind(this)
		this.getValidFilterValues = this.getValidFilterValues.bind(this)
		this.handleOnClearFilters = this.handleOnClearFilters.bind(this)
		this.onModalClose = this.onModalClose.bind(this)

		this._columns = [
			{
				key: 'timestamp',
				name: 'Time',
				width: 150,
			},
			{
				key: 'username',
				name: 'Username',
				width: 175,
			},
			{
				key: 'message',
				name: 'Message'
			}
		]

		this.state = { scrollToRowIndex: props.messages.length, expanded: [], filters: {}, rows: this.createRows(props.messages)}
	}

	componentWillReceiveProps(newProps){
		this.setState({rows:this.createRows(newProps.messages), filters: this.state.filters})
	}

	createRows(data) {
		let rows = []

		if(data) {
			_.forEach(data, (message, i) => {

				let r = {
					timestamp: moment(message.timestamp).fromNow(),
					username: message.username,
					message: message.message, /*ReactHtmlParser(convert.toHtml(message.message))*/
				}
				rows.push(r)
			})
		}

		return rows
	}

	getRows(i){
		return this.state.rows[i]
	}

	handleFilterChange(filter){
		let newFilters = Object.assign({}, this.state.filters)
		console.log('values are ', filter)

		if (filter.filterTerm) {
			newFilters[filter.column.key] = filter;
		} else {
			delete newFilters[filter.column.key];
		}
		this.setState({ filters: newFilters });
	}

	getValidFilterValues(columnId){
		let values = this.state.rows.map(r => r[columnId]);
		return values.filter((item, i, a) => { return i === a.indexOf(item); });
	}

	handleOnClearFilters(){
		this.setState({ filters: {} });
	}

	onModalClose(){
		this.setState({selected: null})
	}
	render() {

		// now use the new TreeTable component
		return (<div>

			<ReactDataGrid
				ref={(e) => this.grid = e}
				columns={this._columns}
				rowGetter={this.getRows}
				rowsCount={this.state.rows.length}
				minHeight={200}
				onAddFilter={this.handleFilterChange}
				getValidFilterValues={this.getValidFilterValues}
			    scrollToRowIndex={this.state.rows.length+1}
				onClearFilters={this.handleOnClearFilters}/>
			{/*
			<Modal show={this.state.showModal} onClose={this.onModalClose}>{this.state.selected}</Modal>
*/}
			{
				this.state.selected
			}

		</div>)
	}
}

ChatLog.defaultProps ={
	messages: [],
}

ChatLog.propTypes = {
	id: PropTypes.string,
	messages: PropTypes.array,
	expanded: PropTypes.string
}


export default ChatLog
