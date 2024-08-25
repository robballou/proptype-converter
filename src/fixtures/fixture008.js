import React from 'react';
import PropTypes from 'prop-types';

function MyComponent({ className }) {
	return <div className={className}></div>;
}

MyComponent.propTypes = {
	className: PropTypes.string.isRequired,
	optional: PropTypes.string,
	optionalFlag: PropTypes.bool,
};

MyComponent.defaultProps = {
	optional: 'default',
	optionalFlag: true,
};
