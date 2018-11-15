// @flow

import UICommand from './ui/UICommand';
import noop from './noop';
import nullthrows from 'nullthrows';
import toggleHeading from './toggleHeading';
import {EditorState, Selection} from 'prosemirror-state';
import {EditorView} from 'prosemirror-view';
import {HEADING, LIST_ITEM, PARAGRAPH} from './NodeNames';
import {LINE_SPACING_VALUES} from './ParagraphNodeSpec';
import {Schema} from 'prosemirror-model';
import {TextSelection} from 'prosemirror-state';
import {Transform} from 'prosemirror-transform';
import {findParentNodeOfType} from 'prosemirror-utils';
import {setBlockType} from 'prosemirror-commands';

export function setTextLineSpacing(
  tr: Transform,
  schema: Schema,
  lineSpacing: ?string,
): Transform {
  const {selection, doc} = tr;
  if (!selection || !doc) {
    return tr;
  }
  const {from, to, empty} = selection;

  const paragraph = schema.nodes[PARAGRAPH];
  const heading = schema.nodes[HEADING];
  const listItem = schema.nodes[LIST_ITEM];
  if (!paragraph && !heading && !listItem) {
    return tr;
  }

  const tasks = [];
  const lineSpacingValue = lineSpacing || null;

  doc.nodesBetween(from, to, (node, pos, parentNode) => {
    const nodeType = node.type;
    if (
      nodeType === paragraph ||
      nodeType === heading ||
      nodeType === listItem
    ) {
      const lineSpacing = node.attrs.lineSpacing || null;
      if (lineSpacing !== lineSpacingValue) {
        tasks.push({
          node,
          pos,
          nodeType,
        });
      }
      return (nodeType === listItem) ? true : false;
    }
    return true;
  });

  if (!tasks.length) {
    return tr;
  }

  tasks.forEach(job => {
    const {node, pos, nodeType} = job;
    let attrs;
    if (lineSpacingValue) {
      attrs = {
        ...attrs,
        lineSpacing: lineSpacingValue,
      };
    } else {
      attrs = {
        ...attrs,
        lineSpacing: null,
      };
    }
    tr = tr.setNodeMarkup(
      pos,
      nodeType,
      attrs,
      node.marks,
    );
  });

  return tr;
}



function createGroup(): Array<{[string]: TextLineSpacingCommand}> {
  const group = {};
  group['default'] = new TextLineSpacingCommand(null);

  LINE_SPACING_VALUES.forEach((lineSpacing) => {
    group[` ${lineSpacing} `] = new TextLineSpacingCommand(lineSpacing);
  });
  return [group];
}

class TextLineSpacingCommand extends UICommand {

  _lineSpacing: ?string;

  static createGroup = createGroup;

  constructor(lineSpacing: ?string) {
    super();
    this._lineSpacing = lineSpacing;
  }

  isActive = (state: EditorState): boolean => {
    const {selection, doc, schema} = state;
    const {from, to} = selection;
    const paragraph = schema.nodes[PARAGRAPH];
    const heading = schema.nodes[HEADING];
    let keepLooking = true;
    let active = false;
    doc.nodesBetween(from, to, (node, pos) => {
      const nodeType = node.type;
      if (
        keepLooking &&
        (nodeType === paragraph || nodeType === heading) &&
        node.attrs.lineSpacing === this._lineSpacing
      ) {
        keepLooking = false;
        active = true;
      }
      return keepLooking;
    });
    return active;
  };

  isEnabled = (state: EditorState): boolean => {
    const {selection} = state;
    return (selection instanceof TextSelection);
  };

  execute = (
    state: EditorState,
    dispatch: ?(tr: Transform) => void,
    view: ?EditorView,
  ): boolean => {
    const {schema, selection} = state;
    const tr = setTextLineSpacing(
      state.tr.setSelection(selection),
      schema,
      this._lineSpacing,
    );
    if (tr.docChanged) {
      dispatch && dispatch(tr.scrollIntoView());
      return true;
    } else {
      return false;
    }
  };
}

export default TextLineSpacingCommand;