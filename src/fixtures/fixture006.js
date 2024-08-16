import React from 'react';
import PropTypes from 'prop-types';

function MyComponent({ className }) {
	return <div className={className}></div>;
}

MyComponent.propTypes = {
	someObject: PropTypes.arrayOf(PropTypes.shape({
		key: PropTypes.string,
	})),
};
