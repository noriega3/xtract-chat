import React, { Component } from 'react'
import { connect } from 'react-redux'

import _ from 'lodash'
import _isEqual from 'lodash/isEqual'
import Button	from 'muicss/lib/react/button'
import Col from 'muicss/lib/react/col'
import Container from 'muicss/lib/react/container'
import Input from 'muicss/lib/react/input'
import Option from 'muicss/lib/react/option'
import Panel from 'muicss/lib/react/panel'
import Row from 'muicss/lib/react/row'
import Select from 'muicss/lib/react/select'
import PropTypes from 'prop-types'

import JsonView from '../templates/JsonView'
import ObjectView from '../templates/ObjectView'
import _debounce from 'lodash/debounce'

class UserKeyTypeValue extends Component {
	constructor (props) {
		super(props)

		this.state = {}
		this.onTypeChange = this.onTypeChange.bind(this)
		this.onFieldChange = this.onFieldChange.bind(this)
		this.onValueChange = this.onValueChange.bind(this)
	}

	renderItem () {
		const {path, type, field, disabled, value, lock, editable} = this.props
		switch (type) {
			case 'boolean':
				return <Select
					name={field}
					label={'Value'}
					value={_.isEqual(value, 'true')}
					onChange={this.onValueChange}
					disabled={!editable || disabled || _.includes(lock, 'value')}>
					<Option value="true" label="true"/>
					<Option value="false" label="false"/>
				</Select>
			case 'number':
				return <Input
					value={value}
					label={'Value'}
					type={'number'}
					name={field}
					onChange={this.onValueChange}
					placeholder={'Enter a value'}
					disabled={!editable || disabled || _.includes(lock, 'value')}
					required/>
			case 'json':
				return <JsonView
					parentField={field}
					value={value}
					label={'Value'}
					name={field}
					editable={editable}
					disabled={!editable || disabled || _.includes(lock, 'value')}
					onChange={this.onValueChange}
					placeholder={`Enter a value ({ ${field}: ??? })`}
					required/>
			case 'roomlist':
				return <Select
					name={field}
					label={'Value'}
					value={_.isEqual(value, 'true')}
					onChange={this.onValueChange}
					disabled={disabled || _.includes(lock, 'value')}>
					{_.map(this.props.isWebClient && this.props.subscriptions ||
						this.props.roomList, (option, i) =>
						(<Option key={i} value={option} label={option}/>))
					}
				</Select>
			case 'userid':
				return <Input
					value={value}
					label={'Value'}
					name={field}
					onChange={this.onValueChange}
					placeholder={`Enter a value ({ ${field}: ??? })`}
					disabled={!editable || disabled || _.includes(lock, 'value')}
					required/>
			case 'sessionId':
				return <Input
					value={value}
					label={'Value'}
					name={field}
					onChange={this.onValueChange}
					placeholder={`Enter a value ({ ${field}: ??? })`}
					disabled={!editable || disabled || _.includes(lock, 'value')}
					required/>
			case 'string':
				return <Input
					value={value}
					label={'Value'}
					name={field}
					onChange={this.onValueChange}
					placeholder={`Enter a value ({ ${field}: ??? })`}
					disabled={!editable || disabled || _.includes(lock, 'value')}
					required/>
			case 'object':
				console.log('objview selected', value, field)
				return <ObjectView
					parentField={field}
					value={value}
					field={field}
					onChange={this.onValueChange}
					editable={editable}
					disabled={disabled || _.includes(lock, 'value')}
					required/>
			case 'array':
				return <Input
					value={JSON.stringify(value)} label={'Value'} name={field}
					onChange={this.onValueChange}
					placeholder={`Enter a value ({ ${field}: ??? })`}
					disabled={disabled || _.includes(lock, 'value')}
					required/>
			default:
				return null
		}
	}

	formatValueByType(){

	}

	onTypeChange (e) {
		e.preventDefault()
		const {field, type, value} = this.props
		const nextType = _.get(e, 'target.value', '')
		if(_isEqual(type, nextType)) return null
		const nextValue = _.isEmpty(nextType) ? '' : value
		this.props.onChange({field, type: nextType, value: nextValue})
	}

