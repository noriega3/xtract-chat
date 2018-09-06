export default class ServerStatus extends React.Component {

	constructor(props, context) {
		super(props, context)

		const { chatHistory } = props

		this.state = {
			chatHistory,
			input: ''
		}

		this.updateChatHistory = this.updateChatHistory.bind(this)
		this.onMessageReceived = this.onMessageReceived.bind(this)
		this.onSendMessage = this.onSendMessage.bind(this)
	}

	componentDidMount() {
		this.props.registerHandler(this.onMessageReceived)
	}

	componentDidUpdate() {
		this.scrollChatToBottom()
	}

	componentWillUnmount() {
		this.props.unregisterHandler()
	}

	updateChatHistory(entry) {
		this.setState({ chatHistory: this.state.chatHistory.concat(entry) })
	}

	onMessageReceived(entry) {
		this.updateChatHistory(entry)
	}

	onSendMessage() {
		if (!this.state.input)
			return

		this.props.onSendMessage(this.state.input, (err) => {
			if (err)
				return console.error(err)

			return this.setState({ input: '' })
		})
	}
}
