import React from 'react';
import PropTypes from 'prop-types';

const MyComponent = ({ className, notInPropTypes, anotherWithDefault = 123 }) => {
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
