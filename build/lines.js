"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.semiColonLine = semiColonLine;
exports.indentLines = indentLines;
exports.getIndentLevel = getIndentLevel;
const debug_1 = __importDefault(require("debug"));
const baseDebugger = (0, debug_1.default)('proptype-converter:lines');
/**
 * Add a trailing semicolon where needed
 *
 * Also accounts for end-of-line-comments
 */
function semiColonLine(line) {
    if (line.trimStart().startsWith('/**') || line.trimEnd().endsWith('*/')) {
        return line;
    }
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
/** Indent the lines recursively */
function indentLines(lines, indentLevel = 1) {
    const d = baseDebugger.extend('indentLines');
    return lines.map((line) => {
        // a line is a string that may contain its own line breaks and we want
        // to indent those lines-within-a-line...
        let expandedLine = line.split('\n');
        if (expandedLine.length > 1) {
            // nested shape, we need to indent the last line and intent the middle lines by +1
            if (expandedLine[0].trimEnd().endsWith('{') &&
                expandedLine[expandedLine.length - 1].trimStart().startsWith('}')) {
                // current indent must be the indent of the first line plus what is passed into this function.
                let currentLineIndentLevel = getIndentLevel(expandedLine[0]) + indentLevel;
                d('starting indent', currentLineIndentLevel);
                expandedLine = expandedLine.map((nestedLine, index) => {
                    if (index === 0) {
                        if (nestedLine.endsWith('{')) {
                            d('increasing indent', nestedLine);
                            currentLineIndentLevel += 1;
                        }
                        return nestedLine;
                    }
                    if (nestedLine.trimStart().startsWith('}')) {
                        d('decreasing indent', nestedLine);
                        currentLineIndentLevel -= 1;
                    }
                    const actualIndentLevel = currentLineIndentLevel - getIndentLevel(nestedLine);
                    let modifiedLine = semiColonLine(`\t`.repeat(actualIndentLevel) + nestedLine);
                    if (nestedLine.trimEnd().endsWith('{')) {
                        d('increasing indent', nestedLine.trim(), getIndentLevel(nestedLine));
                        currentLineIndentLevel += 1;
                    }
                    return modifiedLine;
                });
            }
            else {
                return expandedLine
                    .map((eLine) => `\t`.repeat(indentLevel) + trimStartTabs(eLine))
                    .join('\n');
            }
            return expandedLine.join('\n');
        }
        d('single line', line);
        return semiColonLine(`\t`.repeat(indentLevel) + trimStartTabs(line));
    });
}
/**
 * Figure out the indent level of the line
 */
function getIndentLevel(line) {
    let count = 0;
    for (const character of line) {
        if (character === '\t') {
            count += 1;
        }
        else {
            break;
        }
    }
    return count;
}
function trimStartTabs(str) {
    return str.replace(/^\t+/, '');
}
