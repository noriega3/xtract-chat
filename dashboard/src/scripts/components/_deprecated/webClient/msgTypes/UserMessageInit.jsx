import React, {Component} from 'react';
import PropTypes from 'prop-types';
import Tab from 'muicss/lib/react/tab';
import Panel from 'muicss/lib/react/panel';
import Form from 'muicss/lib/react/form';
import Radio from 'muicss/lib/react/radio';
import Select from 'muicss/lib/react/select';
import Option from 'muicss/lib/react/option';
import Input from 'muicss/lib/react/input';
import Button from 'muicss/lib/react/button';
import Textarea from 'muicss/lib/react/textarea';
import _ from 'lodash'
import ToggleTextArea from '../../templates/ToggleTextArea'

function isNumeric (x) {
	return ((typeof x === 'number' || typeof x === 'string') && !isNaN(Number(x)));
}

class UserMessageInit extends Component {
	constructor(props){
		super(props)
		this.defaults = {
			username: `Player${(_.random(12323,1000000, false))}A`,
			score: _.random(1000,1000000, false),
			avatar: _.random(0,100, false)
		}
	}

	componentDidMount(){
		this.onChange()
	}

	onChange(){
		const fieldset = this.fieldset
		if(!fieldset) return ""

		const prependValue = _.get(fieldset, 'elements._prepend.value', '__JSON__START__')
		const appendValue = _.get(fieldset, 'elements._append.value', '__JSON__END__')
		let newJsonObject = {}
		let newJsonMessage, strJson
		for (let {name, value, type} of fieldset.elements){
			if(_.startsWith(name, '_prepend') || _.startsWith(name, '_append')) continue
			if(name) newJsonObject[name] = isNumeric(value) || type === "number" ? _.toNumber(value) : value
		}
		strJson = JSON.stringify(newJsonObject, null, 2)
		newJsonMessage = `${prependValue}${strJson}${appendValue}`
		this.props.onMessageChange(newJsonMessage, strJson)
	}

	render() {
		return (
			<div>
				<Radio name="connectionType" label="Server" disabled />
				<Radio name="connectionType" label="User Id" defaultChecked={true} />
				<fieldset onChange={(e) => this.onChange(e)} ref={(e)=> this.fieldset = e}>
					<Input className={"mui--hide"} name={"_prepend"} type={"hidden"} value={"__INIT__"} />
					<Select name={"appName"} label={"App Name"} required>
						<Option value={"source"} label={"Source"} />
						<Option value={"slotsfreecasino"} label={"Slots Free Casino"} />
					</Select>
					<Select name={"userId"} label={"User ID"} required>
						<Option value={"50001"} label={"500001"} />
						<Option value={50000} label={"500002"} />
					</Select>
					<Input name={"username"} label={"Username"}  placeholder={"Player12323A"} defaultValue={this.defaults.username} />
					<Input name={"score"} label={"Score"} placeholder={0} type={"number"} defaultValue={this.defaults.score}/>
					<Input name={"avatar"} label={"Avatar"} placeholder={"n/a"} type={"number"} defaultValue={this.defaults.avatar}/>
					<Input name={"notifyDeviceToken"} label={"GCM Device Token"} placeholder={"n/a"} />
					<Input className={"mui--hide"} name={"_append"} type={"hidden"} value={"__ENDINIT__"} />
				</fieldset>
				<Panel>
					<ToggleTextArea value={this.props.message} show={true} label={"Output"} disabled={true}/>
				</Panel>
			</div>
		);
	}
}
UserMessageInit.defaultProps = {
	onMessageChange: () => {}
};

UserMessageInit.propTypes = {
	onMessageChange: PropTypes.func.isRequired
};

export default UserMessageInit;
