import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';

type Props = {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
};

export default function ConfirmDialog({
  open,
  title = 'Conferma',
  message,
  confirmLabel = 'Conferma',
  cancelLabel = 'Annulla',
  onConfirm,
  onCancel,
  danger = true,
}: Props) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <button className="btn-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className={danger ? 'btn-danger' : 'btn-accent'} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex gap-3 items-start">
        <AlertTriangle className={danger ? 'text-danger' : 'text-accent'} size={22} />
        <p className="text-gray-300">{message}</p>
      </div>
    </Modal>
  );
}

export function useConfirm() {
  const [state, setState] = useState<{
    open: boolean;
    message: string;
    title?: string;
    confirmLabel?: string;
    resolve?: (v: boolean) => void;
  }>({ open: false, message: '' });

  const confirm = (message: string, opts?: { title?: string; confirmLabel?: string }) =>
    new Promise<boolean>((resolve) => {
      setState({ open: true, message, title: opts?.title, confirmLabel: opts?.confirmLabel, resolve });
    });

  const close = (val: boolean) => {
    state.resolve?.(val);
    setState((s) => ({ ...s, open: false }));
  };

  const dialog = (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  );

  return { confirm, dialog };
}
