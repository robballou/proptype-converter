"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processFile = processFile;
const fs_1 = require("fs");
const main_1 = require("./main");
const ts = __importStar(require("typescript"));
const debug_1 = __importDefault(require("debug"));
const baseDebugger = (0, debug_1.default)('proptype-converter:file');
/**
 * Parse a TS/JS file for PropTypes
 */
async function processFile(fileName) {
    const d = baseDebugger.extend('processFile');
    d('reading file');
    const sourceFile = ts.createSourceFile(fileName, (0, fs_1.readFileSync)(fileName).toString(), ts.ScriptTarget.ES2015, true, ts.ScriptKind.JSX);
    d('file read', { wasSuccessful: Boolean(sourceFile) });
    if (!sourceFile) {
        console.error('No sourceFile');
        return null;
    }
    return await (0, main_1.processSourceFile)(sourceFile);
}
