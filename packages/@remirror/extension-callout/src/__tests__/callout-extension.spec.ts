import { pmBuild } from 'jest-prosemirror';
import { extensionValidityTest, renderEditor } from 'jest-remirror';

import { fromHtml, toHtml } from '@remirror/core';
import { createCoreManager } from '@remirror/testing';

import { CalloutExtension } from '..';

extensionValidityTest(CalloutExtension);

describe('schema', () => {
  const { schema } = createCoreManager([new CalloutExtension()]);

  const { callout, doc, p } = pmBuild(schema, {});

  it('creates the correct dom node', () => {
    expect(toHtml({ node: callout(p('Hello friend!')), schema })).toMatchInlineSnapshot(`
      <div data-callout-type="info">
        <p>
          Hello friend!
        </p>
      </div>
    `);
  });

  it('parses the dom structure and finds itself', () => {
    const node = fromHtml({ schema, content: '<div data-callout-type="info">Hello friend!</div>' });
    const expected = doc(callout(p('Hello friend!')));

    expect(node).toEqualProsemirrorNode(expected);
  });
});

test('supports extra attributes', () => {
  const { schema } = createCoreManager([
    new CalloutExtension({ extraAttributes: { 'data-custom': 'hello-world' } }),
  ]);
  const { callout, p } = pmBuild(schema, {});

  expect(toHtml({ node: callout(p('friend!')), schema })).toMatchInlineSnapshot(`
    <div data-custom="hello-world"
         data-callout-type="info"
    >
      <p>
        friend!
      </p>
    </div>
  `);
});

function create() {
  const calloutExtension = new CalloutExtension();
  return renderEditor([calloutExtension]);
}

describe('commands', () => {
  const {
    add,
    view,
    nodes: { p, doc },
    attributeNodes: { callout },

    commands,
  } = create();

  describe('toggleCallout', () => {
    it('toggles the callout', () => {
      add(doc(p(`Make this a callout<cursor>`)));

      commands.toggleCallout({ type: 'error' });
      expect(view.dom.innerHTML).toMatchInlineSnapshot(`
        <div data-callout-type="error">
          <p>
            Make this a callout
          </p>
        </div>
      `);
      expect(view.state.doc).toEqualRemirrorDocument(
        doc(callout({ type: 'error' })(p('Make this a callout'))),
      );

      commands.toggleCallout({ type: 'error' });
      expect(view.dom.innerHTML).toMatchInlineSnapshot(`
        <p>
          Make this a callout
        </p>
      `);
      expect(view.state.doc).toEqualRemirrorDocument(doc(p('Make this a callout')));
    });

    it('toggles the default callout when no type is provided', () => {
      add(doc(p(`Make this a callout<cursor>`)));

      commands.toggleCallout();
      expect(view.dom.innerHTML).toMatchInlineSnapshot(`
        <div data-callout-type="info">
          <p>
            Make this a callout
          </p>
        </div>
      `);
      expect(view.state.doc).toEqualRemirrorDocument(
        doc(callout({ type: 'info' })(p('Make this a callout'))),
      );

      commands.toggleCallout();
      expect(view.dom.innerHTML).toMatchInlineSnapshot(`
        <p>
          Make this a callout
        </p>
      `);
      expect(view.state.doc).toEqualRemirrorDocument(doc(p('Make this a callout')));
    });

    it('toggles the using the configured defaultType callout', () => {
      const calloutExtension = new CalloutExtension({ defaultType: 'success' });
      const {
        add,
        view,
        nodes: { p, doc },
        attributeNodes: { callout },

        commands,
      } = renderEditor([calloutExtension]);

      add(doc(p(`Make this a callout<cursor>`)));

      commands.toggleCallout();
      expect(view.dom.innerHTML).toMatchInlineSnapshot(`
        <div data-callout-type="success">
          <p>
            Make this a callout
          </p>
        </div>
      `);
      expect(view.state.doc).toEqualRemirrorDocument(
        doc(callout({ type: 'success' })(p('Make this a callout'))),
      );
    });
  });

  describe('updateCallout', () => {
    it('updates the type', () => {
      add(doc(callout({ type: 'warning' })(p(`This is a callout<cursor>`))));

      commands.updateCallout({ type: 'error' });
      expect(view.dom.innerHTML).toMatchInlineSnapshot(`
        <div data-callout-type="error">
          <p>
            This is a callout
          </p>
        </div>
      `);
      expect(view.state.doc).toEqualRemirrorDocument(
        doc(callout({ type: 'error' })(p('This is a callout'))),
      );
    });

    it('errors when updating with an invalid type attributes', () => {
      add(doc(callout({ type: 'warning' })(p(`This is a callout<cursor>`))));

      expect(() => {
        // @ts-expect-error
        commands.updateCallout({ type: false });
      }).toThrow('Invalid attrs passed to the updateAttributes method');
    });
  });
});

