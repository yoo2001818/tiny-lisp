import BooleanValue from './value/boolean';
import CharacterValue from './value/character';
import RealValue from './value/number';
import PairValue from './value/pair';
import StringValue from './value/string';
import SymbolValue from './value/symbol';

import * as TOKENS from './tokenizer';

const LIST = Symbol('list');

const ROOT = Symbol('root');

function createStackEntry(type, bracketType, token) {
  return {
    head: null,
    tail: null,
    type, // Only list is supported for now..
    bracketType,
    comment: false, // Should next keyword be ignored?
    special: null, // QUOTE, QUASIQUOTE, etc
    con: 0, // Is . specified? 0 - No, 1 - Yes, it is, 2 - Yes, it did
    line: token && token.line,
    column: token && token.column
  };
}

const wrapSymbols = {
  [TOKENS.QUOTE]: 'quote',
  [TOKENS.QUASIQUOTE]: 'quasiquote',
  [TOKENS.UNQUOTE]: 'unquote',
  [TOKENS.UNQUOTE_SPLICING]: 'unquote-splicing',
  [TOKENS.SYNTAX]: 'syntax',
  [TOKENS.QUASISYNTAX]: 'quasisyntax',
  [TOKENS.UNSYNTAX]: 'unsyntax',
  [TOKENS.UNSYNTAX_SPLICING]: 'unsyntax-splicing'
};

// Wrap the data if special flag is on. COMMENT_IGNORE should be handled
// differently, though.
function wrapData(entry, data, token) {
  let symbol = wrapSymbols[entry.special];
  if (!symbol) return data;
  let symbolVal = new SymbolValue(symbol);
  if (token) {
    symbolVal.line = token.line;
    symbolVal.column = token.column;
  }
  let result = new PairValue(symbolVal, new PairValue(data));
  entry.special = null;
  return result;
}

// Pushes the data into the stack entry. Note that this doesn't push the data
// into the stack..
function pushData(entry, data, token) {
  if (entry.con === 2) {
    throw injectError(new Error('Finished pair cannot have more values'),
      token);
  }
  if (token) {
    data.line = token.line;
    data.column = token.column;
  }
  let wrappedData = wrapData(entry, data, token);
  if (entry.comment) {
    entry.comment = false;
    return;
  }
  if (entry.con === 1) {
    if (entry.tail == null) {
      // Welp, if tail is missing, head is missing too (of course)
      // I don't think this will ever be called..
      entry.head = entry.tail = new PairValue(null, wrappedData);
    } else {
      // If not, just attach the value.
      entry.tail.cdr = wrappedData;
    }
    entry.con = 2;
  } else {
    let pair = new PairValue(wrappedData, null);
    if (entry.tail == null) {
      // Welp, if tail is missing, head is missing too (of course)
      entry.head = entry.tail = pair;
    } else {
      // If not, just attach the value.
      entry.tail.cdr = pair;
      entry.tail = pair;
    }
  }
  if (token) {
    entry.head.line = token.line;
    entry.head.column = token.column;
  }
}

function injectError(error, token) {
  if (token) {
    error.line = token.line;
    error.column = token.column;
  }
  return error;
}

// Accepts tokens produced by tokenizer, performs syntax analysis and
// returns an AST (S-expression) processable by the interpreter.
export default function parse(tokens) {
  let stack = [createStackEntry(ROOT)];
  for (let i = 0; i < tokens.length; ++i) {
    let stackEntry = stack[stack.length - 1];
    let token = tokens[i];
    switch (token.type) {
    case TOKENS.LIST_START:
      stack.push(createStackEntry(LIST, token.value, token));
      break;
    case TOKENS.LIST_END:
      // Finalize the current stack..
      if (stack.length <= 1) {
        throw injectError(new Error('Unexpected list closing paren'), token);
      }
      if (stackEntry.con === 1) {
        throw injectError(
          new Error('List cannot be closed right after cdr specifier'), token);
      }
      if (stackEntry.bracketType !== token.value) {
        throw injectError(new Error('Bracket type does not match'), token);
      }
      // Pop the stack, and refer parent stack.
      stack.pop();
      pushData(stack[stack.length - 1], stackEntry.head || new PairValue(),
        stackEntry);
      break;
    case TOKENS.LIST_CON:
      if (stackEntry.con !== 0) {
        throw injectError(
          new Error('There can be only one cdr specifier in single list'),
          token);
      }
      stackEntry.con = 1;
      break;
    case TOKENS.IDENTIFIER:
      pushData(stackEntry, new SymbolValue(token.value), token);
      break;
    case TOKENS.STRING:
      pushData(stackEntry, new StringValue(token.value), token);
      break;
    case TOKENS.NUMBER:
      pushData(stackEntry, new RealValue(token.value), token);
      break;
    case TOKENS.BOOLEAN:
      pushData(stackEntry, new BooleanValue(token.value), token);
      break;
    case TOKENS.CHARACTER:
      pushData(stackEntry, new CharacterValue(token.value), token);
      break;
    case TOKENS.COMMENT_IGNORE:
      stackEntry.comment = true;
      break;
    case TOKENS.ABBERVIATION:
      if (stackEntry.special !== null) {
        throw injectError(new Error('Abberviation should not come twice'),
          token);
      }
      stackEntry.special = token.value;
      break;
    }
  }
  if (stack.length > 1) {
    throw injectError(new Error('List is not closed'),
      tokens[tokens.length - 1]);
  }
  return stack[0].head || new PairValue();
}
