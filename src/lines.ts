export function semiColonLine(line: string) {
	if (line.includes('// ')) {
		const [lineWithoutComment, comment] = line.split('//');
		if (!lineWithoutComment.trim().endsWith(';')) {
			return `${lineWithoutComment.trimEnd()}; // ${comment.trim()}`;
		}
		return line;
	}
	if (!line.endsWith(';') && !line.endsWith('{')) {
		return `${line};`;
	}
	return line;
}

export function indentLines(lines: string[], indentLevel = 1): string[] {
	return lines.map((line) => {
		// a line is a string that may contain its own line breaks and we want
		// to indent those lines-within-a-line...
		let expandedLine = line.split('\n');

		if (expandedLine.length > 1) {
			// nested shape, we need to indent the last line and intent the middle lines by +1
			if (
				expandedLine[0].trimEnd().endsWith('{') &&
				expandedLine[expandedLine.length - 1].trimStart().startsWith('}')
			) {
				let currentLineIndentLevel =
					getIndentLevel(expandedLine[0]) + indentLevel;
				expandedLine = expandedLine.map((nestedLine, index) => {
					if (index === 0) {
						return nestedLine;
					}
					let modifiedLine = semiColonLine(
						`\t`.repeat(currentLineIndentLevel) + nestedLine,
					);
					if (nestedLine.trimEnd().endsWith('{')) {
						currentLineIndentLevel += 1;
					} else if (nestedLine.trimStart().startsWith('}')) {
						currentLineIndentLevel -= 1;
					}
					return modifiedLine;
				});
			}
			return expandedLine.join('\n');
		}
		return semiColonLine(line);
	});
}

export function getIndentLevel(line: string) {
	let count = 0;
	for (const character of line) {
		if (character === '\t') {
			count += 1;
		} else {
			break;
		}
	}
	return count;
}
