import { useCallback, useState } from 'react';

interface NotificationState {
  isOpen: boolean;
  title: string;
  message: string;
}

const DEFAULT_SAVE_TITLE = '저장 완료';
const DEFAULT_SAVE_MESSAGE = '변경사항을 저장했습니다.';
const DEFAULT_CANCEL_TITLE = '변경 취소';
const DEFAULT_CANCEL_MESSAGE = '변경사항을 취소했습니다.';

const useSaveNotification = () => {
  const [state, setState] = useState<NotificationState>({
    isOpen: false,
    title: '',
    message: '',
  });

  const close = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const open = useCallback((title: string, message: string) => {
    setState({ isOpen: true, title, message });
  }, []);

  const notifySave = useCallback(
    (message?: string, title: string = DEFAULT_SAVE_TITLE) => {
      open(title, message ?? DEFAULT_SAVE_MESSAGE);
    },
    [open],
  );

  const notifyCancel = useCallback(
    (message?: string, title: string = DEFAULT_CANCEL_TITLE) => {
      open(title, message ?? DEFAULT_CANCEL_MESSAGE);
    },
    [open],
  );

  const notifyCustom = useCallback(
    (title: string, message: string) => {
      open(title, message);
    },
    [open],
  );

  const notificationProps = {
    isOpen: state.isOpen,
    title: state.title,
    message: state.message,
    onClose: close,
  };

  return {
    notifySave,
    notifyCancel,
    notifyCustom,
    notificationProps,
  };
};

export default useSaveNotification;
