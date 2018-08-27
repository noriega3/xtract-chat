import React, { Component, DOM } from 'react'
import PropTypes from 'prop-types'
import AutoSizer from 'react-virtualized/dist/commonjs/AutoSizer'
import { Column, List } from 'react-virtualized';
import _ from 'lodash';

const ROW_HEIGHT = 20

function parseJson(str){
		return _.attempt(JSON.parse.bind(null, str));
}

const modalStyle = {

}
const ulStyle = {
		margin: 0,
		listStyle: 'none',
}

export class JsonTreeTable extends Component {

		constructor(props){
				super(props)
				this.state = {
						processed: []
				}
		}

		componentDidMount(){
				//format object to arr of items
				const toArrayWithKey = (obj) => _.values(_.mapValues(obj, (value, key) => {
						if(_.isString(value) || _.isNumber(value)){
								return {name: key +": "+ value, children:[], expanded:false}
						} else if((_.isPlainObject(value) || _.isArray(value)) && _.values(value)){
								return {name: key +":",children: toArrayWithKey(value), expanded:true}
						} else {
								return {name: key +": "+ value, children:[], expanded:false}
						}
				}))

				this.setState({processed: toArrayWithKey(this.props.data)})
		}

		render(){

				let Lst;

				function renderItem(item, keyPrefix) {
						var onClick = function(event) {
								event.stopPropagation();
								item.expanded = !item.expanded;
								Lst.recomputeRowHeights();
								Lst.forceUpdate();
						};

						var props = {key: keyPrefix};
						var children = [];
						var itemText;

						if (item.expanded) {
								props.onClick = onClick;
								itemText = '[-] ' + item.name;
								children = item.children.map(function(child, index) {
										return renderItem(child, keyPrefix + '-' + index);
								});
						} else if (item.children.length) {
								props.onClick = onClick;
								itemText = '[+] ' + item.name;
						} else {
								itemText = '    ' + item.name;
						}

						let liStyle = {
								justifyContent: 'center',
								whiteSpace: 'pre',
								userSelect: 'none',
								cursor: item.children.length ? 'pointer' : 'auto',
						}

						children.unshift(<div key={item.name} style={liStyle} onClick={props.onClick}>{itemText}</div>)

						return (
						<ul style={ulStyle} key={item.name}>
								<li style={liStyle} key={keyPrefix}>{children}</li>
						</ul>)
				}

				function getExpandedItemCount(item) {
						var count = 1;

						console.log(item)

						if (item.expanded) {
								count += item.children.map(getExpandedItemCount).reduce(function(total, count){ return total + count;}, 0);
						}

						return count;
				}

				function cellRenderer(params) {
						var renderedCell = renderItem(this.state.processed[params.index], params.index);
						return (<ul key={params.key} style={ulStyle}>{renderedCell}</ul>)
				}

				function getRowHeight(params) {
						return getExpandedItemCount(this.state.processed[params.index]) * ROW_HEIGHT;
				}

				function setRef(ref) {
						Lst = ref;
				}


				return(
				<AutoSizer defaultWidth={500} defaultHeight={600} style={modalStyle}>
						{({width, height}) => (
						<List
						height={height}
						overscanRowCount={10}
						ref={setRef}
						rowHeight={getRowHeight}
						rowRenderer={cellRenderer}
						rowCount={this.state.processed.length}
						width={width}
						/>)}
				</AutoSizer>
				)

		}
}

JsonTreeTable.defaultProps = {
		data: {},
}

JsonTreeTable.propTypes = {
		data: PropTypes.object,
}

export default JsonTreeTable