	onFieldChange (e) {
		e.preventDefault()
		this.props.onChange({field: e.target.value})
	}

	onValueChange (e) {
		const {field, value, type, lock} = this.props
		const useEvent = _.isEqual(type, 'object') || _.isEqual(type, 'array') || _.isEqual(type, 'json')
		const isArray = _.isEqual(type, 'array')
		let newValue

		console.log('on value change', e, type )
		if (useEvent) {
			console.log('using this value now', e)
			newValue = e
			console.log('using this value as new value', newValue)
		} else
			newValue = _.get(e, 'target.value', '')

		this.props.onChange({value: newValue})
	}


	renderField(){
		const {field, type, lock, disabled, editable} = this.props
		return(
			<Input
			name={'custom-label'}
			label={`Field ${field}`}
			value={field}
			onChange={this.onFieldChange}
			placeholder={'Enter a field name ({ xxx: somevalue })'}
			disabled={editable || disabled || _.includes(lock, 'field')}
			required/>)
	}

	renderType(){
		const {field, type, lock, disabled, editable} = this.props
		return(
			<Select
			name="custom-type"
			label="Type"
			value={type}
			onChange={this.onTypeChange}
			disabled={!editable || disabled || _.includes(lock, 'type')}>
			<Option value="" label="Select a type"/>
			<Option value="string" label="String"/>
			<Option value="json" label="JSON"/>
			<Option value="number" label="Number"/>
			<Option value="boolean" label="Boolean"/>
			<Option value="roomlist" label="Room"/>
			<Option value="userId" label="UserId"/>
			<Option value="sessionId" label="sessionId"/>
			<Option value="object" label="object"/>
			<Option value="array" label="array"/>
		</Select>)
	}

	render () {
		const {field, type, lock, disabled, editable} = this.props
		let isValueRow = _.isEqual(type, '') ||_.isEqual(type, 'json') || _.isEqual(type, 'object') || _.isEqual(type, 'array')

		let colFieldNum = _.isEqual(type, '') ||_.isEqual(type, 'json') || _.isEqual(type, 'object') || _.isEqual(type, 'array') ? 6 : 4
		const colTypeNum = _.isEqual(type, '') ||_.isEqual(type, 'json') || _.isEqual(type, 'object') || _.isEqual(type, 'array') ? 6 : 4
		let colValNum = _.isEqual(type, '') ||_.isEqual(type, 'json') || _.isEqual(type, 'object') || _.isEqual(type, 'array') ? 12 : 4
		colFieldNum = !editable && colFieldNum < 6 ? 6 : colFieldNum
		colValNum = !editable && colValNum < 6 ? 6 : colValNum

		//figure out layout
		if(isValueRow){

			return(
				<Container>
					<Row>
						<Col md={6}>
							{this.renderField()}
						</Col>
						<Col md={6} className={`${editable ? 'mui--show' : 'mui--hide'}`}>
							{this.renderType()}
						</Col>
					</Row>
					<Row>
						<Col>
							{this.renderItem()}
						</Col>
					</Row>
			</Container>
			)

		}

		return (
			<Container>
				<Row>
					<Col md={4} sm={6}>
						{this.renderField()}
					</Col>
					<Col md={2} sm={6} className={`${editable ? 'mui--show' : 'mui--hide'}`}>
						{this.renderType()}
					</Col>
					<Col md={6} sm={12}>
						{this.renderItem()}
					</Col>
				</Row>
			</Container>
		)
	}
}

UserKeyTypeValue.defaultProps = {
	disabled: false,
	editable: false,
}

UserKeyTypeValue.propTypes = {

	field: PropTypes.string.isRequired,
	type: PropTypes.string.isRequired,
	value: PropTypes.any.isRequired,

	editable: PropTypes.bool,
	onChange: PropTypes.func,
	disabled: PropTypes.bool,
	isWebClient: PropTypes.bool,
}

const mapStateToProps = state => ({
	roomList: state.rooms.list,
	subscriptions: state.webClient.subscriptions,
})
export default connect(mapStateToProps)(UserKeyTypeValue)
