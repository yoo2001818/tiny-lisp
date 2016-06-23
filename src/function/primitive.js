import LambdaValue from '../value/lambda';
import NativeProcedureValue from '../value/nativeProcedure';
import NativeSyntaxValue from '../value/nativeSyntax';
import RealValue from '../value/number';
import BooleanValue from '../value/boolean';
import PairValue from '../value/pair';
import { SYMBOL, BOOLEAN, PAIR, CHARACTER } from '../value/value';

// Base library - Primitive functions that depend on native calls.

export default [
  // Other forms will be handled by define-syntax. :)
  new NativeSyntaxValue('define', (machine, frame) => {
    switch (frame.procTrack) {
    case 0:
      frame.bufferName = frame.expTrack.car;
      if (frame.bufferName.type !== SYMBOL) {
        throw new Error('Symbol expected, ' + frame.bufferName.inspect() +
          ' received');
      }
      machine.pushStack(frame.expTrack.cdr.car);
      break;
    case 1:
      machine.rootParameters[frame.bufferName.value] = frame.result;
      frame.result = new PairValue();
      return true;
    }
  }),
  new NativeSyntaxValue('set!', (machine, frame) => {
    switch (frame.procTrack) {
    case 0:
      frame.bufferName = frame.expTrack.car;
      if (frame.bufferName.type !== SYMBOL) {
        throw new Error('Symbol expected, ' + frame.bufferName.inspect() +
          ' received');
      }
      machine.pushStack(frame.expTrack.cdr.car);
      break;
    case 1: {
      let name = frame.bufferName.value;
      let value = frame.result;
      frame.result = new PairValue();
      let node = frame.scope;
      while (node != null) {
        if (node.car[name] != null) {
          node.car[name] = value;
          return true;
        }
        node = node.cdr;
      }
      if (machine.rootParameters[name] != null) {
        machine.rootParameters[name] = value;
      }
      return true;
    }}
  }),
  // define-syntax is processed by expander, so machine itself doesn't have to
  // process it at all.
  new NativeSyntaxValue('define-syntax',
    () => {
      // NOP
      return true;
    }
  ),
  new NativeSyntaxValue('lambda', (machine, frame) => {
    frame.result = new LambdaValue('_lambda_', frame.expTrack.cdr,
      frame.expTrack.car, frame.scope);
    return true;
  }),
  new NativeSyntaxValue('quote', (machine, frame) => {
    frame.result = frame.expTrack.car;
    return true;
  }),
  new NativeSyntaxValue('if', (machine, frame) => {
    switch (frame.procTrack) {
    case 0:
      machine.pushStack(frame.expTrack.car);
      frame.expTrack = frame.expTrack.cdr;
      break;
    case 1:
      if (frame.result.type === BOOLEAN && frame.result.value === true) {
        // Follow consequent!
        machine.jumpStack(frame.expTrack.car);
        return true;
      } else {
        // Follow alternate!
        if (frame.expTrack.cdr == null) {
          // Unspecified behavior.. What should I do?
          frame.result = new BooleanValue(false);
          return true;
        } else {
          machine.jumpStack(frame.expTrack.cdr.car);
          return true;
        }
      }
    }
  }),
  new NativeProcedureValue('begin', (_, list) => {
    let result = null;
    let node = list;
    while (node != null) {
      result = node.car;
      node = node.cdr;
    }
    return result;
  }),
  new NativeProcedureValue('symbol?', (_, list) => {
    return list.car && list.car.type === SYMBOL;
  }),
  new NativeProcedureValue('char?', (_, list) => {
    return list.car && list.car.type === CHARACTER;
  }),
  new NativeProcedureValue('pair?', (_, list) => {
    return list.car && list.car.type === PAIR;
  }),
  new NativeProcedureValue('null?', (_, list) => {
    if (list.car == null) return true;
    if (list.car.type !== PAIR) return false;
    return list.car.car == null && list.car.cdr == null;
  }),
  new NativeProcedureValue('list?', (_, list) => {
    return list.car && list.car.isList();
  }),
  new NativeProcedureValue('+', (_, list) => {
    let sum = 0;
    list.forEach(v => sum += v.value);
    return new RealValue(sum);
  }),
  new NativeProcedureValue('-', (_, list) => {
    let sum = list.car.value;
    list.cdr.forEach(v => sum -= v.value);
    return new RealValue(sum);
  }),
  // Because I hate WCDMA?
  new NativeProcedureValue('<=', (machine, list) => {
    return new BooleanValue(list.car.value <= list.cdr.car.value);
  }),
  new NativeProcedureValue('display', (machine, list) => {
    console.log(list.car);
    return new PairValue();
  })
];
