import {
  bool,
  CommandFunction,
  findParentNodeOfType,
  isEqual,
  isObject,
  isString,
  NodeType,
  ProsemirrorAttributes,
} from '@remirror/core';

import type { CalloutAttributes } from './callout-types';

export const dataAttributeType = 'data-callout-type';

/**
 * Check that the attributes exist and are valid for the codeBlock
 * updateAttributes.
 */
export function isValidCalloutAttributes(
  attributes: ProsemirrorAttributes,
): attributes is CalloutAttributes {
  return bool(
    attributes && isObject(attributes) && isString(attributes.type) && attributes.type.length,
  );
}

/**
 * Updates the node attrs.
 *
 * This is used to update the type of the callout.
 */
export function updateNodeAttributes(type: NodeType) {
  return (attributes: CalloutAttributes): CommandFunction => ({
    state: { tr, selection },
    dispatch,
  }) => {
    if (!isValidCalloutAttributes(attributes)) {
      throw new Error('Invalid attrs passed to the updateAttributes method');
    }

    const parent = findParentNodeOfType({ types: type, selection });

    if (!parent || isEqual(attributes, parent.node.attrs)) {
      // Do nothing since the attrs are the same
      return false;
    }

    tr.setNodeMarkup(parent.pos, type, { ...parent.node.attrs, ...attributes });

    if (dispatch) {
      dispatch(tr);
    }

    return true;
  };
}

interface GetTypeParameter {
  /**
   * The type input from the user;
   */
  type: string;

  /**
   * The default type to use if none found.
   */
  fallback: string;

  /**
   * The list of supported types, if not provided any type is allowed.
   */
  supportedTypes: string[];
}

/**
 * Get the type from user input.
 */
export function getType(parameter: GetTypeParameter): string {
  const { type, fallback, supportedTypes } = parameter;

  if (!type) {
    return fallback;
  }

  for (const name of supportedTypes) {
    if (name.toLowerCase() === type.toLowerCase()) {
      return name;
    }
  }

  return fallback;
}
