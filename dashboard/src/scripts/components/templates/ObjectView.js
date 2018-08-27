import React, { Component } from 'react'
import { connect } from 'react-redux'

import _ from 'lodash'
import _isEqual from 'lodash/isEqual'
import Button	from 'muicss/lib/react/button'
import Col from 'muicss/lib/react/col'
import Container from 'muicss/lib/react/container'
import Row from 'muicss/lib/react/row'
import Panel from 'muicss/lib/react/panel'
import Divider from 'muicss/lib/react/divider'
import PropTypes from 'prop-types'

import Parameter from '../templates/Parameter'
import {formatToEditableObject, formatToExportedObject} from '../../utils'
/*

 value={value}
 label={'Value'}
 name={field}
 onChange={this.onValueChange}
 placeholder={`Enter a value ({ ${field}: ??? })`}
 disabled={disabled || _.includes(lock, 'value')}
 required
 */

class ObjectView extends Component {
	constructor (props) {
		super(props)
		this.state = {
			value: props.value || {},
			editableObjArr: formatToEditableObject(props.value) || [],
			showAddForm: false
		}

		this.onValueChange = this.onValueChange.bind(this)
	}

	componentDidUpdate(prevProps){
		if(!_isEqual(this.props.value, prevProps.value))
			this.setState({editableObjArr: formatToEditableObject(this.props.value)})

	}

	onValueChange (e) {
		//from redux immutable update patterns (https://redux.js.org/recipes/structuring-reducers/immutable-update-patterns#updating-an-item-in-an-array)
		const {index, field, type, value} = e
		let editableObjArr = _.cloneDeep(this.state.editableObjArr)
		if(!_.has(editableObjArr, index))
			editableObjArr = editableObjArr.concat([[field,type,value]])
		else {
			if(field) editableObjArr[index][0] = field
			if(type) editableObjArr[index][1] = type
			if(value) editableObjArr[index][2] = value
		}
		console.log('new editable obj arr', e, editableObjArr)

		const nextValue = formatToExportedObject(editableObjArr)
		console.log('new update', nextValue)
		this.props.onChange(nextValue)
	}

	onCancelNew(){
		this.setState({showAdd: false})
	}

	render () {
		if(!_.isObject(this.props.value)) return null

		const newField = () => {
			if(this.props.disabled || this.props.editable) return null
			if(!this.state.showAddForm) return (<Button onClick={(e) => this.setState({showAdd: true})}>Add</Button>)

			return(
				<Row>
					<Col md={12}>
						<Parameter
							editMode={true}
							isNew={true}
							label={`New`}
							index={_.size(this.state.editableObjArr)+1}
							parentField={this.props.parentField}
							field={''}
							type={''}
							value={''}
							editable={this.props.editable}
							disabled={!this.props.disabled}
							onSave={this.onValueChange}
							onDelete={this.onCancelNew}
						/>
					</Col>
				</Row>
			)
		}
		return (<Panel>
				<div className="mui--text-caption">Data for: {this.props.parentField}</div>
				<Divider/>
				{_.map(this.state.editableObjArr, ([key,type,value], index) =>

					(<Parameter
						key={`${this.props.field}-${index}`}
						label={`obj-${index}`}
						index={index}
						parentField={this.props.parentField}
						field={key}
						type={type}
						value={value}
						editable={this.props.editable}
						disabled={!this.props.disabled}
						onSave={(e) => this.onValueChange(e)}
					/>)
				)}
				{newField()}
			</Panel>
		)
	}
}
/*<Row className="mui-panel" key={`r-${index}`}>
 <Col md={5}>
 <Input
 onChange={(e) => this.onFieldChange(e, index)}
 name={`key-${index}`}
 value={key}
 label={`Key ${index}`}
 required />
 </Col>
 <Col md={6}>
 <Input
 onChange={(e) => this.onValueChange(e, index)}
 name={`value-${index}`}
 value={value}
 label={`Value for ${key}`}
 required />
 </Col>
 <Col md={1}>
 <Button size="small" onClick={(e) => this.deleteRow(e)} color={'danger'} variant={'flat'}><i	className="fa fa-trash"/></Button>
 </Col>
 </Row>*/
ObjectView.defaultProps = {
	disabled: false,
	editable: false,
}

ObjectView.propTypes = {

	parentField: PropTypes.string,
	field: PropTypes.string.isRequired,
	value: PropTypes.any.isRequired,

	onChange: PropTypes.func.isRequired,
	editable: PropTypes.bool,
	disabled: PropTypes.bool,
}
export default ObjectView
