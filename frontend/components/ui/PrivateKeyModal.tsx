"use client";

import React from 'react';
import { Button } from '@/components/ui/Button';

interface Props {
  open: boolean;
  privateKey: string;
  onClose: () => void;
  onSaveToSession: () => void;
  onCopiedAndDelete: () => void;
}

export function PrivateKeyModal({ open, privateKey, onClose, onSaveToSession, onCopiedAndDelete }: Props) {
  if (!open) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(privateKey);
    } catch (err) {
      // ignore clipboard errors, user can copy manually
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg max-w-xl w-full p-6 space-y-4">
        <h3 className="text-lg font-semibold">Your private key — store securely</h3>
        <p className="text-sm text-gray-600">This key allows you to decrypt and use FHE features. Save it somewhere safe. It will not be recoverable from the server.</p>
        <pre className="bg-gray-50 p-3 rounded text-xs break-all max-h-48 overflow-auto">{privateKey}</pre>
        <div className="flex gap-2">
          <Button onClick={async () => { await handleCopy(); onCopiedAndDelete(); }} variant="primary">I've copied it (delete from browser)</Button>
          <Button onClick={() => { onSaveToSession(); onClose(); }} variant="secondary">Save to session for now</Button>
          <Button onClick={onClose} variant="ghost">Close</Button>
        </div>
        <p className="text-xs text-gray-500">Recommended: copy to a hardware wallet or secure password manager and then delete it from the browser.</p>
      </div>
    </div>
  );
}

export default PrivateKeyModal;
