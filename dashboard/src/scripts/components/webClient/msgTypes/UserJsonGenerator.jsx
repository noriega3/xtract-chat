import React, {Component} from 'react';
import PropTypes from 'prop-types';
import Panel from 'muicss/lib/react/panel';
import Form from 'muicss/lib/react/form';
import Input from 'muicss/lib/react/input';
import Button from 'muicss/lib/react/button';
import _ from 'lodash'
import ToggleTextArea from '../../templates/ToggleTextArea'
import UserKeyTypeValue from "../../templates/UserKeyTypeValue";
import Container from 'muicss/lib/react/container';
import Row from 'muicss/lib/react/row';
import Col from 'muicss/lib/react/col';
import Divider from 'muicss/lib/react/divider';

const formatValue = ({type, value, name=""}) => {
	switch(type){
		case 'number':
			return value && _.toNumber(value)
		case 'boolean':
			return _.isEqual(value, "true")
		default:
			if(_.isEmpty(value)) return console.error(`Value is empty! Val: ${value} | Type: ${type} | Field: ${name}`)
			return !_.isEmpty(value) && _.toString(value)
	}
}

class UserJsonGenerator extends Component {
	constructor(props){
		super(props)
		this.state = {
			prependValue: "__JSON__START__",
			appendValue: "__JSON__END__",
			rootElements: props.rootElements,
			paramElements: props.paramElements,
			isWebClient: props.isWebClient
		}

		this.onPrependChange = this.onPrependChange.bind(this)
		this.onAppendChange = this.onAppendChange.bind(this)

		this.onRootElementAdd = this.onRootElementAdd.bind(this)
		this.onRootElementChange = this.onRootElementChange.bind(this)
		this.onRootElementRemove = this.onRootElementRemove.bind(this)

		this.onParamElementAdd = this.onParamElementAdd.bind(this)
		this.onParamElementChange = this.onParamElementChange.bind(this)
		this.onParamElementRemove = this.onParamElementRemove.bind(this)
		this.handleOnSubmit = this.handleOnSubmit.bind(this)
		this.onMessageChange = _.debounce(props.onMessageChange, 250, { 'maxWait': 1000 })

	}

	componentWillUnmount(){
		if(this.onMessageChange){
			this.onMessageChange.cancel()
		}
	}

	jsonMessage(){
		const nextState = this.state
		const prependValue = nextState.prependValue
		const appendValue = nextState.appendValue
		const rootElements = nextState.rootElements
		const paramElements = nextState.paramElements
		let newJsonObject = {}
		let newJsonMessage, strJson
		const fieldsList = [rootElements, paramElements]
		for(let f = 0; f < fieldsList.length; f++){
			const elementsList = fieldsList[f]
			const prePath = f === 1 ? 'params.' : ''
			for (let ele of elementsList){
				const formattedVal = formatValue(ele)
				_.set(newJsonObject, `${prePath}${ele.field}`, formattedVal)
			}
		}
		strJson = JSON.stringify(newJsonObject, null, 2)
		newJsonMessage = `${prependValue}${strJson}${appendValue}`

		this.onMessageChange(newJsonMessage, strJson)
		return newJsonMessage
	}

	onRootElementAdd(e){
		e.preventDefault()
		const rootElements = _.uniqBy(this.state.rootElements.concat({field:"", type:"", value:"", showEditor: true}), 'field')
		this.setState({rootElements})
	}

	onRootElementChange(index, newData){
		let rootElements = _.cloneDeep(this.state.rootElements)
		rootElements[index] = newData
		this.setState({rootElements})
	}
	onRootElementRemove(data){
		const rootElements = _.without(this.state.rootElements, data)
		this.setState({rootElements})
	}

	onParamElementAdd(e){
		e.preventDefault()
		const paramElements = _.uniqBy(this.state.paramElements.concat({field:"", type:"", value:"", showEditor: true}), 'field')
		this.setState({paramElements})
	}

	onParamElementChange(index, newData){
		const paramElements = _.cloneDeep(this.state.paramElements)
		paramElements[index] = newData

		this.setState({paramElements})
	}
	onParamElementRemove(data){
		const paramElements = _.without(this.state.paramElements, data)
		this.setState({paramElements})
	}

	onPrependChange(e){
		this.setState({prependValue: e.target.value})
	}

