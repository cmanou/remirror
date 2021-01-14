import React, { FC, useEffect } from 'react';
import { CalloutExtension, CalloutOptions } from 'remirror/extension/callout';
import { RemirrorProvider, useManager, useRemirror } from 'remirror/react';

export default { title: 'Callout extension' };

const SmallEditor: FC = () => {
  const { getRootProps, setContent, commands } = useRemirror();

  useEffect(() => {
    setContent({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'some text',
            },
          ],
        },
        {
          type: 'callout',
          attrs: {
            type: 'info',
          },
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'callout text',
                },
              ],
            },
          ],
        },
      ],
    });
  }, [setContent, commands]);

  return <div {...getRootProps()} />;
};

export const Basic = (args: CalloutOptions) => {
  const extensionManager = useManager([new CalloutExtension(args)]);

  return (
    <RemirrorProvider manager={extensionManager}>
      <SmallEditor />
    </RemirrorProvider>
  );
};
Basic.args = {
  defaultType: 'info',
  supportedTypes: ['info', 'error'],
};
