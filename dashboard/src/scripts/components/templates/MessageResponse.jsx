import React, { Component } from 'react'
import PropTypes from 'prop-types'
import _ from 'lodash'
import Panel from 'muicss/lib/react/panel'
import Container from 'muicss/lib/react/container'
import Button from 'muicss/lib/react/button'
import AutoSizer from 'react-virtualized/dist/commonjs/AutoSizer'
import styles from '../cellmeasurer.css';
import moment from 'moment'
import ReactTable from 'react-table'
import {PivotValue} from 'react-table/'
import 'react-table/react-table.css'

function parseJson(str){
	return _.attempt(JSON.parse.bind(null, str));
}
function isJSON(str) {
	return !_.isError(_.attempt(JSON.parse, str));
}
export class MessageResponse extends Component {
	constructor(props, context){
		super(props, context)

		this.state = {
			error: null,
			sortBy: 'timestamp'
		}

	}

	componentWillReceiveProps() {
	}

	componentDidMount(){
	}
	render(){
		const {responseMessage, id} = this.props
		let pivotKeys = []
		if(responseMessage){

			let columns = []
			//create columns
			_.forEach(_.head(responseMessage), function(value, key) {
				if(_.isObject(value)){
/*					columns.push({
						Header: () => "Expand",
						columns:[]
					})*/
					columns.push({
						expander: true,
						Header: () => <strong>{key}</strong>,
						accessor: value,
						id: key,
						width: 500,
						Expander: ({isExpanded, ...rest}) =>{
							return <div>
								{isExpanded
									? <MessageResponse responseMessage={[rest.column.accessor]}/>
									: <span>&#x2295;</span>}
							</div>
						}
					})
				} else {
					columns.push({
						Header: key,
						id:key,
						accessor: d => {
							if (_.isString(d[key])) return d[key]
							return "-"
						}
					})
				}

			})
			return (<div>
				<ReactTable
					data={responseMessage}
					columns={columns}
					/>
			</div>)
		} else {
			return null
		}
	}
}
export default MessageResponse