describe('plugin', () => {
  const {
    add,
    nodes: { p, doc },
    attributeNodes: { callout },
  } = create();

  describe('Backspace', () => {
    it('should avoid merging callouts when they become immediate siblings', () => {
      const { state } = add(
        doc(
          callout({ type: 'error' })(p('Error callout')),
          p('<cursor>'),
          callout({ type: 'success' })(p('success callout')),
        ),
      ).press('Backspace');

      expect(state.doc).toEqualRemirrorDocument(
        doc(
          callout({ type: 'error' })(p('Error callout')),
          callout({ type: 'success' })(p('success callout')),
        ),
      );
    });

    it('should append the previous callout with the content after the cursor', () => {
      const { state } = add(
        doc(
          callout({ type: 'error' })(p('Error callout')),
          p('<cursor>To append'),
          callout({ type: 'success' })(p('Success callout')),
        ),
      ).press('Backspace');

      expect(state.doc).toEqualRemirrorDocument(
        doc(
          callout({ type: 'error' })(p('Error calloutTo append')),
          callout({ type: 'success' })(p('Success callout')),
        ),
      );
    });

    it('should merge immediate sibling callouts', () => {
      const { state } = add(
        doc(
          callout({ type: 'error' })(p('Error callout')),
          callout({ type: 'success' })(p('<cursor>Success callout')),
        ),
      ).press('Backspace');

      expect(state.doc).toEqualRemirrorDocument(
        doc(callout({ type: 'error' })(p('Error callout'), p('Success callout'))),
      );
    });

    it('should ignore range selections', () => {
      const { state } = add(
        doc(
          callout({ type: 'error' })(p('Error callout')),
          p('<start>Some content<end>'),
          callout({ type: 'success' })(p('Success callout')),
        ),
      ).press('Backspace');

      expect(state.doc).toEqualRemirrorDocument(
        doc(
          callout({ type: 'error' })(p('Error callout')),
          p(''),
          callout({ type: 'success' })(p('Success callout')),
        ),
      );
    });

    it('should ignore when there is nothing to merge with', () => {
      const { state } = add(
        doc(p('<cursor>'), callout({ type: 'success' })(p('Success callout'))),
      ).press('Backspace');

      expect(state.doc).toEqualRemirrorDocument(
        doc(p(''), callout({ type: 'success' })(p('Success callout'))),
      );
    });
  });

  describe('Space', () => {
    it('responds to space input rule', () => {
      const errorCallout = callout({ type: 'error' });
      const { state } = add(doc(p('<cursor>'))).insertText(':::error abc');

      expect(state.doc).toEqualRemirrorDocument(doc(errorCallout(p('abc'))));
    });

    it('responds to empty space input rule using the default type', () => {
      const infoCallout = callout({ type: 'info' });
      const { state } = add(doc(p('<cursor>'))).insertText('::: abc');

      expect(state.doc).toEqualRemirrorDocument(doc(infoCallout(p('abc'))));
    });

    it('does not match invalid regex', () => {
      const { state } = add(doc(p('<cursor>'))).insertText(':::123-__ ');

      expect(state.doc).toEqualRemirrorDocument(doc(p(':::123-__ ')));
    });

    it('use default type for non supported type', () => {
      const infoCallout = callout({ type: 'info' });
      const { state } = add(doc(p('<cursor>'))).insertText(':::abcde abc');

      expect(state.doc).toEqualRemirrorDocument(doc(infoCallout(p('abc'))));
    });

    it('keeps alias type name when supported', () => {
      const warningCallout = callout({ type: 'warning' });
      const { state } = add(doc(p('<cursor>'))).insertText(':::warning abc');

      expect(state.doc).toEqualRemirrorDocument(doc(warningCallout(p('abc'))));
    });
  });

  describe('Enter', () => {
    it('responds to `Enter` key press', () => {
      const errorCallout = callout({ type: 'error' });
      const { state } = add(doc(p('<cursor>')))
        .insertText(':::error')
        .press('Enter')
        .insertText('abc');

      expect(state.doc).toEqualRemirrorDocument(doc(errorCallout(p('abc'))));
    });

    it('uses default type when no type provided', () => {
      const infoCallout = callout({ type: 'info' });
      const { state } = add(doc(p('<cursor>')))
        .insertText(':::')
        .press('Enter')
        .insertText('abc');

      expect(state.doc).toEqualRemirrorDocument(doc(infoCallout(p('abc'))));
    });

    it('uses default language when given an invalid language', () => {
      const infoCallout = callout({ type: 'info' });
      const { state } = add(doc(p('<cursor>')))
        .insertText(':::invalid')
        .press('Enter')
        .insertText('abc');

      expect(state.doc).toEqualRemirrorDocument(doc(infoCallout(p('abc'))));
    });

    it('keeps alias type name when supported', () => {
      const warningCallout = callout({ type: 'warning' });
      const { state } = add(doc(p('<cursor>')))
        .insertText(':::warning')
        .press('Enter')
        .insertText('abc');

      expect(state.doc).toEqualRemirrorDocument(doc(warningCallout(p('abc'))));
    });
  });
});
