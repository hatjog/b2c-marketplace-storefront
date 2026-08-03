import { toast as sonnerToast } from 'sonner';

import { CloseIcon, DoneIcon, ErrorIcon } from '@/icons';

export const toast = {
  info: ({ description, title }: { description?: string; title: string }) => {
    sonnerToast.info(title, {
      className: 'bb-toast-skin',
      description
    });
  },
  success: ({ description, title }: { description?: string; title: string }) => {
    sonnerToast.success(title, {
      description,
      duration: 10000,
      icon: <DoneIcon color="rgb(20, 83, 45)" />,
      cancel: {
        label: (
          <CloseIcon
            size={22}
            color="rgba(9, 9, 9, 1)"
            className="ml-auto cursor-pointer"
          />
        ),
        onClick: () => {}
      },
      cancelButtonStyle: {
        backgroundColor: 'transparent',
        border: 'none'
      },
      classNames: {
        icon: 'self-start pt-2',
        toast: 'bb-toast-skin items-start gap-3',
        title: 'text-md text-primary'
      }
    });
  },
  error: ({ description, title }: { description?: string; title: string }) => {
    sonnerToast.error(title, {
      description,
      icon: <ErrorIcon color="rgb(155, 34, 25)" />,
      cancel: {
        label: (
          <CloseIcon
            size={22}
            color="rgba(9, 9, 9, 1)"
            className="ml-auto cursor-pointer"
          />
        ),
        onClick: () => {}
      },
      cancelButtonStyle: {
        backgroundColor: 'transparent',
        border: 'none'
      },
      classNames: {
        icon: 'self-start pt-2',
        toast: 'bb-toast-skin items-start gap-3',
        title: 'text-md text-primary'
      }
    });
  }
};
