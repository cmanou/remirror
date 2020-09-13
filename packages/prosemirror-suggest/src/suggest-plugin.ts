import { Plugin } from 'prosemirror-state';

import { suggestPluginKey, SuggestState } from './suggest-state';
import type { EditorSchema, EditorState, Suggester } from './suggest-types';

/**
 * Get the state of the suggest plugin.
 *
 * @param state - the editor state.
 */
export function getSuggestPluginState(state: EditorState): SuggestState {
  return suggestPluginKey.getState(state);
}

/**
 * Add a new suggester or replace it if the name already exists in the existing
 * configuration.
 *
 * Will return a function for disposing of the added suggester.
 */
export function addSuggester<Schema extends EditorSchema = EditorSchema>(
  state: EditorState<Schema>,
  suggester: Suggester,
): () => void {
  return getSuggestPluginState(state).addSuggester(suggester);
}

/**
 * Remove a suggester if it exists. Pass in the name or the full suggester
 * object.
 */
export function removeSuggester<Schema extends EditorSchema = EditorSchema>(
  state: EditorState<Schema>,
  suggester: Suggester | string,
): void {
  return getSuggestPluginState(state).removeSuggester(suggester);
}

/**
 * This creates a suggest plugin with all the suggesters that you provide.
 *
 * The priority of the suggesters is the order in which they are passed into
 * this function.
 *
 * - `const plugin = suggest(two, one, three)` - Here `two` will be checked
 *   first, then `one` and then `three`.
 *
 * Only one suggester can match at any given time. The order and specificity of
 * the regex parameters help determines which suggester will be active.
 *
 * @param suggesters - a list of suggesters in the order they should be
 * evaluated.
 */
export function suggest<Schema extends EditorSchema = EditorSchema>(
  ...suggesters: Array<Suggester<Schema>>
): Plugin<SuggestState<Schema>, Schema> {
  // Create the initial plugin state for the suggesters.
  const pluginState = SuggestState.create(suggesters);

  return new Plugin<SuggestState<Schema>, Schema>({
    key: suggestPluginKey,

    // Handle the plugin view
    view: (view) => {
      // Initialize the state with the required view before it is used.
      pluginState.init(view);

      return {
        update: (view) => {
          // console.log('VIEW_UPDATE', { content: view.state.doc.textContent });
          return pluginState.changeHandler(view.state.tr, false);
        },
      };
    },

    state: {
      // Initialize the state
      init: () => {
        return pluginState;
      },

      // Apply changes to the state
      apply: (tr, _pluginState, _oldState, state) => {
        // console.log('APPLY', { content: tr.doc.textContent });
        return pluginState.apply({ tr, state });
      },
    },

    /** Append a transaction via the onChange handlers */
    appendTransaction: (_, __, state) => {
      const tr = state.tr;
      // console.log('APPEND_TRANSACTION', { content: tr.doc.textContent });

      // Run the transaction updater for the next selection.
      pluginState.updateWithNextSelection(tr);

      // Run the change handler.
      pluginState.changeHandler(tr, true);

      // Check if the transaction has been amended in any way.
      if (tr.docChanged || tr.steps.length > 0 || tr.selectionSet || tr.storedMarksSet) {
        pluginState.setLastChangeFromAppend();
        return tr;
      }

      return null;
    },

    props: {
      // Sets up a decoration (styling options) on the currently active
      // decoration
      decorations: (state) => {
        return pluginState.createDecorations(state);
      },
    },
  });
}
