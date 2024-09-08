import React from 'react';
import PropTypes from 'prop-types';

function MyComponent({ custom }) {
	return <div></div>;
}

MyComponent.propTypes = {
	custom: PropTypes.oneOf(['test', 'thing']),
	requiredThing: PropTypes.oneOf([0, 1, 2, 3, 4, 5]).isRequired,
};
