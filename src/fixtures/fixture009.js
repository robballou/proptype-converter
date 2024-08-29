import React from 'react';
import PropTypes from 'prop-types';

const MyComponent = ({ className }) => {
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
