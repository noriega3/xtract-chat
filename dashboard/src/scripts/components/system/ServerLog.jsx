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

export class ServerLog extends Component {
	constructor(props) {
		super(props)

		this.createRows = this.createRows.bind(this)
		this.getRows = this.getRows.bind(this)
		this.handleFilterChange = this.handleFilterChange.bind(this)
		this.getValidFilterValues = this.getValidFilterValues.bind(this)
		this.handleOnClearFilters = this.handleOnClearFilters.bind(this)
		this.onRowClick = this.onRowClick.bind(this)
		this.onModalClose = this.onModalClose.bind(this)

		this._columns = [
			{
				key: 'id',
				name: 'ID',
				width: 50
			},
			{
				key: 'timestamp',
				name: 'Time',
				width: 175,
				sortable: true,
			},
			{
				key: 'app_name',
				name: 'Server',
				width: 150,
				filterable: true,
				sortable: true
			},
			{
				key: 'type',
				name: 'Type',
				width: 50,
				filterable: true,
				sortable: true
			},
			{
				key: 'message',
				name: 'Message',
				formatter: ({value}) => ReactHtmlParser(convertSummary.toHtml(value))
			}
		]

		this.state = { expanded: [], filters: {}, rows: this.createRows(props.messages)}
	}

	componentWillReceiveProps(newProps){
		if(!_.isEqual(newProps.messages.length, this.state.rows.length))
			this.setState({rows:this.createRows(newProps.messages), filters: this.state.filters})
	}

	createRows(data) {
		let rows = []

		if(data) {
			_.forEach(data, (message, i) => {
				let r = {
					id: i,
					timestamp: moment(message.timestamp, "YYYY-MM-DD hh:mm:ss a").format(moment.HTML5_FMT.DATETIME_LOCAL_SECONDS),
					app_name: message.app_name,
					type: message.type,
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

	onRowClick(rowIdx, row){
		if(rowIdx >= 0){
			this.setState({selected: <Modal show={true} onClose={this.onModalClose}>
					<ServerLogTree messages={[this.state.rows[rowIdx]]} />
				</Modal>})
		}
	}

	onModalClose(){
		this.setState({selected: null})
	}

	render() {

		// now use the new TreeTable component
		return (<div>

			<ReactDataGrid
				columns={this._columns}
				rowGetter={this.getRows}
				rowsCount={this.state.rows.length}
				minHeight={800}
				onRowClick={this.onRowClick}
				toolbar={<Toolbar enableFilter={true}/>}
				onAddFilter={this.handleFilterChange}
				getValidFilterValues={this.getValidFilterValues}
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
class ServerLogTree extends Component {

	fullMessage({message}){
		if(!message || !message.toString()) return null
		console.log(message)
		//';1m'
		//{message && ReactHtmlParser(convert.toHtml(message.toString()))}

		return ReactHtmlParser(convert.toHtml(message))
	}
	render() {
		const {messages, expanded} = this.props

		if(!messages) return null

		const serverNames = _.uniq(_.map(messages, 'app_name'))

		let columns = [
			{
				id: 'timeStamp',
				Header: 'Time',
				maxWidth: 175,
				accessor: (row) => row && moment(row.timestamp, "YYYY-MM-DD hh:mm:ss a").format(moment.HTML5_FMT.DATETIME_LOCAL_SECONDS),
				defaultSortDesc: true,
				filterable: false
			},
			{
				id: 'appName',
				Header: 'Server',
				accessor: 'app_name',
				maxWidth: 175,
				filterMethod: (filter, row) => {
					if (filter.value === "all") return true
					return filter.value === row[filter.id]
				},
				Filter: ({ filter, onChange }) =>{
					return <select
							onChange={event => onChange(event.target.value)}
							style={{ width: "100%" }}
							value={filter ? filter.value : "all"}>
							<option value="all">all</option>
							{serverNames && _.map(serverNames, (val) => {return (<option key={val} value={val}>{val}</option>)})}
						</select>
				}
			},
			{
				id: 'type',
				Header: 'Type',
				maxWidth: 50,
				accessor: 'type',
				filterMethod: (filter, row) => {
					if (filter.value === "all") return true
					return filter.value === row[filter.id]
				},
				Filter: ({ filter, onChange }) =>{
					return <select
						onChange={event => onChange(event.target.value)}
						style={{ width: "100%" }}
						value={filter ? filter.value : "all"}>
						<option value="all">all</option>
						<option value="out">out</option>
						<option value="err">err</option>
					</select>
				}
			},
			{
				Header: 'Message',
				id: 'message',
				filterable: false,
				sortable: false,
				accessor: d => d.message,
				Cell: ci => ReactHtmlParser(convertSummary.toHtml(ci.value))
			}
		]
		if(expanded){
			columns = [
				{
					id: expanded,
					accessor: (d) => {
						return 'object('+_.size(d)+')'
					}
				}
			]
		}

		// now use the new TreeTable component
		return (
			<div>
				<TreeTable
					key={this.props.id}
					data={messages}
					columns={columns}
					showPagination={false}
					showPaginationTop={false}
					showPaginationBottom={false}
					pageSize={messages.length}
					expanded={{0: true}}
					className="-striped -highlight"
					filterable={false}
					defaultFilterMethod={(filter, row) =>
						String(row[filter.id]) === filter.value}
					SubComponent={(row) => {

						if(!_.isObject(row.original)){
							return null
						}

						// a SubComponent just for the final detail
						const tblColumns = [
							{
								Header: 'Property',
								accessor: 'property',
								width: 100,
								Cell: (ci) => {
									return `${ci.value}:`
								},
								style:
									{
										backgroundColor: '#DDD',
										textAlign: 'right',
										fontWeight: 'bold'
									}
							},
							{Header: 'Value', accessor: 'value'},
						]
						const rowData = Object.keys(row.original).map((key) => {
							return {
								property: key,
								value: _.isObject(row.original[key]) ? <ServerLogTree id={key} expanded={key} messages={[row.original[key]]}/> : row.original[key].toString(),
							}
						});

						const messageStyle = {overflow: 'scroll'};
						return (<Fragment>
								<ReactTable
									key={this.props.id+'tbl'}
									data={rowData}
									columns={tblColumns}
									pageSize={rowData.length}
									showPagination={false}
									showPaginationTop={false}
									showPaginationBottom={false}
								/>
							<Panel style={messageStyle}>{this.fullMessage(row.original)}</Panel>
						</Fragment>);
					}}
				/>
			</div>
		)
	}
}

ServerLog.defaultProps ={
	messages: []
}

ServerLog.propTypes = {
	id: PropTypes.string,
	messages: PropTypes.array,
	expanded: PropTypes.string
}


export default ServerLog
