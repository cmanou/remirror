import {
  ApplySchemaAttributes,
  CommandFunction,
  extensionDecorator,
  ExtensionTag,
  findNodeAtSelection,
  GetAttributes,
  getMatchString,
  InputRule,
  isElementDomNode,
  isTextSelection,
  KeyBindings,
  NodeExtension,
  NodeExtensionSpec,
  nodeInputRule,
  omitExtraAttributes,
  toggleWrap,
} from '@remirror/core';
import { wrappingInputRule } from '@remirror/pm/inputrules';
import { TextSelection } from '@remirror/pm/state';

import type { CalloutAttributes, CalloutOptions } from './callout-types';
import { dataAttributeType, getType, updateNodeAttributes } from './callout-utils';

/**
 * Adds a callout to the editor.
 */
@extensionDecorator<CalloutOptions>({
  defaultOptions: {
    defaultType: 'info',
    supportedTypes: ['info', 'warning', 'error', 'success'],
  },
})
export class CalloutExtension extends NodeExtension<CalloutOptions> {
  get name() {
    return 'callout' as const;
  }

  readonly tags = [ExtensionTag.BlockNode];

  createNodeSpec(extra: ApplySchemaAttributes): NodeExtensionSpec {
    return {
      attrs: {
        ...extra.defaults(),
        type: { default: this.options.defaultType },
      },
      content: 'block*',
      defining: true,
      draggable: false,
      parseDOM: [
        {
          tag: `div[${dataAttributeType}]`,
          getAttrs: (node) => {
            if (!isElementDomNode(node)) {
              return false;
            }

            const type = node.getAttribute(dataAttributeType);
            const content = node.textContent;
            return { ...extra.parse(node), type, content };
          },
        },
      ],
      toDOM: (node) => {
        const { type, ...rest } = omitExtraAttributes(node.attrs, extra) as CalloutAttributes;
        const attributes = { ...extra.dom(node), ...rest, [dataAttributeType]: type };

        return ['div', attributes, 0];
      },
    };
  }

  createCommands() {
    return {
      /**
       * Toggle the callout at the current selection. If you don't provide the
       * type it will use the options.defaultType.
       *
       * If none exists one will be created or the existing callout content will be
       * lifted out of the callout node.
       *
       * ```ts
       * if (commands.toggleCallout.isEnabled()) {
       *   commands.toggleCallout({ type: 'success' });
       * }
       * ```
       */
      toggleCallout: (attributes: CalloutAttributes = {}): CommandFunction =>
        toggleWrap(this.type, attributes),

      /**
       * Update the callout at the current position. Primarily this is used
       * to change the type.
       *
       * ```ts
       * if (commands.updateCallout.isEnabled()) {
       *   commands.updateCallout({ type: 'error' });
       * }
       * ```
       */
      updateCallout: (attributes: CalloutAttributes): CommandFunction =>
        updateNodeAttributes(this.type)(attributes),
    };
  }

  /**
   * Create an input rule that converts text into a callout when typing triple
   * collon followed by a space.
   */
  createInputRules(): InputRule[] {
    return [
      wrappingInputRule(
        /^:::([\dA-Za-z]*) $/,
        this.type,
        (match) => {
          const type = getType({
            type: getMatchString(match, 1),
            fallback: this.options.defaultType,
            supportedTypes: this.options.supportedTypes,
          });

          return { type };
        },
        (match, node) => {
          const type = getType({
            type: getMatchString(match, 1),
            fallback: this.options.defaultType,
            supportedTypes: this.options.supportedTypes,
          });
          return node.attrs.type === type;
        },
      ),
    ];
  }

  /**
   * Create specific keyboard bindings for the callout.
   */
  createKeymap(): KeyBindings {
    return {
      Backspace: ({ dispatch, tr }) => {
        // Aims to stop merging callouts when deleting content in between
        const { selection } = tr;

        // If the selection is not empty return false and let other extension
        // (ie: BaseKeymapExtension) to do the deleting operation.
        if (!selection.empty) {
          return false;
        }

        const { $from } = selection;

        // If not at the start of current node, no joining will happen
        if ($from.parentOffset !== 0) {
          return false;
        }

        const previousPosition = $from.before($from.depth) - 1;

        // If nothing above to join with
        if (previousPosition < 1) {
          return false;
        }

        const previousPos = tr.doc.resolve(previousPosition);

        // If resolving previous position fails, bail out
        if (!previousPos?.parent) {
          return false;
        }

        const previousNode = previousPos.parent;
        const { node, pos } = findNodeAtSelection(selection);

        // If previous node is a callout, cut current node's content into it
        if (node.type !== this.type && previousNode.type === this.type) {
          const { content, nodeSize } = node;
          tr.delete(pos, pos + nodeSize);
          tr.setSelection(TextSelection.create(tr.doc, previousPosition - 1));
          tr.insert(previousPosition - 1, content);

          if (dispatch) {
            dispatch(tr);
          }

          return true;
        }

        return false;
      },
      Enter: ({ dispatch, tr }) => {
        const { selection } = tr;

        if (!isTextSelection(selection) || !selection.$cursor) {
          return false;
        }

        const { nodeBefore, parent } = selection.$from;

        if (!nodeBefore || !nodeBefore.isText || !parent.type.isTextblock) {
          return false;
        }

        const regex = /^:::([A-Za-z]*)?$/;
        const { text } = nodeBefore;
        const { textContent } = parent;

        if (!text) {
          return false;
        }

        const matchesNodeBefore = text.match(regex);
        const matchesParent = textContent.match(regex);

        if (!matchesNodeBefore || !matchesParent) {
          return false;
        }

        const [, matchedType] = matchesNodeBefore;

        const type = getType({
          type: matchedType,
          fallback: this.options.defaultType,
          supportedTypes: this.options.supportedTypes,
        });

        const pos = selection.$from.before();
        const end = pos + nodeBefore.nodeSize + 1; // +1 to account for the extra pos a node takes up

        tr.delete(pos, end);
        // TODO finish this

        if (dispatch) {
          dispatch(tr);
        }

        return true;
      },
    };
  }
}

declare global {
  namespace Remirror {
    interface AllExtensions {
      callout: CalloutExtension;
    }
  }
}
