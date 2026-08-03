'use client';

import { useCallback } from 'react';

import { Inbox } from '@talkjs/react';
import type Talk from 'talkjs';

export const UserMessagesSection = () => {
  const syncConversation = useCallback((session: Talk.Session) => {
    const conversation = session.getOrCreateConversation('my_conversations' + session.me.id);
    conversation.setParticipant(session.me);
    return conversation;
  }, []);

  return (
    <div className="h-[655px] max-w-full">
      <Inbox
        loadingComponent={
          <div
            className="flex h-96 w-full items-center justify-center"
            data-testid="user-messages-loading"
          >
            Loading..
          </div>
        }
        syncConversation={syncConversation}
        className="h-full w-full max-w-[760px]"
      />
    </div>
  );
};
