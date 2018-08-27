import React, { Component } from 'react'
import ReactDOM from 'react-dom'
import PropTypes from 'prop-types'
import LazyLoad from 'react-lazyload';
import Button from 'muicss/lib/react/button'
import Panel from 'muicss/lib/react/panel'
import Textarea from 'muicss/lib/react/textarea'
import Divider from 'muicss/lib/react/divider'
import Form from 'muicss/lib/react/form'
import Input from 'muicss/lib/react/input'
import Container from 'muicss/lib/react/container';
import DropdownItem from 'muicss/lib/react/dropdown-item';
import Row from 'muicss/lib/react/row';
import Col from 'muicss/lib/react/col';
import {toString} from 'lodash/string'

import BoldHighlighter from "./BoldHighlighter.jsx" //AutoComplete
import ResultItem from './ResultItem'

const KEY_ENTER = 13
const MIN_CHARS = 2

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
import { forceCheck } from 'react-lazyload';

export class ResultList extends Component {
	constructor(props) {
		super(props)
		this.handleOnSelect = this.handleOnSelect.bind(this)
	}

	//transfers click to AutoComplete
	handleOnSelect(value, label){
		this.props.onSelect(value, label)
	}

	render() {
		const {data, query, nextCursor} = this.props

		//Generate the list and using lazy load to ensure some performance with large sets

		console.log('next cursor is ', nextCursor)

		return (<div className={"list list-container"}>
			<div className="ScrollableContainer wrapper overflow-wrapper">
				<div className="widget-list overflow">
					<div className="mui--text-caption">Showing search results for: {query}</div>
					<Divider />
					{this.props.data.map(([value,label], index) => {
						return (
							<LazyLoad key={index} height={30} overflow>
								<ResultItem id={label} value={value} query={this.props.query} onSelect={this.handleOnSelect} />
							</LazyLoad>
						)
					})}
					{nextCursor > 0 &&
					<LazyLoad key={'cursor-' + nextCursor} height={30} overflow>
						<div id={'nextButton'}>
							<Button className={"buttonContainer"} onClick={() => this.handleOnSelect('NEXT_PAGE')}>Show More</Button>
						</div>
					</LazyLoad>}
				</div>
			</div>
		</div>)
	}
}

ResultList.defaultProps = {}

ResultList.propTypes = {
	data: PropTypes.array.isRequired,
	showResultList: PropTypes.bool.isRequired,
	query: PropTypes.any.isRequired,

	onSelect: PropTypes.func.isRequired,

	onKeyDown: PropTypes.func.isRequired,

	cursor: PropTypes.number,
	nextCursor: PropTypes.number
}

export default ResultList
