import React, {Component} from 'react'
import Panel from 'muicss/lib/react/panel'

/**
 * This handles any errors the component may generate at any given time (a catch all)
 */
class ErrorBoundary extends Component {
	constructor(props) {
		super(props)
		this.state = { hasError: false }
	}

	componentDidCatch(error, info) {
		this.setState({ hasError: true })

		if(info){
			console.log(info)
		}
		//TODO: send to a service or message to a server / slack / etc.
	}

	render() {
		if (this.state.hasError) {
			// You can render any custom fallback UI
			return <Panel>Something went wrong.</Panel>
		}
		return this.props.children
	}
}

export default ErrorBoundary
