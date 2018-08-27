import React from 'react';
import Enzyme, { mount } from 'enzyme'
import Adapter from 'enzyme-adapter-react-16';
import ConnectedHome, { Home } from './Home'; // Note the curly braces: grab the named export instead of default export
import renderer from 'react-test-renderer';

Enzyme.configure({ adapter: new Adapter() });

function setup() {
	const props = {
		isAdmin: jest.fn(),
		message: jest.fn()
	}

  const enzymeWrapper = mount(<Home {...props} />)

  return {
	  props,
	  enzymeWrapper
  }
}

describe('components', () => {
	describe('Header', () => {
		it('should render self and subcomponents', () => {
			const { enzymeWrapper } = setup();

      expect(enzymeWrapper.find('AdminToolbar')).toBe(true);

      expect(enzymeWrapper.find('h1').text()).toBe('todos')

      const todoInputProps = enzymeWrapper.find('TodoTextInput').props()
			expect(todoInputProps.newTodo).toBe(true)
			expect(todoInputProps.placeholder).toEqual('What needs to be done?')
		})

    it('should call addTodo if length of text is greater than 0', () => {
		const { enzymeWrapper, props } = setup()
		const input = enzymeWrapper.find('TodoTextInput')
		input.props().onSave('')
		expect(props.addTodo.mock.calls.length).toBe(0)
		input.props().onSave('Use Redux')
		expect(props.addTodo.mock.calls.length).toBe(1)
	})
	})
})