	onAppendChange(e){
		this.setState({appendValue: e.target.value})
	}

	handleOnSubmit(e){
		e.preventDefault()
	}

	render() {
		return (
				<Form onSubmit={this.onSubmit}>
					<Panel>
						<div className="mui--text-body2">Root Options</div>

						<fieldset name={"root"}>
							{_.map(this.state.rootElements, (ele,i) =>
								<Parameter key={'root-'+i} label={ele.field} value={ele.value} type={ele.type} showEditor={ele.showEditor}>
									<UserKeyTypeValue key={'root-'+i} index={i} data={ele} onChange={this.onRootElementChange} onDelete={this.onRootElementRemove} />
								</Parameter>
							)}
						</fieldset>
						<div className={"mui--text-center"}>
							<Button size={"small"} color={"primary"} onClick={this.onRootElementAdd}>Add Root Parameter</Button>
						</div>

						<div className="mui--text-body2">Parameter Options</div>

						<fieldset name={"params"}>
							{_.map(this.state.paramElements, (ele,i) =>
								<Parameter key={'param-'+i} label={ele.field} value={ele.value} type={ele.type} showEditor={ele.showEditor}>
									<UserKeyTypeValue key={'param-'+i} isWebClient={this.state.isWebClient} index={i} data={ele} onChange={this.onParamElementChange} onDelete={this.onParamElementRemove} />
								</Parameter>
							)}
						</fieldset>
						<div className={"mui--text-center"}>
							<Button size="small" color="primary" onClick={this.onParamElementAdd}>Add Params Parameter</Button>
						</div>

						<div className="mui--text-body2">Additional Options</div>

						<Parameter label={"Prepend to JSON"} value={this.state.prependValue}>
							<Input name={"_prepend"} placeholder="Value prepended to message" label={"Value"} value={this.state.prependValue} onChange={this.onPrependChange}/>
						</Parameter>

						<Parameter label={"Append to JSON"} value={this.state.appendValue}>
							<Input name={"_append"} placeholder="Value appended to message" label={"Value"} value={this.state.appendValue} onChange={this.onAppendChange}/>
						</Parameter>
					</Panel>
					<Panel>
						<ToggleTextArea value={this.jsonMessage()} show={true} label={"Output"} disabled={true}/>
					</Panel>
				</Form>
		)
	}
}
UserJsonGenerator.defaultProps = {
	rootElements: [],
	paramElements: [],
	onMessageChange: () => {},
	isWebClient: false
}

UserJsonGenerator.propTypes = {
	onMessageChange: PropTypes.func,
	paramElements: PropTypes.array,
	rootElements: PropTypes.array,
	isWebClient: PropTypes.bool
}

export default UserJsonGenerator

/******************************************************************************************/

class Parameter extends Component {
	constructor(props){
		super(props)
		this.state = {
			editorPanel: props.showEditor || false
		}
		this.toggleEditor = this.toggleEditor.bind(this)
		this.renderChildren = this.renderChildren.bind(this)
	}

	toggleEditor(e){
		e.preventDefault()
		this.setState({editorPanel: !this.state.editorPanel})
	}

	renderChildren() {
		return React.Children.map(this.props.children, child => {
			return React.cloneElement(child, {
				onToggle: this.toggleEditor
			})
		})
	}

	render() {
		const val = this.props.type === "boolean" && !this.props.value ? "false" : this.props.value
		return (
			<Container fluid={false}>
				<Row onClick={this.toggleEditor}>
					<Col md={3} className="mui--text-body2">
						{this.props.label} {!this.props.label && <i className={"fa fa-exclamation-triangle mui--text-danger"} title={"Field is empty!"} />}
					</Col>
					<Col md={3} className="mui--text-body1 mui--text-dark-secondary">
						{val} {!val && <i className={"fa fa-exclamation-triangle mui--text-danger"} title={"Value is empty!"} />}
					</Col>
				</Row>
				<Row><Col><Divider/></Col></Row>
				<Row>
					<Col className={this.state.editorPanel ? "mui--show" : "mui--hide"}>
						{this.state.editorPanel && this.renderChildren()}
					</Col>
				</Row>
			</Container>
		);
	}
}

Parameter.propTypes = {
  children: PropTypes.node,
  label: PropTypes.string,
  showEditor: PropTypes.bool,
  type: PropTypes.string,
  value: PropTypes.any
}
